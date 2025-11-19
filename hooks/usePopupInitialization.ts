import { useState, useEffect, useCallback } from 'react';
import { getCredentials } from '@/lib/storage';
import { sendToContentScript, getCurrentTab, checkMatomoExists } from '@/lib/messaging';
import { resolveSiteForCurrentTab } from '@/lib/site-resolver';

type AppState = 'loading' | 'onboarding' | 'no-matomo' | 'no-site' | 'no-permission' | 'selection' | 'tracking' | 'processing' | 'complete';

interface PopupInitializationResult {
  state: AppState;
  resolvedSiteId: number | null;
  siteName: string | null;
  isRetrying: boolean;
  retryInitialize: () => Promise<void>;
  setState: (state: AppState) => void;
}

export function usePopupInitialization(): PopupInitializationResult {
  const [state, setState] = useState<AppState>('loading');
  const [resolvedSiteId, setResolvedSiteId] = useState<number | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const initialize = useCallback(async () => {
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
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const retryInitialize = useCallback(async () => {
    setIsRetrying(true);
    await initialize();
  }, [initialize]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    state,
    resolvedSiteId,
    siteName,
    isRetrying,
    retryInitialize,
    setState,
  };
}
