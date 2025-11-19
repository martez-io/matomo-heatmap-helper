import { useState, useEffect } from 'react';
import { Lock, Check } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { sendToContentScript, getCurrentTab } from '@/lib/messaging';

interface InteractiveLockingCardProps {
  isActive: boolean;
  onExit: (lockedCount: number) => void;
  onError: (error: string) => void;
}

export function InteractiveLockingCard({ isActive, onExit, onError }: InteractiveLockingCardProps) {
  const [lockedCount, setLockedCount] = useState(0);

  // Poll for locked element count every 500ms while active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const tab = await getCurrentTab();
        const status = await sendToContentScript(tab.id!, { action: 'getLockedElements' });
        if ('lockedCount' in status) {
          setLockedCount(status.lockedCount);
        }
      } catch (err) {
        console.error('[InteractiveLockingCard] Failed to fetch locked count:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  async function handleExit() {
    try {
      const tab = await getCurrentTab();
      await sendToContentScript(tab.id!, { action: 'exitInteractiveMode' });

      // Fetch final locked count
      const status = await sendToContentScript(tab.id!, { action: 'getLockedElements' });
      const finalCount = 'lockedCount' in status ? status.lockedCount : 0;

      onExit(finalCount);
    } catch (err) {
      onError('Failed to exit interactive mode');
    }
  }

  if (!isActive) return null;

  return (
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
      <Button onClick={handleExit} variant="secondary" fullWidth>
        <Check className="mr-2 h-4 w-4" />
        Done Locking
      </Button>
    </div>
  );
}
