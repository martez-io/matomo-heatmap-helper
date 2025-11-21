import { Button } from '@/components/ui/button';
import { ChevronUpIcon } from 'lucide-react';

interface MinimizeTabProps {
    isMinimized: boolean;
    onToggle: () => void;
}

export function MinimizeTab({ isMinimized, onToggle }: MinimizeTabProps) {
    return (
        <Button
            variant="secondary"
            className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-white rounded-t-lg shadow-lg border border-primary border-b-0 broder-r-b-none px-4 py-1 transition-opacity ${isMinimized ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            onClick={onToggle}
            aria-label="Expand bar"
        >
            < ChevronUpIcon className="size-4" />
        </Button>
    );
}
