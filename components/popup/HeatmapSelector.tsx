import { useState, useEffect } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
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
  siteName?: string;
  onRefetch?: () => void;
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
  siteName,
  onRefetch,
}: HeatmapSelectorProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTimeout, setSpinTimeout] = useState<NodeJS.Timeout | null>(null);

  // Track refetching state and ensure minimum spin duration
  useEffect(() => {
    if (isRefetching && !isSpinning) {
      // Start spinning
      setIsSpinning(true);

      // Clear any existing timeout
      if (spinTimeout) {
        clearTimeout(spinTimeout);
      }
    } else if (!isRefetching && isSpinning) {
      // Refetch completed, but ensure we spin for at least 600ms (one full rotation)
      const timeout = setTimeout(() => {
        setIsSpinning(false);
      }, 600);
      setSpinTimeout(timeout);
    }

    return () => {
      if (spinTimeout) {
        clearTimeout(spinTimeout);
      }
    };
  }, [isRefetching]);

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
            No heatmaps found for <strong>{siteName || 'this site'}</strong>. Please create a heatmap in Matomo first.
          </p>
        </div>
        <Button onClick={onRefetch || onOpenSettings} variant="secondary" fullWidth disabled={isSpinning}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
          Reload Heatmaps
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="heatmap" className="block text-sm font-medium text-gray-700 mb-2">
          Select Heatmap
        </label>
        <div className="flex gap-2">
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
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-200 transition-colors cursor-pointer"
          >
            <option value="">Select a heatmap...</option>
            {heatmaps.map((heatmap) => (
              <option key={heatmap.idsitehsr} value={heatmap.idsitehsr}>
                {heatmap.name} (ID: {heatmap.idsitehsr}) - {heatmap.status === 'ended' ? 'Ended' : 'Active'}
              </option>
            ))}
          </select>
          <button
            onClick={onRefetch}
            disabled={isSpinning || !onRefetch}
            className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reload heatmaps"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isSpinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
