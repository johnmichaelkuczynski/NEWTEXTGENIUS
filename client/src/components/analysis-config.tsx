import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AnalysisConfig {
  documentMode: 'single' | 'dual';
  llmProvider: 'anthropic' | 'openai' | 'perplexity' | 'deepseek';
  evaluationParam: 'originality' | 'intelligence' | 'cogency' | 'quality';
  analysisMode: 'quick' | 'comprehensive';
}

interface AnalysisConfigProps {
  config: AnalysisConfig;
  onConfigChange: (config: AnalysisConfig) => void;
}

export function AnalysisConfigPanel({ config, onConfigChange }: AnalysisConfigProps) {
  const updateConfig = (key: keyof AnalysisConfig, value: string) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Analysis Configuration</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Document Mode */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">Document Mode</Label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={config.documentMode === 'single' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('documentMode', 'single')}
                data-testid="single-document-mode"
              >
                Single Document
              </Button>
              <Button
                variant={config.documentMode === 'dual' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('documentMode', 'dual')}
                data-testid="dual-document-mode"
              >
                Dual Document
              </Button>
            </div>
          </div>

          {/* LLM Provider */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">LLM Provider</Label>
            <Select value={config.llmProvider} onValueChange={(value) => updateConfig('llmProvider', value)}>
              <SelectTrigger data-testid="llm-provider-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">🧠 ZHI 1</SelectItem>
                <SelectItem value="openai">🤖 ZHI 2</SelectItem>
                <SelectItem value="deepseek">🔬 ZHI 3</SelectItem>
                <SelectItem value="perplexity">🔍 ZHI 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Evaluation Parameter */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">Evaluation Parameter</Label>
            <Select value={config.evaluationParam} onValueChange={(value) => updateConfig('evaluationParam', value)}>
              <SelectTrigger data-testid="evaluation-param-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="originality">✨ Originality</SelectItem>
                <SelectItem value="intelligence">🧠 Intelligence</SelectItem>
                <SelectItem value="cogency">🎯 Cogency</SelectItem>
                <SelectItem value="quality">⭐ Overall Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Analysis Mode */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">Analysis Mode</Label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={config.analysisMode === 'quick' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('analysisMode', 'quick')}
                data-testid="quick-analysis-mode"
              >
                Quick (~30s)
              </Button>
              <Button
                variant={config.analysisMode === 'comprehensive' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('analysisMode', 'comprehensive')}
                data-testid="comprehensive-analysis-mode"
              >
                Comprehensive
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
