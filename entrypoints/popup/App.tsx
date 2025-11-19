import { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Camera, Lock } from 'lucide-react';
import { useHeatmaps } from '@/hooks/useHeatmaps';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { usePopupInitialization } from '@/hooks/usePopupInitialization';
import { useScreenshotProcess } from '@/hooks/useScreenshotProcess';
import { HeatmapSelector } from '@/components/popup/HeatmapSelector';
import { ScrollTracker } from '@/components/popup/ScrollTracker';
import { Onboarding } from '@/components/popup/Onboarding';
import { ErrorStateView } from '@/components/popup/ErrorStateView';
import { InteractiveLockingCard } from '@/components/popup/InteractiveLockingCard';
import { SuccessView } from '@/components/popup/SuccessView';
import { ProcessingView } from '@/components/popup/ProcessingView';
import { PopupHeader } from '@/components/popup/PopupHeader';
import { Button } from '@/components/shared/Button';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getStorage, setStorage, removeStorage } from '@/lib/storage';
import { sendToContentScript, getCurrentTab, checkMatomoExists } from '@/lib/messaging';
import { generateBugReportUrl } from '@/lib/github-issue';
import type { MatomoHeatmap } from '@/types/matomo';

const queryClient = new QueryClient();

interface PopupContentProps {
    onOpenSettings: () => void;
}

