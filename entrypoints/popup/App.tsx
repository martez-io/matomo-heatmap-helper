import { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Camera, RotateCcw, Settings, Lock, Check, Bug } from 'lucide-react';
import { useHeatmaps } from '@/hooks/useHeatmaps';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { HeatmapSelector } from '@/components/popup/HeatmapSelector';
import { ScrollTracker } from '@/components/popup/ScrollTracker';
import { StatusFeedback } from '@/components/popup/StatusFeedback';
import { Onboarding } from '@/components/popup/Onboarding';
import { Button } from '@/components/shared/Button';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getStorage, setStorage, getCredentials, removeStorage } from '@/lib/storage';
import { sendToContentScript, getCurrentTab, triggerMatomoScreenshot, checkMatomoExists, sendToBackground } from '@/lib/messaging';
import { createMatomoClient } from '@/lib/matomo-api';
import { resolveSiteForCurrentTab } from '@/lib/site-resolver';
import { generateBugReportUrl } from '@/lib/github-issue';
import type { MatomoHeatmap } from '@/types/matomo';

const queryClient = new QueryClient();

type AppState = 'loading' | 'onboarding' | 'no-matomo' | 'no-site' | 'no-permission' | 'selection' | 'tracking' | 'processing' | 'complete';
type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

interface PopupContentProps {
    onOpenSettings: () => void;
}

