/**
 * ElementCard component
 * Displays the fixes that will be applied to a tracked element
 */

import { X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SerializedElementInfo } from '@/types/elements';
import { cn } from '@/lib/index';

interface ElementCardProps {
    element: SerializedElementInfo;
    onDismiss: (id: string) => void;
    isExiting?: boolean;
}

export function ElementCard({ element, onDismiss, isExiting }: ElementCardProps) {
    // Format fixes for display - join with bullet separator
    const fixesText = element.fixes.length > 0
        ? element.fixes.join(' · ')
        : 'No fix detected';

    return (
        <div
            className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 bg-muted',
                isExiting && 'opacity-0 -translate-x-2'
            )}
        >
            {/* Fix icon */}
            <Wrench className="size-3.5 shrink-0 text-muted-foreground" />

            {/* Tag badge */}
            <code className="px-1 py-0.5 bg-foreground/5 rounded text-[10px] font-mono shrink-0">
                &lt;{element.tag}&gt;
            </code>

            {/* Fix descriptions */}
            <span className="flex-1 text-xs text-foreground/80 truncate" title={fixesText}>
                {fixesText}
            </span>

            {/* Dismiss button */}
            <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDismiss(element.id)}
                title="Ignore this element"
            >
                <X className="size-3" />
            </Button>
        </div>
    );
}
