import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { MatomoHeatmap } from '@/types/matomo';

interface SuccessViewProps {
  selectedHeatmap: MatomoHeatmap | null;
  onRestore: () => void;
  onReset: () => void;
}

export function SuccessView({ selectedHeatmap, onRestore, onReset }: SuccessViewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-success-50 border-2 border-success-200 rounded-lg p-4">
        <p className="text-success-800 font-medium">✓ Screenshot captured successfully!</p>
        <p className="text-sm text-success-700 mt-2">
          Heatmap: <strong>{selectedHeatmap?.name}</strong> (ID: {selectedHeatmap?.idsitehsr})
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onRestore} variant="secondary" fullWidth>
          Restore Layout
        </Button>
        <Button onClick={onReset} fullWidth>
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