function PopupContent({ onOpenSettings }: PopupContentProps) {
    const [state, setState] = useState<AppState>('loading');
    const [selectedHeatmap, setSelectedHeatmap] = useState<MatomoHeatmap | null>(null);
    const [processingStep, setProcessingStep] = useState<ProcessingStep>('validating');
    const [error, setError] = useState<string | null>(null);
    const [bypassedCheck, setBypassedCheck] = useState(false);
    const [isInteractiveMode, setIsInteractiveMode] = useState(false);
    const [lockedCount, setLockedCount] = useState(0);
    const [resolvedSiteId, setResolvedSiteId] = useState<number | null>(null);
    const [siteName, setSiteName] = useState<string>('');
    const [isRetrying, setIsRetrying] = useState(false);

    const [cachedHeatmaps, setCachedHeatmaps] = useState<MatomoHeatmap[]>([]);
    const { data: freshHeatmaps, isLoading: heatmapsLoading, error: heatmapsError, isFetching: heatmapsFetching, refetchFromServer } = useHeatmaps(resolvedSiteId);
    const heatmaps = freshHeatmaps ?? cachedHeatmaps;
    const trackingStatus = useScrollTracking(state === 'tracking');
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

    // Effect 1: Restore selected heatmap from storage when heatmaps load
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

    // Effect 2: Auto-start tracking when we have a selected heatmap and are in selection state
    useEffect(() => {
        // Only auto-start if:
        // 1. We have a selected heatmap
        // 2. We're in the selection state
        // 3. We haven't already auto-started
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

    // Check Matomo and initialize on mount
    useEffect(() => {
        initialize();
    }, []);

    // Poll for locked elements count when in interactive mode
    useEffect(() => {
        if (!isInteractiveMode) return;

        const interval = setInterval(async () => {
            try {
                const tab = await getCurrentTab();
                const status = await sendToContentScript(tab.id!, { action: 'getLockedElements' });
                if ('lockedCount' in status) {
                    setLockedCount(status.lockedCount);
                }
            } catch (err) {
                console.error('[Popup] Failed to fetch locked count:', err);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isInteractiveMode]);

    async function initialize() {
        try {
            // Check credentials
            const creds = await getCredentials();
            if (!creds) {
                setState('onboarding');
                return;
            }

            // Check if Matomo exists on page
            const tab = await getCurrentTab();
            const hasMatomoOnPage = await checkMatomoExists(tab.id!);

            if (!hasMatomoOnPage) {
                setState('no-matomo');
                return;
            }

            // Resolve site for current domain
            console.log('[Popup] Resolving site for current tab...');
            const resolution = await resolveSiteForCurrentTab();

            if (!resolution.success) {
                if (resolution.error === 'no-site') {
                    setState('no-site');
                } else if (resolution.error === 'no-permission') {
                    setState('no-permission');
                } else {
                    setState('onboarding');
                }
                return;
            }

            // Site resolved successfully
            console.log(`[Popup] Resolved to site: ${resolution.siteName} (ID: ${resolution.siteId})`);
            setResolvedSiteId(resolution.siteId);
            setSiteName(resolution.siteName);

            // Check if content script is already tracking
            try {
                const status = await sendToContentScript(tab.id!, { action: 'getStatus' });
                if ('isTracking' in status && status.isTracking) {
                    console.log('[Popup] Content script is tracking, restoring tracking state');
                    setState('tracking');
                    return;
                }
            } catch (err) {
                console.log('[Popup] Could not get tracking status, assuming not tracking');
            }

            setState('selection');
        } catch (err) {
            console.error('[Popup] Initialization error:', err);
            setState('selection');
        }
    }

    async function retryInitialize() {
        setIsRetrying(true);
        await initialize();
        setIsRetrying(false);
    }

    async function handleSelectHeatmap(heatmap: MatomoHeatmap) {
        setSelectedHeatmap(heatmap);
        await setStorage('ui:selectedHeatmapId', heatmap.idsitehsr);
    }

    async function handleStartTracking() {
        if (!selectedHeatmap) return;

        try {
            const tab = await getCurrentTab();
            const response = await sendToContentScript(tab.id!, {
                action: 'startTracking',
                heatmapId: selectedHeatmap.idsitehsr,
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
        // If currently tracking, stop and restart with new heatmap
        if (state === 'tracking') {
            try {
                const tab = await getCurrentTab();

                // Stop current tracking
                await sendToContentScript(tab.id!, { action: 'stopTracking' });

                // Immediately start tracking with new heatmap
                const response = await sendToContentScript(tab.id!, {
                    action: 'startTracking',
                    heatmapId: heatmap.idsitehsr,
                });

                if ('success' in response && !response.success) {
                    setError('Failed to switch heatmap');
                }
            } catch (err) {
                setError('Failed to switch heatmap');
            }
        } else {
            // Not tracking yet, start tracking with selected heatmap
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

    async function handleExitLockMode() {
        try {
            const tab = await getCurrentTab();
            await sendToContentScript(tab.id!, { action: 'exitInteractiveMode' });
            setIsInteractiveMode(false);

            // Fetch locked count
            const status = await sendToContentScript(tab.id!, { action: 'getLockedElements' });
            if ('lockedCount' in status) {
                setLockedCount(status.lockedCount);
            }
        } catch (err) {
            setError('Failed to exit interactive mode');
        }
    }

    async function handleTakeScreenshot() {
        if (!selectedHeatmap) return;

        setState('processing');
        setError(null);

        try {
            const tab = await getCurrentTab();
            const creds = await getCredentials();
            if (!creds) throw new Error('No credentials');

            // Show scanner animation
            await sendToContentScript(tab.id!, { action: 'showScanner' });

            // Step 1: Validate heatmap
            setProcessingStep('validating');
            const client = createMatomoClient(creds.apiUrl, creds.authToken);

            if (selectedHeatmap.capture_manually === 0) {
                await client.updateHeatmap({ ...selectedHeatmap, capture_manually: 1 });
            }

            if (selectedHeatmap.status === 'ended') {
                await client.resumeHeatmap(selectedHeatmap.idsite, selectedHeatmap.idsitehsr);
            }

            // Step 2: Expand elements
            setProcessingStep('expanding');
            const expandResponse = await sendToContentScript(tab.id!, {
                action: 'expandElements',
            });

            if (!expandResponse.success) {
                throw new Error('Failed to expand elements');
            }

            // Step 3: Trigger Matomo screenshot
            setProcessingStep('capturing');
            const matomoResponse = await triggerMatomoScreenshot(tab.id!, selectedHeatmap.idsitehsr);

            if (!matomoResponse.success) {
                throw new Error(matomoResponse.error || 'Failed to trigger screenshot');
            }

            // Step 4: Verify screenshot
            setProcessingStep('verifying');
            const verified = await client.waitForScreenshotCapture(
                selectedHeatmap.idsite,
                selectedHeatmap.idsitehsr
            );

            if (!verified) {
                throw new Error('Screenshot verification failed');
            }

            // Restore layout to original state
            console.log('[Popup] Restoring layout after successful screenshot');
            await sendToContentScript(tab.id!, { action: 'restore' });

            // Success!
            setProcessingStep('complete');
            setState('complete');

            // Send to background to handle animations and tab creation
            if (selectedHeatmap.heatmapViewUrl) {
                let heatmapUrl = `${creds.apiUrl}/${selectedHeatmap.heatmapViewUrl}`;
                heatmapUrl = heatmapUrl.replace('&token_auth=' + creds.authToken, '');
                await sendToBackground({
                    action: 'onSuccessfulScreenshot',
                    url: heatmapUrl,
                    tabId: tab.id!,
                });
                window.close();
            }
        } catch (err) {
            console.error('[Popup] Screenshot error:', err);

            // Hide the scanner animation when error occurs
            try {
                const tab = await getCurrentTab();
                await sendToContentScript(tab.id!, { action: 'hideScanner' });
            } catch (scannerErr) {
                console.error('[Popup] Failed to hide scanner:', scannerErr);
            }

            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            setState('tracking');
        }
    }

    async function handleReset() {
        // Re-initialize to check current state
        initialize();
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
            <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                    <h2 className="font-bold text-amber-900 mb-2">⚠️ Matomo Not Detected</h2>
                    <p className="text-sm text-amber-800">
                        This page doesn't appear to have Matomo installed.
                    </p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium">Common reasons:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Page doesn't use Matomo tracking</li>
                        <li>Matomo is still loading</li>
                        <li>Ad blocker is blocking Matomo</li>
                    </ul>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => initialize()} variant="secondary">
                        Retry Check
                    </Button>
                    <Button onClick={() => { setBypassedCheck(true); setState('selection'); }}>
                        Continue Anyway
                    </Button>
                </div>
            </div>
        );
    }

    if (state === 'no-site') {
        return (
            <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                    <h2 className="font-bold text-amber-900 mb-2">⚠️ Site Not Found</h2>
                    <p className="text-sm text-amber-800">
                        The current domain is not listed in any of your sites in the Matomo dashboard.
                    </p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium">To use this extension:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Add this domain to your Matomo sites</li>
                        <li>Ensure the site is properly configured</li>
                        <li>Refresh this popup after adding the site</li>
                    </ul>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={retryInitialize}
                        variant="secondary"
                        isLoading={isRetrying}
                        disabled={isRetrying}
                    >
                        Retry Detection
                    </Button>
                    <Button onClick={onOpenSettings} disabled={isRetrying}>
                        Open Settings
                    </Button>
                </div>
            </div>
        );
    }

    if (state === 'no-permission') {
        return (
            <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <h2 className="font-bold text-red-900 mb-2">🔒 Insufficient Permissions</h2>
                    <p className="text-sm text-red-800">
                        You need at least write permission for this site to capture heatmap screenshots.
                    </p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium">To use this extension:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Request write access for this site in Matomo</li>
                        <li>Ask your Matomo administrator for permissions</li>
                        <li>Refresh this popup after permissions are granted</li>
                    </ul>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={retryInitialize}
                        variant="secondary"
                        isLoading={isRetrying}
                        disabled={isRetrying}
                    >
                        Retry Detection
                    </Button>
                    <Button onClick={onOpenSettings} disabled={isRetrying}>
                        Open Settings
                    </Button>
                </div>
            </div>
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
                    siteName={siteName}
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
                    siteName={siteName}
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

                {isInteractiveMode && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock className="w-5 h-5 text-amber-600" />
                            <h3 className="font-semibold text-amber-900">Interactive Mode Active</h3>
                        </div>
                        <p className="text-sm text-amber-800 mb-3">
                            Click elements on the page to lock their heights. Locked elements will be expanded during screenshot.
                        </p>
                        <div className="flex items-center justify-between text-sm text-amber-900 mb-3">
                            <span className="font-medium">Locked elements:</span>
                            <span className="font-bold">{lockedCount}</span>
                        </div>
                        <Button onClick={handleExitLockMode} variant="secondary" fullWidth>
                            <Check className="mr-2 h-4 w-4" />
                            Done Locking
                        </Button>
                    </div>
                )}

                {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
                <Button onClick={handleTakeScreenshot} fullWidth>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Screenshot
                </Button>
            </div>
        );
    }

    if (state === 'processing') {
        return (
            <div className="space-y-4">
                <StatusFeedback currentStep={processingStep} />
            </div>
        );
    }

    if (state === 'complete') {
        return (
            <div className="space-y-4">
                <div className="bg-success-50 border-2 border-success-200 rounded-lg p-4">
                    <p className="text-success-800 font-medium">✓ Screenshot captured successfully!</p>
                    <p className="text-sm text-success-700 mt-2">
                        Heatmap: <strong>{selectedHeatmap?.name}</strong> (ID: {selectedHeatmap?.idsitehsr})
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleRestore} variant="secondary" fullWidth>
                        Restore Layout
                    </Button>
                    <Button onClick={handleReset} fullWidth>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Start Over
                    </Button>
                </div>
            </div>
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
                <div className="mb-6 relative">
                    <div className="flex items-start gap-2">
                        <img src="/logo.png" alt="Matomo Heatmap Helper Logo" className="size-11" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 -mb-1.5">
                                Heatmap Helper
                            </h1>
                            <span style={{ fontSize: '10px' }} className="text-gray-900/80 font-bold">By Martez</span>

                        </div>
                        <span className="px-2 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full uppercase tracking-wide mt-2">
                            Beta
                        </span>
                    </div>
                    <button
                        onClick={openBugReport}
                        className="absolute top-1/2 right-12 -translate-y-1/2 text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
                        title="Report a Bug"
                    >
                        <Bug className="w-5 h-5" />
                    </button>
                    <button
                        onClick={openSettings}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
                <PopupContent onOpenSettings={openSettings} />
            </div>
        </QueryClientProvider>
    );
}
