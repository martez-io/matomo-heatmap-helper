import { useEffect, useState } from 'react';
import { sendToContentScript, getCurrentTab } from '@/lib/messaging';
import type { ScrollTrackerStatus } from '@/types/messages';

export function useScrollTracking(isTracking: boolean) {
  const [status, setStatus] = useState<ScrollTrackerStatus>({
    scrolledCount: 0,
    scrollables: [],
    isTracking: false,
  });

  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(async () => {
      try {
        const tab = await getCurrentTab();
        const response = await sendToContentScript(tab.id!, {
          action: 'getStatus',
        });

        if ('scrolledCount' in response) {
          setStatus(response);
        }
      } catch (error) {
        console.error('[useScrollTracking] Failed to get status:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isTracking]);

  return status;
}
