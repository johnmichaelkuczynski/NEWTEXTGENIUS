import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AnalysisConfig {
  documentMode: 'single' | 'dual';
  llmProvider: 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4';
  assessmentType: 'cognitive' | 'psychological' | 'psychopathological';
  assessmentMode: 'normal' | 'comprehensive';
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
                Single
              </Button>
              <Button
                variant={config.documentMode === 'dual' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('documentMode', 'dual')}
                data-testid="dual-document-mode"
              >
                Dual
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
                <SelectItem value="zhi1">ZHI 1</SelectItem>
                <SelectItem value="zhi2">ZHI 2</SelectItem>
                <SelectItem value="zhi3">ZHI 3</SelectItem>
                <SelectItem value="zhi4">ZHI 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assessment Type - NEW 6 MODE SYSTEM */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">Assessment Type</Label>
            <Select value={config.assessmentType} onValueChange={(value) => updateConfig('assessmentType', value)}>
              <SelectTrigger data-testid="assessment-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cognitive">Cognitive Capability</SelectItem>
                <SelectItem value="psychological">Psychological Characteristics</SelectItem>
                <SelectItem value="psychopathological">Psychopathology</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assessment Mode */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-3">Assessment Mode</Label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={config.assessmentMode === 'normal' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('assessmentMode', 'normal')}
                data-testid="normal-assessment-mode"
                title="Phase 1 only"
              >
                Normal
              </Button>
              <Button
                variant={config.assessmentMode === 'comprehensive' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => updateConfig('assessmentMode', 'comprehensive')}
                data-testid="comprehensive-assessment-mode"
                title="Phases 1-4"
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
