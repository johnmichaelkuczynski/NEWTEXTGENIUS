import { useEffect, useState, useCallback, useRef } from 'react';
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
  // Streaming text fields
  streamChunk?: string;
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
  streamingText?: string;
}

export function useAnalysisStream(analysisId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const maxReconnectAttempts = 5;
  
  // CRITICAL FIX: Use ref to capture latest streaming text in EventSource handlers
  const streamingTextRef = useRef<string>('');

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
            // Handle streaming text updates
            if (data.streamChunk && data.status === 'streaming') {
              setStreamingText(prev => {
                const updated = prev + data.streamChunk;
                streamingTextRef.current = updated; // Keep ref in sync
                // Update progress state with synchronized streaming text
                setProgress({
                  status: data.status || 'processing',
                  message: data.message || 'Processing...',
                  currentStep: data.currentStep || 'unknown',
                  currentQuestion: data.currentQuestion,
                  questionIndex: data.questionIndex,
                  totalQuestions: data.totalQuestions,
                  chunkIndex: data.chunkIndex,
                  totalChunks: data.totalChunks,
                  score: data.score,
                  streamingText: updated
                });
                return updated;
              });
            } else if (data.status === 'processing_question') {
              // New question started, add separator but keep accumulated text
              setStreamingText(prev => {
                const separator = prev ? '\n\n---\n\n' : '';
                const questionHeader = `Question ${data.questionIndex}/${data.totalQuestions}: ${data.currentQuestion}\n\n`;
                const updated = prev + separator + questionHeader;
                streamingTextRef.current = updated; // Keep ref in sync
                setProgress({
                  status: data.status || 'processing',
                  message: data.message || 'Processing...',
                  currentStep: data.currentStep || 'unknown',
                  currentQuestion: data.currentQuestion,
                  questionIndex: data.questionIndex,
                  totalQuestions: data.totalQuestions,
                  chunkIndex: data.chunkIndex,
                  totalChunks: data.totalChunks,
                  score: data.score,
                  streamingText: updated
                });
                return updated;
              });
            } else {
              // Other progress updates
              setProgress({
                status: data.status || 'processing',
                message: data.message || 'Processing...',
                currentStep: data.currentStep || 'unknown',
                currentQuestion: data.currentQuestion,
                questionIndex: data.questionIndex,
                totalQuestions: data.totalQuestions,
                chunkIndex: data.chunkIndex,
                totalChunks: data.totalChunks,
                score: data.score,
                streamingText: streamingText
              });
            }
            
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
                // CRITICAL: Attach the streaming text so it persists after completion
                const transformedAnalysis: AnalysisResult = {
                  id: data.analysis.id,
                  overallScore: data.analysis.overallScore,
                  processingTime: data.analysis.processingTime || 0,
                  results: data.analysis.results || [],
                  document2Results: data.analysis.document2Results,
                  comparisonResults: data.analysis.comparisonResults,
                  streamingTranscript: streamingTextRef.current, // Use ref to get latest text
                };
                setAnalysis(transformedAnalysis);
              }
            }
            break;

          case 'complete':
            console.log('Analysis completed, closing stream');
            // Update analysis with final streaming text before marking complete
            setAnalysis(prev => prev ? {...prev, streamingTranscript: streamingTextRef.current} : prev);
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
      eventSource.close();
      
      // Handle reconnection for non-complete analyses
      if (!isComplete && reconnectAttempts < maxReconnectAttempts) {
        const nextAttempt = reconnectAttempts + 1;
        setError(`Connection lost, reconnecting... (${nextAttempt}/${maxReconnectAttempts})`);
        setReconnectAttempts(nextAttempt);
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
      // If reconnecting (reconnectAttempts > 0), add a delay
      if (reconnectAttempts > 0) {
        reconnectTimeout = setTimeout(() => {
          console.log(`Reconnecting attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
          eventSource = connectToStream();
        }, 2000);
      } else {
        eventSource = connectToStream();
      }
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
  }, [analysisId, isComplete, connectToStream, reconnectAttempts, maxReconnectAttempts]);

  // Reset state when analysisId changes
  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setIsComplete(false);
    setIsConnected(false);
    setReconnectAttempts(0);
    setProgress(null);
    setStreamingText('');
    streamingTextRef.current = ''; // Reset ref too
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
                results: analysisData.results || [],
                document2Results: analysisData.document2Results,
                comparisonResults: analysisData.comparisonResults,
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
    progress,
    streamingText
  };
}