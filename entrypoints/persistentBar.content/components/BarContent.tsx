/**
 * Bar content component
 * Main content row with heatmap selector, status badges, and action buttons
 */

import type { MatomoHeatmap } from '@/types/matomo';
import { HeatmapDropdown } from './HeatmapDropdown';
import { ActionButtons } from './ActionButtons';

interface BarContentProps {
    heatmaps: MatomoHeatmap[];
    selectedHeatmap: MatomoHeatmap | null;
    isInteractiveMode: boolean;
    isProcessing: boolean;
    onSelectHeatmap: (heatmap: MatomoHeatmap) => void;
    onToggleInteractive: () => void;
    onTakeScreenshot: () => void;
}

export function BarContent({
    heatmaps,
    selectedHeatmap,
    isInteractiveMode,
    isProcessing,
    onSelectHeatmap,
    onToggleInteractive,
    onTakeScreenshot,
}: BarContentProps) {
    return (
        <div className="flex items-center gap-3">
            {/* Heatmap dropdown */}
            <HeatmapDropdown
                heatmaps={heatmaps}
                selectedHeatmap={selectedHeatmap}
                onSelect={onSelectHeatmap}
            />


            {/* Action buttons */}
            <ActionButtons
                isInteractiveMode={isInteractiveMode}
                isProcessing={isProcessing}
                hasSelectedHeatmap={selectedHeatmap !== null}
                onToggleInteractive={onToggleInteractive}
                onTakeScreenshot={onTakeScreenshot}
            />
        </div>
    );
}
