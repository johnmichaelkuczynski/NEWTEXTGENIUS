import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Microscope, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AnalysisConfigPanel } from '@/components/analysis-config';
import { DocumentInput } from '@/components/document-input';
import { ProgressTracker } from '@/components/progress-tracker';
import { ResultsDisplay } from '@/components/results-display';
import { AIChat } from '@/components/ai-chat';
import { useAnalysisStream } from '@/hooks/use-analysis-stream';
import { AnalysisRequest, AnalysisResult } from '@shared/schema';

interface AnalysisConfig {
  documentMode: 'single' | 'dual';
  llmProvider: 'anthropic' | 'openai' | 'perplexity' | 'deepseek';
  evaluationParam: 'originality' | 'intelligence' | 'cogency' | 'quality';
  analysisMode: 'quick' | 'comprehensive';
}

export default function Home() {
  const { toast } = useToast();
  const [config, setConfig] = useState<AnalysisConfig>({
    documentMode: 'single',
    llmProvider: 'anthropic',
    evaluationParam: 'originality',
    analysisMode: 'quick'
  });
  const [document1Text, setDocument1Text] = useState('');
  const [document2Text, setDocument2Text] = useState('');
  const [selectedChunks1, setSelectedChunks1] = useState<number[]>([]);
  const [selectedChunks2, setSelectedChunks2] = useState<number[]>([]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Use streaming hook for real-time updates
  const { analysis, isConnected, error: streamError, isComplete, progress, streamingText } = useAnalysisStream(analysisId);

  // Handle stream completion
  useEffect(() => {
    if (isComplete) {
      setIsAnalyzing(false);
    }
  }, [isComplete]);

  // Handle stream errors
  useEffect(() => {
    if (streamError) {
      toast({
        title: "Streaming Error",
        description: streamError,
        variant: "destructive",
      });
    }
  }, [streamError, toast]);

  const startAnalysisMutation = useMutation({
    mutationFn: async (request: AnalysisRequest) => {
      const response = await apiRequest('POST', '/api/analysis', request);
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisId(data.analysisId);
      setIsAnalyzing(true);
      toast({
        title: "Analysis started",
        description: "Your text analysis is now in progress.",
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to start analysis",
        variant: "destructive",
      });
    },
  });


  const handleStartAnalysis = () => {
    // Validate inputs
    if (!document1Text.trim()) {
      toast({
        title: "Missing document",
        description: "Please provide text for analysis.",
        variant: "destructive",
      });
      return;
    }

    if (config.documentMode === 'dual' && !document2Text.trim()) {
      toast({
        title: "Missing second document",
        description: "Please provide text for the second document.",
        variant: "destructive",
      });
      return;
    }

    const request: AnalysisRequest = {
      documentMode: config.documentMode,
      llmProvider: config.llmProvider,
      evaluationParam: config.evaluationParam,
      analysisMode: config.analysisMode,
      document1Text,
      document2Text: config.documentMode === 'dual' ? document2Text : undefined,
      selectedChunks1: selectedChunks1.length > 0 ? selectedChunks1 : undefined,
      selectedChunks2: config.documentMode === 'dual' && selectedChunks2.length > 0 ? selectedChunks2 : undefined,
    };

    startAnalysisMutation.mutate(request);
  };

  const handleDownloadReport = async () => {
    if (!analysisId) return;

    try {
      const response = await fetch(`/api/analysis/${analysisId}/report`);
      if (!response.ok) throw new Error('Failed to download report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis-report-${analysisId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the analysis report.",
        variant: "destructive",
      });
    }
  };

  const handleNewAnalysis = () => {
    setAnalysisId(null);
    setIsAnalyzing(false);
    setDocument1Text('');
    setDocument2Text('');
  };

  const getLLMDisplayName = (provider: string) => {
    switch (provider) {
      case 'anthropic': return 'ZHI 2';
      case 'openai': return 'ZHI 3';
      case 'perplexity': return 'ZHI 4';
      case 'deepseek': return 'ZHI 1';
      default: return provider;
    }
  };

  const getParamDisplayName = (param: string) => {
    switch (param) {
      case 'originality': return 'Originality';
      case 'intelligence': return 'Intelligence';
      case 'cogency': return 'Cogency';
      case 'quality': return 'Overall Quality';
      default: return param;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Microscope className="text-primary-600 h-8 w-8 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Originality Meter</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Advanced Text Analysis</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Configuration Panel */}
        <AnalysisConfigPanel
          config={config}
          onConfigChange={setConfig}
        />

        {/* Document Input Section */}
        <div className={`grid gap-8 mb-8 ${config.documentMode === 'dual' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <DocumentInput
            title={config.documentMode === 'dual' ? 'Document 1' : 'Document'}
            text={document1Text}
            onTextChange={setDocument1Text}
            selectedChunks={selectedChunks1}
            onChunksChange={setSelectedChunks1}
            required
            disabled={isAnalyzing}
          />
          
          {config.documentMode === 'dual' && (
            <DocumentInput
              title="Document 2"
              text={document2Text}
              onTextChange={setDocument2Text}
              selectedChunks={selectedChunks2}
              onChunksChange={setSelectedChunks2}
              required
              disabled={isAnalyzing}
            />
          )}
        </div>

        {/* Analysis Controls */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
                <p className="text-sm text-gray-600">
                  Analyzing for <span className="font-medium text-primary-600">{getParamDisplayName(config.evaluationParam)}</span>{' '}
                  using <span className="font-medium text-primary-600">{getLLMDisplayName(config.llmProvider)}</span>{' '}
                  in <span className="font-medium text-primary-600">{config.analysisMode}</span> mode
                </p>
              </div>
              <Button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || startAnalysisMutation.isPending}
                className="bg-primary-600 hover:bg-primary-700"
                data-testid="start-analysis"
              >
                {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Tracker */}
        <ProgressTracker
          isVisible={isAnalyzing || !!progress}
          currentStep={(() => {
            // For quick mode: pass question index directly (1-3)
            if (config.analysisMode === 'quick') {
              return progress?.questionIndex || 1;
            }
            // For comprehensive mode: map questions to phases (1-4)
            const questionIndex = progress?.questionIndex || 1;
            const totalQuestions = progress?.totalQuestions || 24;
            const questionsPerPhase = Math.ceil(totalQuestions / 4);
            return Math.min(4, Math.ceil(questionIndex / questionsPerPhase));
          })()}
          totalSteps={config.analysisMode === 'quick' ? 3 : 4}
          currentPhase={progress?.currentQuestion ? `Analyzing: ${progress.currentQuestion}` : progress?.message || "Processing Document - Analyzing text..."}
          currentAction={
            progress?.questionIndex && progress?.totalQuestions
              ? `Question ${progress.questionIndex} of ${progress.totalQuestions}${
                  progress?.chunkIndex && progress?.totalChunks 
                    ? ` • Chunk ${progress.chunkIndex}/${progress.totalChunks}` 
                    : ''
                }`
              : "Evaluating cognitive protocol..."
          }
          showPhaseDetails={config.analysisMode === 'comprehensive'}
          onCancel={() => setIsAnalyzing(false)}
          streamingText={streamingText}
        />

        {/* Results Display */}
        <ResultsDisplay
          results={analysis}
          isVisible={!!analysis}
          onDownloadReport={handleDownloadReport}
          onNewAnalysis={handleNewAnalysis}
        />

        {/* Feedback Button */}
        <div className="fixed bottom-4 left-4 z-40">
          <Button
            onClick={() => window.open('https://forms.gle/your-feedback-form', '_blank')}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg"
            data-testid="talk-back"
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            Talk Back / Feedback
          </Button>
        </div>

        {/* AI Chat Assistant - UNRESTRICTED, full context */}
        <AIChat 
          documentText={document1Text}
          analysisResults={analysis}
        />
      </div>
    </div>
  );
}
