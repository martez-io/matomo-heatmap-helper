/**
 * Main App component for persistent bar
 * Assembles all components and manages state
 */

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
} from '../lib/actions';
import { logger } from '@/lib/logger';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { BarHeader } from './BarHeader';
import { BarContent } from './BarContent';
import { ProcessingView } from './ProcessingView';
import { ErrorMessage } from './ErrorMessage';
import { MinimizeTab } from './MinimizeTab';
import { MessageCarousel } from './MessageCarousel';

export function App() {
    const { state, dispatch } = useBarState();

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

    return (
        <div
            className={`fixed bottom-0 left-1/2 z-[999999] transition-transform duration-300 ease-in-out ${state.isMinimized ? '-translate-x-1/2 translate-y-full' : '-translate-x-1/2 translate-y-0'
                }`}
            role="region"
            aria-label="Matomo Heatmap Helper Controls"
        >
            {/* Main bar content */}
            <Card className="bg-background rounded-t-xl shadow-2xl border-primary border-2 rounded-b-none border-b-0 min-w-[min(90vw,600px)] max-w-[min(95vw,630px)]">
                {/* Hide header during processing */}
                {!(state.isProcessing && state.processingStep) && (
                    <CardHeader className="pt-3 pb-6 px-3">
                        <BarHeader
                            siteName={state.siteName}
                            isMinimized={state.isMinimized}
                            scrolledCount={state.scrolledCount}
                            lockedCount={state.lockedCount}
                            onToggleMinimize={() => toggleMinimized(state.isMinimized, dispatch)}
                            onOpenSettings={() => openSettings(dispatch)}
                            onOpenBugReport={() => openBugReport(dispatch)}
                            onCloseBar={() => closeBar(dispatch)}
                        />
                    </CardHeader>
                )}

                <CardContent className="space-y-3 pb-6 px-3">
                    {/* Normal mode: show heatmap selector and actions */}
                    {!(state.isProcessing && state.processingStep) && (
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
