/**
 * Main App component for feedback bar
 * Orchestrates the feedback flow state machine
 */

import { useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { FeedbackBar } from './FeedbackBar';
import { RatingView } from './RatingView';
import { PositiveFeedback } from './PositiveFeedback';
import { NegativeFeedback } from './NegativeFeedback';
import { getReviewUrl, getIssueUrl } from '../lib/constants';

type FeedbackStep = 'rating' | 'positive' | 'negative' | 'dismissed';

interface AppProps {
    heatmapId: string | null;
    onDismiss: () => void;
}

export function App({ heatmapId, onDismiss }: AppProps) {
    const [step, setStep] = useState<FeedbackStep>('rating');
    const [showReviewPrompt, setShowReviewPrompt] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    /**
     * Handle thumbs up - check if we should show review prompt
     * Only prompt for review up to 3 times, then just show thanks
     */
    const handleThumbsUp = async () => {
        const promptCount = (await storage.getItem<number>('local:feedback:promptCount')) ?? 0;
        const reviewClicked = (await storage.getItem<boolean>('local:feedback:reviewClicked')) ?? false;

        const shouldPrompt = promptCount < 3 && !reviewClicked;

        if (shouldPrompt) {
            await storage.setItem<number>('local:feedback:promptCount', promptCount + 1);
        }

        setShowReviewPrompt(false);
        setStep('positive');
    };

    /**
     * Handle thumbs down - animate transition to troubleshooting
     */
    const handleThumbsDown = () => {
        setIsExiting(true);
        // Wait for exit animation, then switch view
        setTimeout(() => {
            setStep('negative');
            setIsExiting(false);
        }, 150);
    };

    /**
     * Handle review click - mark as clicked, open store
     */
    const handleReviewClick = async () => {
        await storage.setItem<boolean>('local:feedback:reviewClicked', true);
        window.open(getReviewUrl(), '_blank');
        handleDismiss();
    };

    const handleGitHubClick = () => {
        window.open('https://github.com/martez-io/matomo-heatmap-helper/', '_blank');
        handleDismiss();
    };

    /**
     * Handle report issue - open GitHub with pre-filled template
     */
    const handleReportIssue = async () => {
        const url = await getIssueUrl({
            selectedHeatmapId: heatmapId ? parseInt(heatmapId, 10) : undefined,
        });
        window.open(url, '_blank');
        handleDismiss();
    };

    /**
     * Dismiss the feedback bar
     */
    const handleDismiss = () => {
        setStep('dismissed');
        // Small delay for any exit animation, then unmount
        setTimeout(onDismiss, 100);
    };

    // Don't render if dismissed
    if (step === 'dismissed') return null;

    return (
        <FeedbackBar showConfetti={step === 'positive'}>
            {step === 'rating' && (
                <RatingView
                    onThumbsUp={handleThumbsUp}
                    onThumbsDown={handleThumbsDown}
                    isExiting={isExiting}
                />
            )}
            {step === 'positive' && (
                <PositiveFeedback
                    showReviewPrompt={showReviewPrompt}
                    onReviewClick={handleReviewClick}
                    onDismiss={handleDismiss}
                    onGitHubClick={handleGitHubClick}
                />
            )}
            {step === 'negative' && (
                <NegativeFeedback
                    onReportIssue={handleReportIssue}
                    onDismiss={handleDismiss}
                />
            )}
        </FeedbackBar>
    );
}
