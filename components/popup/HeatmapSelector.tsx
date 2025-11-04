import { Settings, Loader2 } from 'lucide-react';
import type { MatomoHeatmap } from '@/types/matomo';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Button } from '@/components/shared/Button';

interface HeatmapSelectorProps {
  heatmaps: MatomoHeatmap[];
  selectedHeatmapId: number | null;
  onSelect: (heatmap: MatomoHeatmap) => void;
  onChange?: (heatmap: MatomoHeatmap) => void;
  isLoading: boolean;
  isRefetching?: boolean;
  error: Error | null;
  onOpenSettings: () => void;
}

export function HeatmapSelector({
  heatmaps,
  selectedHeatmapId,
  onSelect,
  onChange,
  isLoading,
  isRefetching = false,
  error,
  onOpenSettings,
}: HeatmapSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner text="Loading heatmaps..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorMessage
          title="Failed to load heatmaps"
          message={error.message}
        />
        <Button onClick={onOpenSettings} variant="secondary" fullWidth>
          <Settings className="mr-2 h-4 w-4" />
          Open Settings
        </Button>
      </div>
    );
  }

  if (heatmaps.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            No heatmaps found for this site. Please create a heatmap in Matomo first.
          </p>
        </div>
        <Button onClick={onOpenSettings} variant="secondary" fullWidth>
          <Settings className="mr-2 h-4 w-4" />
          Configure Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="heatmap" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          Select Heatmap
          {isRefetching && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
        </label>
        <select
          id="heatmap"
          value={selectedHeatmapId || ''}
          onChange={(e) => {
            const heatmap = heatmaps.find(h => h.idsitehsr === parseInt(e.target.value));
            if (heatmap) {
              onSelect(heatmap);
              if (onChange) {
                onChange(heatmap);
              }
            }
          }}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-200 transition-colors cursor-pointer"
        >
          <option value="">Select a heatmap...</option>
          {heatmaps.map((heatmap) => (
            <option key={heatmap.idsitehsr} value={heatmap.idsitehsr}>
              {heatmap.name} (ID: {heatmap.idsitehsr}) - {heatmap.status === 'ended' ? 'Ended' : 'Active'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
