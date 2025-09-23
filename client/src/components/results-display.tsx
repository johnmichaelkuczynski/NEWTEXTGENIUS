import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw } from 'lucide-react';
import { AnalysisResult } from '@shared/schema';

interface ResultsDisplayProps {
  results: AnalysisResult | null;
  isVisible: boolean;
  onDownloadReport: () => void;
  onNewAnalysis: () => void;
}

export function ResultsDisplay({ results, isVisible, onDownloadReport, onNewAnalysis }: ResultsDisplayProps) {
  if (!isVisible || !results) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8" data-testid="results-section">
      {/* Single Document Results */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Analysis Results</h3>
            <div className="flex space-x-3">
              <Button
                onClick={onDownloadReport}
                className="bg-green-600 hover:bg-green-700"
                data-testid="download-report"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
              <Button
                onClick={onNewAnalysis}
                variant="secondary"
                data-testid="new-analysis"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                New Analysis
              </Button>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6 mb-6">
            {results.document2Results ? (
              // Dual mode - show separate scores, no overall
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600" data-testid="doc1-score">
                    {results.results && Array.isArray(results.results) && results.results.length > 0 
                      ? Math.round(results.results.reduce((sum, r) => sum + (r?.score || 0), 0) / results.results.length)
                      : 0}
                  </div>
                  <div className="text-sm text-gray-600">Document 1</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600" data-testid="doc2-score">
                    {results.document2Results && Array.isArray(results.document2Results) && results.document2Results.length > 0
                      ? Math.round(results.document2Results.reduce((sum, r) => sum + (r?.score || 0), 0) / results.document2Results.length)
                      : 0}
                  </div>
                  <div className="text-sm text-gray-600">Document 2</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">Comparison</div>
                  <div className="text-sm text-gray-600">Analysis</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900" data-testid="processing-time">
                    {formatTime(results.processingTime || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Processing Time</div>
                </div>
              </div>
            ) : (
              // Single mode - show overall score
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600" data-testid="overall-score">
                    {results.overallScore || 0}
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">Single</div>
                  <div className="text-sm text-gray-600">Document</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">Analysis</div>
                  <div className="text-sm text-gray-600">Complete</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900" data-testid="processing-time">
                    {formatTime(results.processingTime || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Processing Time</div>
                </div>
              </div>
            )}
          </div>

          {/* Document 1 Results */}
          <div className="space-y-6">
            <h4 className="text-xl font-semibold text-gray-900">
              {results.document2Results ? 'Document 1 Analysis' : 'Document Analysis'}
            </h4>
            {(results.results && Array.isArray(results.results) && results.results.length > 0) ? results.results.map((result, index) => (
              <Card key={index} className="border border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h5 className="text-lg font-semibold text-gray-900 flex-1 mr-4">
                      {result.question}
                    </h5>
                    <Badge 
                      variant={result.score >= 80 ? 'default' : result.score >= 60 ? 'secondary' : 'destructive'}
                      className="text-sm font-medium"
                      data-testid={`score-${index}`}
                    >
                      {result.score}/100
                    </Badge>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <p>{result.explanation || 'Analysis in progress...'}</p>
                    {result.quotes && Array.isArray(result.quotes) && result.quotes.length > 0 && (
                      <div className="mt-4">
                        <h6 className="font-medium text-gray-900 mb-2">Key Quotes:</h6>
                        {result.quotes.map((quote, quoteIndex) => (
                          <blockquote 
                            key={quoteIndex}
                            className="border-l-4 border-primary-500 pl-4 italic my-2 text-gray-600"
                          >
                            "{quote}"
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-8 text-gray-500">
                Analysis in progress...
              </div>
            )}
          </div>

          {/* Document 2 Results */}
          {results.document2Results && (
            <div className="space-y-6 mt-8">
              <h4 className="text-xl font-semibold text-gray-900">Document 2 Analysis</h4>
              {(results.document2Results && Array.isArray(results.document2Results) && results.document2Results.length > 0) ? results.document2Results.map((result, index) => (
                <Card key={index} className="border border-gray-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h5 className="text-lg font-semibold text-gray-900 flex-1 mr-4">
                        {result.question}
                      </h5>
                      <Badge 
                        variant={result.score >= 80 ? 'default' : result.score >= 60 ? 'secondary' : 'destructive'}
                        className="text-sm font-medium"
                      >
                        {result.score}/100
                      </Badge>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      <p>{result.explanation}</p>
                      {result.quotes.length > 0 && (
                        <div className="mt-4">
                          <h6 className="font-medium text-gray-900 mb-2">Key Quotes:</h6>
                          {result.quotes.map((quote, quoteIndex) => (
                            <blockquote 
                              key={quoteIndex}
                              className="border-l-4 border-green-500 pl-4 italic my-2 text-gray-600"
                            >
                              "{quote}"
                            </blockquote>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  Document 2 analysis in progress...
                </div>
              )}
            </div>
          )}

          {/* Comparison Results */}
          {results.comparisonResults && (
            <div className="mt-8">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <h4 className="text-xl font-semibold text-gray-900 mb-4">Comparative Analysis</h4>
                  <div className="prose prose-sm max-w-none text-gray-700 mb-4">
                    <p>{results.comparisonResults?.explanation || 'Comparison analysis in progress...'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {results.comparisonResults?.scores?.document1 || 0}
                      </div>
                      <div className="text-sm text-gray-600">Document 1 Score</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {results.comparisonResults?.scores?.document2 || 0}
                      </div>
                      <div className="text-sm text-gray-600">Document 2 Score</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
