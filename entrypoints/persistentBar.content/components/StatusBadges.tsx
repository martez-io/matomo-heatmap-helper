/**
 * Status badges component
 * Container for tracking and locked badges
 */

import { StatusBadge } from './StatusBadge';

interface StatusBadgesProps {
    scrolledCount: number;
    lockedCount: number;
}

export function StatusBadges({
    scrolledCount,
    lockedCount,
}: StatusBadgesProps) {

    return (
        <div className="flex items-center gap-2">
            <StatusBadge type="tracking" count={scrolledCount} />
            <StatusBadge type="locked" count={lockedCount} />
        </div>
    );
}
