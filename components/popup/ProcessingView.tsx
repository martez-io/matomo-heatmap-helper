import { StatusFeedback } from '@/components/popup/StatusFeedback';

type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

interface ProcessingViewProps {
  currentStep: ProcessingStep;
}

export function ProcessingView({ currentStep }: ProcessingViewProps) {
  return (
    <div className="space-y-4">
      <StatusFeedback currentStep={currentStep} />
    </div>
  );
}
