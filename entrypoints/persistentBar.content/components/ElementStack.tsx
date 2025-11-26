/**
 * ElementStack component
 * Displays a stacked pile of tracked elements that expands on hover
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ElementCard } from './ElementCard';
import type { SerializedElementInfo } from '@/types/elements';
import { cn } from '@/lib/index';

interface ElementStackProps {
    elements: SerializedElementInfo[];
    onDismiss: (id: string) => void;
}

// Number of stacked cards to show visually behind the top card
const STACK_DEPTH = 3;
// Height of a single card
const CARD_HEIGHT = 36;
// Gap between cards when expanded
const CARD_GAP = 4;
// Offset between stacked cards
const STACK_OFFSET = 6;

export function ElementStack({ elements, onDismiss }: ElementStackProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
    const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, []);

    const handleMouseEnter = useCallback(() => {
        // Clear any pending collapse
        if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
        }
        setIsExpanded(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Small delay before collapsing to prevent flicker
        collapseTimeoutRef.current = setTimeout(() => {
            setIsExpanded(false);
        }, 150);
    }, []);

    const handleDismiss = useCallback((id: string) => {
        // Add to exiting set for animation
        setExitingIds(prev => new Set(prev).add(id));

        // After animation, actually dismiss
        setTimeout(() => {
            setExitingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            onDismiss(id);
        }, 200);
    }, [onDismiss]);

    if (elements.length === 0) {
        return (
            <div className="text-sm text-muted-foreground text-center py-2 border border-dashed border-muted rounded-md">
                Scroll the page and select elements that are broken in the heatmap
            </div>
        );
    }

    // Calculate heights
    const stackedHeight = CARD_HEIGHT + Math.min(elements.length - 1, STACK_DEPTH) * STACK_OFFSET;
    const expandedHeight = Math.min(
        elements.length * CARD_HEIGHT + (elements.length - 1) * CARD_GAP,
        180 // max-height
    );

    return (
        <div className="space-y-1">
            {/* Element count and expand hint */}
            <div className="text-xs text-muted-foreground flex justify-between px-1">
                <span>{elements.length} {elements.length === 1 ? 'element' : 'elements'} selected</span>
                {elements.length > 1 && !isExpanded && <span>hover to expand</span>}
            </div>

            {/* Stacked/Expanded container - animates height smoothly */}
            <div
                className={cn(
                    'relative transition-[height] duration-300 ease-out',
                    isExpanded ? 'overflow-y-auto' : 'overflow-hidden'
                )}
                style={{ height: isExpanded ? expandedHeight : stackedHeight }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Inner wrapper - provides scrollable content height when expanded */}
                <div
                    className="relative transition-[height] duration-300 ease-out"
                    style={{
                        height: isExpanded
                            ? elements.length * CARD_HEIGHT + (elements.length - 1) * CARD_GAP
                            : stackedHeight
                    }}
                >
                    {/* All cards - animate position based on expanded state */}
                    {elements.map((element, index) => {
                        // Calculate positions for both states
                        const stackIndex = Math.min(index, STACK_DEPTH);
                        const isVisible = index <= STACK_DEPTH || isExpanded;
                        const isTopInStack = index === 0;

                        // Stacked position (only first STACK_DEPTH+1 cards visible)
                        const stackedTop = stackIndex * STACK_OFFSET;
                        const stackedOpacity = isTopInStack ? 1 : 0.6 - (stackIndex * 0.15);
                        const stackedScale = 1 - stackIndex * 0.02;
                        const stackedZIndex = STACK_DEPTH - stackIndex;

                        // Expanded position
                        const expandedTop = index * (CARD_HEIGHT + CARD_GAP);

                        return (
                            <div
                                key={element.id}
                                className={cn(
                                    'absolute left-0 right-0 transition-all duration-300 ease-out',
                                    !isExpanded && !isTopInStack && 'pointer-events-none'
                                )}
                                style={{
                                    top: isExpanded ? expandedTop : stackedTop,
                                    zIndex: isExpanded ? elements.length - index : stackedZIndex,
                                    opacity: isExpanded ? 1 : (isVisible ? stackedOpacity : 0),
                                    transform: isExpanded ? 'scale(1)' : `scale(${stackedScale})`,
                                }}
                            >
                                <ElementCard
                                    element={element}
                                    onDismiss={handleDismiss}
                                    isExiting={exitingIds.has(element.id)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
