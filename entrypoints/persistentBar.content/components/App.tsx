/**
 * Main App component for persistent bar
 * Assembles all components and manages state
 */

import { useState } from 'react';
import { useBarState } from '../hooks/useBarState';
import {
    toggleInteractiveMode,
    selectHeatmap,
    takeScreenshot,
    dismissError,
    toggleMinimized,
    openSettings,
    openBugReport,
    closeBar,
    ignoreElement,
} from '../lib/actions';
import { ElementStack } from './ElementStack';
import { logger } from '@/lib/logger';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { BarHeader } from './BarHeader';
import { BarContent } from './BarContent';
import { ProcessingView } from './ProcessingView';
import { ErrorMessage } from './ErrorMessage';
import { MinimizeTab } from './MinimizeTab';
import { MessageCarousel } from './MessageCarousel';
import { EntranceAnimation, useEntranceAnimation } from './EntranceAnimation';

function BarContainer() {
    const { state, dispatch } = useBarState();
    const { isBarVisible } = useEntranceAnimation();
    const [animationComplete, setAnimationComplete] = useState(false);

    // Track when animation completes (isBarVisible stays true after animation)
    if (isBarVisible && !animationComplete) {
        // Small delay to ensure the entrance animation has finished
        setTimeout(() => setAnimationComplete(true), 3000);
    }

    logger.debug('App', 'Rendering with state:', {
        isMinimized: state.isMinimized,
        selectedHeatmap: state.selectedHeatmap?.idsitehsr,
        heatmapCount: state.heatmaps.length,
        isProcessing: state.isProcessing,
        processingStep: state.processingStep,
        siteId: state.siteId,
        siteName: state.siteName,
    });

    // Don't render if site info not loaded yet
    if (!state.siteId || !state.siteName) {
        logger.debug('App', 'Waiting for site info to load...');
        return null;
    }

    // Determine transform based on animation and minimize state
    const getTransformClass = () => {
        if (!isBarVisible) {
            // During entrance animation - bar is hidden below screen
            return '-translate-x-1/2 translate-y-full';
        }
        if (state.isMinimized && animationComplete) {
            // After animation, minimized
            return '-translate-x-1/2 translate-y-full';
        }
        // Visible state
        return '-translate-x-1/2 translate-y-0';
    };

    return (
        <div
            className={`fixed bottom-0 left-1/2 z-[999999] transition-transform duration-[3000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${getTransformClass()}`}
            role="region"
            aria-label="Matomo Heatmap Helper Controls"
        >
            {/* Main bar content */}
            <Card className="bg-background rounded-t-xl shadow-2xl border-primary border-2 rounded-b-none border-b-0 min-w-[min(90vw,600px)] max-w-[min(95vw,630px)]">
                {/* Hide header during processing */}
                {!(state.isProcessing && state.processingStep) && (
                    <CardHeader className="pt-3 pb-2 px-3">
                        <BarHeader
                            siteName={state.siteName}
                            isMinimized={state.isMinimized}
                            onToggleMinimize={() => toggleMinimized(state.isMinimized, dispatch)}
                            onOpenSettings={() => openSettings(dispatch)}
                            onOpenBugReport={() => openBugReport(dispatch)}
                            onCloseBar={() => closeBar(dispatch)}
                        />
                    </CardHeader>
                )}

                <CardContent className="space-y-3 pb-4 px-3">
                    {/* Normal mode: show heatmap selector and actions */}
                    {!(state.isProcessing && state.processingStep) && (
                        <>
                            <BarContent
                                heatmaps={state.heatmaps}
                                selectedHeatmap={state.selectedHeatmap}
                                isInteractiveMode={state.isInteractiveMode}
                                isProcessing={state.isProcessing}
                                onSelectHeatmap={(heatmap) => selectHeatmap(heatmap, dispatch)}
                                onToggleInteractive={() => toggleInteractiveMode(state.isInteractiveMode, dispatch)}
                                onTakeScreenshot={() =>
                                    state.selectedHeatmap &&
                                    state.siteId &&
                                    takeScreenshot(state.selectedHeatmap, state.siteId, dispatch)
                                }
                            />

                            {/* Element list showing detected and locked elements */}
                            <ElementStack
                                elements={state.elements}
                                onDismiss={ignoreElement}
                            />
                        </>
                    )}

                    {/* Processing mode: show clean single-step view */}
                    {state.isProcessing && state.processingStep && (
                        <ProcessingView currentStep={state.processingStep} />
                    )}

                    {/* Error message (always shown when error exists) */}
                    {state.error && <ErrorMessage error={state.error} onDismiss={() => dismissError(dispatch)} />}
                </CardContent>

                {/* Message carousel (always shown at bottom of card) */}
                <MessageCarousel />

            </Card>

            {/* Minimize tab (always visible for expanding when minimized) */}
            <MinimizeTab
                isMinimized={state.isMinimized}
                onToggle={() => toggleMinimized(state.isMinimized, dispatch)}
            />
        </div>
    );
}

export function App() {
    return (
        <EntranceAnimation>
            <BarContainer />
        </EntranceAnimation>
    );
}
