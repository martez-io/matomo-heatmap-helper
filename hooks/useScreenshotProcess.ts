import { useState, useCallback } from 'react';
import { getCredentials } from '@/lib/storage';
import { sendToContentScript, getCurrentTab, triggerMatomoScreenshot, sendToBackground } from '@/lib/messaging';
import { createMatomoClient } from '@/lib/matomo-api';
import type { MatomoHeatmap } from '@/types/matomo';

type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

interface ScreenshotProcessResult {
  executeScreenshot: () => Promise<void>;
  processingStep: ProcessingStep;
  error: string | null;
  isProcessing: boolean;
}

export function useScreenshotProcess(selectedHeatmap: MatomoHeatmap | null): ScreenshotProcessResult {
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('validating');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const executeScreenshot = useCallback(async () => {
    if (!selectedHeatmap) return;

    setIsProcessing(true);
    setError(null);

    try {
      const tab = await getCurrentTab();
      const creds = await getCredentials();
      if (!creds) throw new Error('No credentials');

      // Exit interactive mode if active
      const statusResponse = await sendToContentScript(tab.id!, { action: 'getStatus' });
      if ('isInteractiveMode' in statusResponse && statusResponse.isInteractiveMode) {
        console.log('[Screenshot] Exiting interactive mode before screenshot');
        await sendToContentScript(tab.id!, { action: 'exitInteractiveMode' });
      }

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
      setIsProcessing(false);
    }
  }, [selectedHeatmap]);

  return {
    executeScreenshot,
    processingStep,
    error,
    isProcessing,
  };
}
