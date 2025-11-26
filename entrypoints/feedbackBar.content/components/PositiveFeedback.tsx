/**
 * PositiveFeedback component
 * Shows review prompt or simple thanks message
 */

import { CheckCircle, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PositiveFeedbackProps {
    showReviewPrompt: boolean;
    onReviewClick: () => void;
    onDismiss: () => void;
    onGitHubClick: () => void;
}

export function PositiveFeedback({
    showReviewPrompt,
    onReviewClick,
    onDismiss,
    onGitHubClick,
}: PositiveFeedbackProps) {
    // Simple thanks message after 3 prompts or if user already clicked review
    if (!showReviewPrompt) {
        return (
            <div className="space-y-3 animate-slideUp w-full">
                <div className="flex items-start justify-start gap-x-2 w-full">
                    <div className="flex items-center justify-center bg-primary/10 rounded-md p-2 mt-1"><CheckCircle className="size-5 text-primary" /></div>
                    <div className="flex flex-col">
                        <h2
                            className="text-base font-medium"
                        >
                            Thanks for the feedback!
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            If you have any suggestions or feedback, please let us know.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onDismiss}
                        className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 ml-auto"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // Review prompt (shown up to 3 times)
    return (
        <div className="space-y-3 animate-slideUp w-full">
            <div className="flex items-start justify-start gap-x-2 w-full border-b border-border pb-2">
                <div className="flex items-center justify-center bg-primary/10 rounded-md p-2 mt-1"><CheckCircle className="size-5 text-primary" /></div>
                <div className="flex flex-col">
                    <h2
                        className="text-base font-medium"
                    >
                        Great!
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Lets spread the word and grow the community!
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDismiss}
                    className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 ml-auto"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex gap-2">
                <Button
                    variant="default"
                    size="sm"
                    onClick={onReviewClick}
                    className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700"
                >
                    <Star className="w-4 h-4 mr-1.5" />
                    Review on the Chrome Web Store
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onGitHubClick}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <Star className="w-4 h-4 mr-1.5" />
                    Star it on GitHub
                </Button>
            </div>
        </div>
    );
}
