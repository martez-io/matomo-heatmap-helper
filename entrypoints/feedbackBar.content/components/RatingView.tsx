/**
 * RatingView component
 * Initial view with thumbs up/down rating buttons
 */

import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RatingViewProps {
    onThumbsUp: () => void;
    onThumbsDown: () => void;
    isExiting?: boolean;
}

export function RatingView({ onThumbsUp, onThumbsDown, isExiting }: RatingViewProps) {
    return (
        <div
            className={`flex items-center justify-between gap-4 transition-opacity duration-150 ${isExiting ? 'opacity-0' : 'opacity-100'
                }`}
        >
            <span className="text-sm font-medium text-gray-700">
                Does the heatmap match the actual page?
            </span>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onThumbsUp}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                    <ThumbsUp className="w-4 h-4 mr-1.5" />
                    Yes
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onThumbsDown}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                >
                    <ThumbsDown className="w-4 h-4 mr-1.5" />
                    No, view help
                </Button>
            </div>
        </div>
    );
}
