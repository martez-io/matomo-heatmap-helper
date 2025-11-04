import { CheckCircle2, Loader2 } from 'lucide-react';

type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

interface StatusFeedbackProps {
  currentStep: ProcessingStep;
}

const steps: { key: ProcessingStep; label: string }[] = [
  { key: 'validating', label: 'Validating heatmap' },
  { key: 'expanding', label: 'Expanding elements' },
  { key: 'capturing', label: 'Triggering screenshot' },
  { key: 'verifying', label: 'Verifying capture' },
  { key: 'complete', label: 'Complete!' },
];

export function StatusFeedback({ currentStep }: StatusFeedbackProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-3">
            {/* Icon */}
            <div className="flex-shrink-0">
              {isComplete && (
                <CheckCircle2 className="h-5 w-5 text-success-600" />
              )}
              {isCurrent && (
                <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
              )}
              {isPending && (
                <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
              )}
            </div>

            {/* Label */}
            <span
              className={`text-sm ${
                isComplete
                  ? 'text-success-700 font-medium'
                  : isCurrent
                  ? 'text-primary-500 font-semibold'
                  : 'text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
