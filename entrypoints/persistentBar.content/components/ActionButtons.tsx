/**
 * Action buttons component
 * Interactive mode toggle and screenshot button
 */

import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MagicPointerIcon } from '@/components/icons/MagicPointerIcon';

interface ActionButtonsProps {
    isInteractiveMode: boolean;
    isProcessing: boolean;
    hasSelectedHeatmap: boolean;
    onToggleInteractive: () => void;
    onTakeScreenshot: () => void;
}

export function ActionButtons({
    isInteractiveMode,
    isProcessing,
    hasSelectedHeatmap,
    onToggleInteractive,
    onTakeScreenshot,
}: ActionButtonsProps) {
    return (
        <div className="flex items-center gap-2 ml-auto">
            {/* Interactive mode toggle button */}
            {!isProcessing && (
                <Button
                    variant={isInteractiveMode ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={onToggleInteractive}
                    aria-label={isInteractiveMode ? 'Exit select mode' : 'Enter select mode'}
                    aria-pressed={isInteractiveMode}
                >
                    {isInteractiveMode ? <MagicPointerIcon className="size-4 animate-wiggle text-gray-100" /> : <MagicPointerIcon className="size-6" />}
                    <span>{isInteractiveMode ? 'Done selecting' : 'Select elements'}</span>
                </Button>
            )}

            {/* Screenshot button */}
            <Button
                variant="default"
                size="sm"
                onClick={onTakeScreenshot}
                disabled={isProcessing || !hasSelectedHeatmap}
                aria-label="Take screenshot"
                className="bg-orange-500 hover:bg-orange-600"
            >
                {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Camera className="h-4 w-4" />
                )}
                <span>{isProcessing ? 'Processing...' : 'Screenshot'}</span>
            </Button>
        </div>
    );
}
