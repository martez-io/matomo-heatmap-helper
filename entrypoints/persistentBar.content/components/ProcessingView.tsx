import { Progress } from '@/components/ui/progress';
import { STEP_CONFIGS, STEP_ORDER } from '../lib/constants';
import type { ProcessingStep } from '@/types/storage';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

interface ProcessingViewProps {
    currentStep: ProcessingStep;
    onCancel: () => void;
}

export function ProcessingView({ currentStep, onCancel }: ProcessingViewProps) {
    const stepConfig = STEP_CONFIGS[currentStep];
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const totalSteps = STEP_ORDER.length;
    const progressPercentage = ((currentIndex + 1) / totalSteps) * 100;

    return (
        <div
            className="flex flex-col items-start justify-start pt-3"
            role="status"
            aria-live="polite"
            aria-label={`Processing step ${currentIndex + 1} of ${totalSteps}: ${stepConfig.label}`}
        >
            <div className="flex justify-between w-full items-center">
                <div className="flex items-start justify-start ">
                    {/* Step Icon */}
                    <div className="flex items-center justify-center p-3 rounded-md bg-primary/10">
                        <stepConfig.icon className="size-6 animate-wiggle text-primary" />
                    </div>

                    {/* Step Label */}
                    <div className="ml-3">
                        <h3 className="text-xl font-semibold text-foreground mb-0">
                            {stepConfig.label}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {stepConfig.description}
                        </p>
                    </div>
                </div>

                <div className="ml-auto">
                    <Button variant="secondary" size="sm" onClick={onCancel}>
                        <XIcon className="size-4" />
                        <span>Cancel</span>
                    </Button>
                </div>
            </div>

            {/* Progress Bar Section */}
            <div className="w-full mt-3">
                <Progress
                    value={progressPercentage}
                    className="h-2.5"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercentage}
                />
            </div>
        </div >
    );
}
