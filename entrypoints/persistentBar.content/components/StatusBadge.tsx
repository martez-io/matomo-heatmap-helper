/**
 * Status badge component
 * Displays tracking/locked/processing/error status with icon and count
 */

import { Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeType } from '../types';
import { MouseScrollIcon } from '@/components/icons/MouseScrollIcon';
import { MagicPointerIcon } from '@/components/icons/MagicPointerIcon';

interface StatusBadgeProps {
    type: BadgeType;
    count?: number;
}

const BADGE_CONFIG = {
    tracking: {
        icon: <MouseScrollIcon />,
        getLabel: (count = 0) => count,
        getTooltip: (count = 0) => count === 1 ? '1 element with inner scroll detected' : `${count} elements with inner scroll detected`,
        className: 'bg-info-100 text-info-700 border-info-200 hover:bg-info-100',
    },
    locked: {
        icon: <MagicPointerIcon />,
        getLabel: (count = 0) => count,
        getTooltip: (count = 0) => count === 1 ? '1 element locked' : `${count} elements locked`,
        className: 'bg-tracking-100 text-tracking-700 border-tracking-200 hover:bg-tracking-100',
    },
    processing: {
        icon: <Loader2 className="size-4 animate-spin" />,
        getLabel: () => 'Processing',
        getTooltip: () => 'Processing',
        className: 'bg-warning-100 text-warning-700 border-warning-200 hover:bg-warning-100',
    },
    error: {
        icon: <AlertCircle className="size-4" />,
        getLabel: () => 'Error',
        getTooltip: () => 'Error',
        className: 'bg-destructive-100 text-destructive-700 border-destructive-200 hover:bg-destructive-100',
    },
};

export function StatusBadge({ type, count }: StatusBadgeProps) {
    const config = BADGE_CONFIG[type];
    const Icon = config.icon;
    const label = config.getLabel(count);

    return (
        <Badge
            variant="secondary"
            className={`h-9 gap-1.5`}
            role="status"
            aria-label={config.getTooltip(count)}
            title={config.getTooltip(count)}
        >
            {Icon}
            <span>{label}</span>
        </Badge>
    );
}
