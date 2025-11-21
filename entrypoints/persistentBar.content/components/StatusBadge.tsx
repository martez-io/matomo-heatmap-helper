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
        className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
    },
    locked: {
        icon: <MagicPointerIcon />,
        getLabel: (count = 0) => count,
        getTooltip: (count = 0) => count === 1 ? '1 element locked' : `${count} elements locked`,
        className: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100',
    },
    processing: {
        icon: <Loader2 className="size-4 animate-spin" />,
        getLabel: () => 'Processing',
        getTooltip: () => 'Processing',
        className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100',
    },
    error: {
        icon: <AlertCircle className="size-4" />,
        getLabel: () => 'Error',
        getTooltip: () => 'Error',
        className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
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
