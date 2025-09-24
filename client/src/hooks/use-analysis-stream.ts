import { useEffect, useState, useCallback } from 'react';
import { AnalysisResult } from '@shared/schema';

interface StreamEvent {
  type: 'connected' | 'update' | 'complete' | 'error' | 'progress';
  analysisId?: string;
  analysis?: any;
  error?: string;
  // Progress-specific fields
  status?: string;
  message?: string;
  currentStep?: string;
  currentQuestion?: string;
  questionIndex?: number;
  totalQuestions?: number;
  chunkIndex?: number;
  totalChunks?: number;
  score?: number;
  overallScore?: number;
  processingTime?: number;
}

interface ProgressState {
  status: string;
  message: string;
  currentStep: string;
  currentQuestion?: string;
  questionIndex?: number;
  totalQuestions?: number;
  chunkIndex?: number;
  totalChunks?: number;
  score?: number;
}

export function useAnalysisStream(analysisId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const maxReconnectAttempts = 5;

  const connectToStream = useCallback(() => {
    if (!analysisId) return;

    const eventSource = new EventSource(`/api/analysis/${analysisId}/stream`);

    eventSource.onopen = () => {
      console.log('EventSource connected successfully');
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0); // Reset reconnect attempts on successful connection
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            setIsConnected(true);
            setReconnectAttempts(0);
            break;
          
          case 'progress':
            // Update progress state with live analysis generation updates
            setProgress({
              status: data.status || 'processing',
              message: data.message || 'Processing...',
              currentStep: data.currentStep || 'unknown',
              currentQuestion: data.currentQuestion,
              questionIndex: data.questionIndex,
              totalQuestions: data.totalQuestions,
              chunkIndex: data.chunkIndex,
              totalChunks: data.totalChunks,
              score: data.score
            });
            
            // If analysis is completed via progress, also set final score
            if (data.status === 'completed' && data.overallScore !== undefined) {
              setIsComplete(true);
              setIsConnected(false);
            }
            break;
          
          case 'update':
            if (data.analysis) {
              // Only update if we have valid results data
              if (data.analysis.overallScore !== null && data.analysis.overallScore !== undefined) {
                // Transform the analysis data to match our AnalysisResult interface
                const transformedAnalysis: AnalysisResult = {
                  id: data.analysis.id,
                  overallScore: data.analysis.overallScore,
                  processingTime: data.analysis.processingTime || 0,
                  results: data.analysis.results || [],
                  document2Results: data.analysis.document2Results,
                  comparisonResults: data.analysis.comparisonResults,
                };
                setAnalysis(transformedAnalysis);
              }
            }
            break;

          case 'complete':
            console.log('Analysis completed, closing stream');
            setIsComplete(true);
            setIsConnected(false);
            break;

          case 'error':
            setError(data.error || 'Unknown streaming error');
            setIsConnected(false);
            break;
        }
      } catch (err) {
        console.error('Error parsing stream event:', err);
        setError('Failed to parse stream data');
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      setIsConnected(false);
      
      // Handle reconnection for non-complete analyses
      if (!isComplete && reconnectAttempts < maxReconnectAttempts) {
        setReconnectAttempts(prev => prev + 1);
        setError(`Connection lost, reconnecting... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        
        // Reconnect after a delay
        setTimeout(() => {
          if (!isComplete) {
            console.log(`Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
            eventSource.close();
            // This will trigger the useEffect to reconnect
          }
        }, 2000);
      } else {
        setError('Connection error - analysis may still be running in background');
      }
    };

    return eventSource;
  }, [analysisId, isComplete, reconnectAttempts, maxReconnectAttempts]);

  useEffect(() => {
    let eventSource: EventSource | undefined;
    let reconnectTimeout: NodeJS.Timeout | undefined;

    if (analysisId && !isComplete) {
      eventSource = connectToStream();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [analysisId, isComplete, connectToStream, reconnectAttempts]);

  // Reset state when analysisId changes
  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setIsComplete(false);
    setIsConnected(false);
    setReconnectAttempts(0);
    setProgress(null);
  }, [analysisId]);

  // Fallback: Check analysis status via polling if streaming fails
  useEffect(() => {
    let pollTimeout: NodeJS.Timeout;
    
    if (analysisId && !isComplete && error && reconnectAttempts >= maxReconnectAttempts) {
      const pollForCompletion = async () => {
        try {
          const response = await fetch(`/api/analysis/${analysisId}`);
          if (response.ok) {
            const analysisData = await response.json();
            if (analysisData.overallScore !== null && analysisData.overallScore !== undefined) {
              const transformedAnalysis: AnalysisResult = {
                id: analysisData.id,
                overallScore: analysisData.overallScore,
                processingTime: analysisData.processingTime || 0,
                results: analysisData.results?.results || [],
                document2Results: analysisData.results?.document2Results,
                comparisonResults: analysisData.results?.comparisonResults,
              };
              setAnalysis(transformedAnalysis);
              setIsComplete(true);
              setError(null);
              return;
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
        
        // Continue polling if not complete
        pollTimeout = setTimeout(pollForCompletion, 3000);
      };
      
      setError('Connection lost - checking analysis status...');
      pollForCompletion();
    }
    
    return () => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [analysisId, isComplete, error, reconnectAttempts, maxReconnectAttempts]);

  return {
    analysis,
    isConnected,
    error,
    isComplete,
    progress
  };
}