function PopupContent({ onOpenSettings }: PopupContentProps) {
    // Use initialization hook for initial state management
    const { state, setState, resolvedSiteId, siteName, isRetrying, retryInitialize } = usePopupInitialization();

    // Local state for selection, tracking, and UI
    const [selectedHeatmap, setSelectedHeatmap] = useState<MatomoHeatmap | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [bypassedCheck, setBypassedCheck] = useState(false);
    const [isInteractiveMode, setIsInteractiveMode] = useState(false);
    const [cachedHeatmaps, setCachedHeatmaps] = useState<MatomoHeatmap[]>([]);

    // Hooks
    const { data: freshHeatmaps, isLoading: heatmapsLoading, error: heatmapsError, isFetching: heatmapsFetching, refetchFromServer } = useHeatmaps(resolvedSiteId);
    const heatmaps = freshHeatmaps ?? cachedHeatmaps;
    const trackingStatus = useScrollTracking(state === 'tracking');
    const { executeScreenshot, processingStep, error: screenshotError, isProcessing } = useScreenshotProcess(selectedHeatmap);
    const hasAutoStarted = useRef(false);

    // Pre-load cached heatmaps immediately on mount (if site is resolved)
    useEffect(() => {
        async function loadCache() {
            if (!resolvedSiteId) return;

            const cache = await getStorage('cache:heatmaps');
            if (cache && cache[resolvedSiteId]) {
                const siteCache = cache[resolvedSiteId];
                const isFresh = Date.now() - siteCache.timestamp < 5 * 60 * 1000;
                if (isFresh) {
                    console.log(`[Popup] Using cached heatmaps for site ${resolvedSiteId}`);
                    setCachedHeatmaps(siteCache.heatmaps);
                }
            }
        }
        loadCache();
    }, [resolvedSiteId]);

    // Restore selected heatmap from storage when heatmaps load
    useEffect(() => {
        async function restoreSelection() {
            // If heatmaps is empty, clear any stale selection
            if (heatmaps.length === 0 && selectedHeatmap !== null) {
                console.log('[Popup] No heatmaps available, clearing selection');
                setSelectedHeatmap(null);
                await removeStorage('ui:selectedHeatmapId');
                return;
            }

            if (heatmaps.length > 0 && !selectedHeatmap) {
                const savedHeatmapId = await getStorage('ui:selectedHeatmapId');
                if (savedHeatmapId) {
                    const heatmap = heatmaps.find(h => h.idsitehsr === savedHeatmapId);
                    if (heatmap) {
                        console.log('[Popup] Restored selected heatmap:', heatmap.name);
                        setSelectedHeatmap(heatmap);
                    } else {
                        // Heatmap ID exists but not in current list - clear it
                        console.log('[Popup] Saved heatmap ID not found in list, clearing');
                        await removeStorage('ui:selectedHeatmapId');
                    }
                }
            }
        }
        restoreSelection();
    }, [heatmaps, selectedHeatmap]);

    // Auto-start tracking when we have a selected heatmap and are in selection state
    useEffect(() => {
        if (selectedHeatmap && state === 'selection' && !hasAutoStarted.current) {
            console.log('[Popup] Auto-starting tracking for selected heatmap:', selectedHeatmap.name);
            hasAutoStarted.current = true;
            handleHeatmapChange(selectedHeatmap);
        }

        // Reset the flag when state changes away from selection/tracking
        if (state !== 'selection' && state !== 'tracking') {
            hasAutoStarted.current = false;
        }
    }, [selectedHeatmap, state]);

    // Sync screenshot error with local error state
    useEffect(() => {
        if (screenshotError) {
            setError(screenshotError);
        }
    }, [screenshotError]);

    // Sync processing state with main state
    useEffect(() => {
        if (isProcessing) {
            setState('processing');
        }
    }, [isProcessing, setState]);

    // Restore interactive mode state when popup reopens
    useEffect(() => {
        async function restoreInteractiveState() {
            if (state === 'tracking') {
                try {
                    const tab = await getCurrentTab();
                    const status = await sendToContentScript(tab.id!, { action: 'getStatus' });
                    if ('isInteractiveMode' in status) {
                        setIsInteractiveMode(status.isInteractiveMode);
                        console.log('[Popup] Restored interactive mode state:', status.isInteractiveMode);
                    }
                } catch (err) {
                    console.error('[Popup] Failed to restore interactive state:', err);
                }
            }
        }
        restoreInteractiveState();
    }, [state]);

    // Event handlers
    async function handleSelectHeatmap(heatmap: MatomoHeatmap) {
        setSelectedHeatmap(heatmap);
        await setStorage('ui:selectedHeatmapId', heatmap.idsitehsr);
    }

    async function startHeatmapTracking(heatmap: MatomoHeatmap) {
        try {
            const tab = await getCurrentTab();
            const response = await sendToContentScript(tab.id!, {
                action: 'startTracking',
                heatmapId: heatmap.idsitehsr,
            });

            if ('success' in response && response.success) {
                setState('tracking');
                setError(null);
            } else if ('success' in response && !response.success) {
                setError('Failed to start tracking');
            }
        } catch (err) {
            setError('Failed to initialize tracking. Please refresh the page.');
        }
    }

    async function handleHeatmapChange(heatmap: MatomoHeatmap) {
        // If currently tracking, stop current and restart with new heatmap
        if (state === 'tracking') {
            try {
                const tab = await getCurrentTab();
                await sendToContentScript(tab.id!, { action: 'stopTracking' });
            } catch (err) {
                console.error('[Popup] Failed to stop tracking:', err);
            }
        }

        // Start tracking with the heatmap
        await startHeatmapTracking(heatmap);
    }

    async function handleEnterLockMode() {
        try {
            const tab = await getCurrentTab();
            const response = await sendToContentScript(tab.id!, { action: 'enterInteractiveMode' });

            if ('success' in response && response.success) {
                setIsInteractiveMode(true);
                setError(null);
                window.close(); // Close popup so user can immediately interact with page
            } else {
                setError('Failed to enter interactive mode');
            }
        } catch (err) {
            setError('Failed to enter interactive mode');
        }
    }

    function handleExitLockMode(lockedCount: number) {
        setIsInteractiveMode(false);
        console.log(`[Popup] Exited interactive mode with ${lockedCount} locked elements`);
    }

    async function handleTakeScreenshot() {
        setError(null);
        await executeScreenshot();
    }

    async function handleRestore() {
        try {
            const tab = await getCurrentTab();
            await sendToContentScript(tab.id!, { action: 'restore' });
        } catch (err) {
            setError('Failed to restore layout');
        }
    }

    // Render based on state
    if (state === 'loading') {
        return (
            <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" text="Initializing..." />
            </div>
        );
    }

    if (state === 'onboarding') {
        return <Onboarding onOpenSettings={onOpenSettings} />;
    }

    if (state === 'no-matomo' && !bypassedCheck) {
        return (
            <ErrorStateView
                errorType="no-matomo"
                onRetry={retryInitialize}
                onSettings={onOpenSettings}
                onBypass={() => { setBypassedCheck(true); setState('selection'); }}
                isRetrying={isRetrying}
            />
        );
    }

    if (state === 'no-site') {
        return (
            <ErrorStateView
                errorType="no-site"
                onRetry={retryInitialize}
                onSettings={onOpenSettings}
                isRetrying={isRetrying}
            />
        );
    }

    if (state === 'no-permission') {
        return (
            <ErrorStateView
                errorType="no-permission"
                onRetry={retryInitialize}
                onSettings={onOpenSettings}
                isRetrying={isRetrying}
            />
        );
    }

    if (state === 'selection') {
        return (
            <div className="space-y-4">
                <HeatmapSelector
                    heatmaps={heatmaps}
                    selectedHeatmapId={selectedHeatmap?.idsitehsr || null}
                    onSelect={handleSelectHeatmap}
                    onChange={handleHeatmapChange}
                    isLoading={heatmapsLoading}
                    isRefetching={heatmapsFetching && !heatmapsLoading}
                    error={heatmapsError as Error | null}
                    onOpenSettings={onOpenSettings}
                    siteName={siteName || undefined}
                    onRefetch={() => refetchFromServer()}
                />
                {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
            </div>
        );
    }

    if (state === 'tracking') {
        return (
            <div className="space-y-4">
                <HeatmapSelector
                    heatmaps={heatmaps}
                    selectedHeatmapId={selectedHeatmap?.idsitehsr || null}
                    onSelect={handleSelectHeatmap}
                    onChange={handleHeatmapChange}
                    isLoading={heatmapsLoading}
                    isRefetching={heatmapsFetching && !heatmapsLoading}
                    error={heatmapsError as Error | null}
                    onOpenSettings={onOpenSettings}
                    siteName={siteName || undefined}
                    onRefetch={() => refetchFromServer()}
                />
                <ScrollTracker
                    count={trackingStatus.scrolledCount}
                    scrollables={trackingStatus.scrollables}
                />

                {/* Interactive Height Locking */}
                {!isInteractiveMode && (
                    <Button onClick={handleEnterLockMode} variant="secondary" fullWidth>
                        <Lock className="mr-2 h-4 w-4" />
                        Lock dynamic elements
                    </Button>
                )}

                <InteractiveLockingCard
                    isActive={isInteractiveMode}
                    onExit={handleExitLockMode}
                    onError={setError}
                />

                {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
                <Button onClick={handleTakeScreenshot} fullWidth>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Screenshot
                </Button>
            </div>
        );
    }

    if (state === 'processing') {
        return <ProcessingView currentStep={processingStep} />;
    }

    if (state === 'complete') {
        return (
            <SuccessView
                selectedHeatmap={selectedHeatmap}
                onRestore={handleRestore}
                onReset={retryInitialize}
            />
        );
    }

    return null;
}

export default function App() {
    async function openSettings() {
        // Get the current tab ID to pass as opener
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        // Create a new tab with the options page
        browser.tabs.create({
            url: '/options.html',
            openerTabId: currentTab?.id,
        });
    }

    async function openBugReport() {
        try {
            // Collect context for bug report
            let matomoDetected = false;

            try {
                const tab = await getCurrentTab();
                matomoDetected = await checkMatomoExists(tab.id!);
            } catch (err) {
                console.warn('[Popup] Could not check Matomo existence:', err);
            }

            // Generate bug report URL with context
            const bugReportUrl = await generateBugReportUrl({
                matomoDetected,
            });

            // Open in new tab
            browser.tabs.create({
                url: bugReportUrl,
                active: true,
            });
        } catch (err) {
            console.error('[Popup] Failed to open bug report:', err);
        }
    }

    return (
        <QueryClientProvider client={queryClient}>
            <div className="w-[500px] p-5">
                <PopupHeader onOpenSettings={openSettings} onOpenBugReport={openBugReport} />
                <PopupContent onOpenSettings={openSettings} />
            </div>
        </QueryClientProvider>
    );
}
