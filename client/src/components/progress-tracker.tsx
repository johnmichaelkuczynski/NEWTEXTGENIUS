import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, StopCircle, CheckCircle, Clock, Circle } from 'lucide-react';

interface ProgressTrackerProps {
  isVisible: boolean;
  currentStep: number;
  totalSteps: number;
  currentPhase: string;
  currentAction: string;
  showPhaseDetails?: boolean;
  onCancel: () => void;
  streamingText?: string;
}

export function ProgressTracker({
  isVisible,
  currentStep,
  totalSteps,
  currentPhase,
  currentAction,
  showPhaseDetails = false,
  onCancel,
  streamingText
}: ProgressTrackerProps) {
  if (!isVisible) return null;

  const progressPercentage = (currentStep / totalSteps) * 100;

  const phases = [
    { name: 'Phase 1', status: currentStep > 1 ? 'complete' : currentStep === 1 ? 'active' : 'pending' },
    { name: 'Phase 2', status: currentStep > 2 ? 'complete' : currentStep === 2 ? 'active' : 'pending' },
    { name: 'Phase 3', status: currentStep > 3 ? 'complete' : currentStep === 3 ? 'active' : 'pending' },
    { name: 'Phase 4', status: currentStep > 4 ? 'complete' : currentStep === 4 ? 'active' : 'pending' },
  ];

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analysis in Progress</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-red-600 hover:text-red-700"
            data-testid="cancel-analysis"
          >
            <StopCircle className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-500" data-testid="progress-steps">
              {currentStep} of {totalSteps}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Current Phase */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <Loader2 className="animate-spin h-5 w-5 text-primary-600 mr-3" />
            <div className="flex-1">
              <p className="font-medium text-gray-900" data-testid="current-phase">{currentPhase}</p>
              <p className="text-sm text-gray-600" data-testid="current-action">{currentAction}</p>
            </div>
          </div>
        </div>

        {/* Streaming Text Generation */}
        {streamingText && (
          <div className="bg-white border rounded-lg p-4 mb-4" data-testid="streaming-text">
            <h4 className="font-medium text-gray-900 mb-2">Live Analysis Generation:</h4>
            <div className="bg-gray-50 rounded p-3 font-mono text-sm text-gray-800 max-h-48 overflow-y-auto">
              {streamingText}
              <span className="animate-pulse text-primary-600">▊</span>
            </div>
          </div>
        )}

        {/* Phase Details (Comprehensive Mode) */}
        {showPhaseDetails && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="phase-details">
            {phases.map((phase, index) => (
              <div
                key={phase.name}
                className={`text-center p-3 rounded-lg ${
                  phase.status === 'complete'
                    ? 'bg-green-50'
                    : phase.status === 'active'
                    ? 'bg-primary-50 border border-primary-200'
                    : 'bg-gray-50'
                }`}
              >
                {phase.status === 'complete' && (
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                )}
                {phase.status === 'active' && (
                  <Clock className="h-5 w-5 text-primary-600 mx-auto mb-2" />
                )}
                {phase.status === 'pending' && (
                  <Circle className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                )}
                <p className={`text-sm font-medium ${
                  phase.status === 'complete'
                    ? 'text-gray-900'
                    : phase.status === 'active'
                    ? 'text-primary-900'
                    : 'text-gray-500'
                }`}>
                  {phase.name}
                </p>
                <p className={`text-xs ${
                  phase.status === 'complete'
                    ? 'text-gray-600'
                    : phase.status === 'active'
                    ? 'text-primary-600'
                    : 'text-gray-500'
                }`}>
                  {phase.status === 'complete' ? 'Complete' : 
                   phase.status === 'active' ? 'Processing' : 'Pending'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
