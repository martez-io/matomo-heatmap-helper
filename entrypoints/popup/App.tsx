import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Camera, Play, StopCircle, RotateCcw, Settings, Lock, Check } from 'lucide-react';
import { useHeatmaps } from '@/hooks/useHeatmaps';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { HeatmapSelector } from '@/components/popup/HeatmapSelector';
import { ScrollTracker } from '@/components/popup/ScrollTracker';
import { StatusFeedback } from '@/components/popup/StatusFeedback';
import { Onboarding } from '@/components/popup/Onboarding';
import { Button } from '@/components/shared/Button';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getStorage, setStorage, getCredentials } from '@/lib/storage';
import { sendToContentScript, getCurrentTab, triggerMatomoScreenshot, checkMatomoExists, sendToBackground } from '@/lib/messaging';
import { createMatomoClient } from '@/lib/matomo-api';
import type { MatomoHeatmap } from '@/types/matomo';

const queryClient = new QueryClient();

type AppState = 'loading' | 'onboarding' | 'no-matomo' | 'selection' | 'tracking' | 'processing' | 'complete';
type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

interface PopupContentProps {
  onOpenSettings: () => void;
}

function PopupContent({ onOpenSettings }: PopupContentProps) {
  const [state, setState] = useState<AppState>('loading');
  const [selectedHeatmap, setSelectedHeatmap] = useState<MatomoHeatmap | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('validating');
  const [error, setError] = useState<string | null>(null);
  const [hasMato, setHasMatomo] = useState(true);
  const [bypassedCheck, setBypassedCheck] = useState(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [lockedCount, setLockedCount] = useState(0);

  const [cachedHeatmaps, setCachedHeatmaps] = useState<MatomoHeatmap[]>([]);
  const { data: freshHeatmaps, isLoading: heatmapsLoading, error: heatmapsError, isFetching: heatmapsFetching } = useHeatmaps();
  const heatmaps = freshHeatmaps || cachedHeatmaps;
  const trackingStatus = useScrollTracking(state === 'tracking');

  // Pre-load cached heatmaps immediately on mount
  useEffect(() => {
    async function loadCache() {
      const creds = await getCredentials();
      if (creds) {
        const cache = await getStorage('cache:heatmaps');
        if (cache && cache.siteId === creds.siteId) {
          const isFresh = Date.now() - cache.timestamp < 5 * 60 * 1000;
          if (isFresh) {
            console.log('[Popup] Using cached heatmaps for instant display');
            setCachedHeatmaps(cache.heatmaps);
          }
        }
      }
    }
    loadCache();
  }, []);

  // Restore selected heatmap when heatmaps load
  useEffect(() => {
    async function restoreSelection() {
      if (heatmaps.length > 0 && !selectedHeatmap) {
        const savedHeatmapId = await getStorage('ui:selectedHeatmapId');
        if (savedHeatmapId) {
          const heatmap = heatmaps.find(h => h.idsitehsr === savedHeatmapId);
          if (heatmap) {
            console.log('[Popup] Restored selected heatmap:', heatmap.name);
            setSelectedHeatmap(heatmap);

            // Auto-start tracking if we're in selection state (not already tracking)
            if (state === 'selection') {
              console.log('[Popup] Auto-starting tracking for restored heatmap');
              handleHeatmapChange(heatmap);
            }
          }
        }
      }
    }
    restoreSelection();
  }, [heatmaps, selectedHeatmap, state]);

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
      setHasMatomo(hasMatomoOnPage);

      if (!hasMatomoOnPage) {
        setState('no-matomo');
        return;
      }

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

      if (response.success) {
        setState('tracking');
        setError(null);
      } else {
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

        if (!response.success) {
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

        if (response.success) {
          setState('tracking');
          setError(null);
        } else {
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
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setState('tracking');
    }
  }

  async function handleReset() {
    setState(hasMatomo || bypassedCheck ? 'selection' : 'no-matomo');
    setError(null);
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
      url: browser.runtime.getURL('options.html'),
      openerTabId: currentTab?.id,
    });
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-[400px] p-5">
        <div className="mb-6 relative">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <img src="/logo.png" alt="Matomo Logo" className="w-6 h-6" />
            Matomo Heatmap Helper
          </h1>
          <p className="text-xs text-gray-600 mt-1">Prepare pages for heatmap screenshots</p>
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
