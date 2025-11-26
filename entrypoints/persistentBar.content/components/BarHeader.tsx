/**
 * Bar header component
 * Site name and minimize button
 */

import { useState, useRef, useEffect } from 'react';
import { Bug, ChevronDown, MoreHorizontal, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatomoIcon } from '@/components/icons/MatomoIcon';
import { StatusBadges } from './StatusBadges';

interface BarHeaderProps {
    siteName: string | null;
    isMinimized: boolean;
    scrolledCount: number;
    lockedCount: number;
    onToggleMinimize: () => void;
    onOpenSettings: () => void;
    onOpenBugReport: () => void;
    onCloseBar: () => void;
}

export function BarHeader({ siteName, isMinimized, scrolledCount, lockedCount, onToggleMinimize, onOpenSettings, onOpenBugReport, onCloseBar }: BarHeaderProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Handle click outside to close menu
    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleMenuAction = (action: () => void) => {
        action();
        setMenuOpen(false);
    };

    return (
        <div className="flex items-center justify-between border-b-1 border-border pb-2">
            {/* Site name and logo */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-secondary rounded-md py-2 px-3">
                    <MatomoIcon className="h-5 w-5 text-foreground" />
                    <span className="text-sm font-medium text-foreground">
                        {siteName || 'Matomo Heatmap Helper'}
                    </span>
                </div>

                {/* Status badges */}
                <StatusBadges
                    scrolledCount={scrolledCount}
                    lockedCount={lockedCount}
                />
            </div>

            <div className="flex items-center gap-2">
                {/* Minimize button */}
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onToggleMinimize}
                    aria-label={isMinimized ? 'Expand bar' : 'Minimize bar'}
                    title="Minimize bar"
                >
                    <ChevronDown className="h-4 w-4" />
                </Button>

                {/* Menu button - Shadow DOM compatible */}
                <div className="relative">
                    <Button
                        ref={buttonRef}
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-expanded={menuOpen}
                        title="Menu"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>

                    {/* Custom dropdown menu (no portal for Shadow DOM compatibility) */}
                    {menuOpen && (
                        <div
                            ref={menuRef}
                            className="absolute right-0 bottom-full mb-1 z-50 w-42 bg-background border border-border rounded-md shadow-lg overflow-hidden"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-col p-1 gap-y-1">
                                <Button
                                    variant="secondary"
                                    className="justify-start"
                                    onClick={() => handleMenuAction(onOpenSettings)}
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Settings</span>
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="justify-start"
                                    onClick={() => handleMenuAction(onOpenBugReport)}
                                >
                                    <Bug className="h-4 w-4" />
                                    <span>Report Bug</span>
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="justify-start"
                                    onClick={() => handleMenuAction(onCloseBar)}
                                >
                                    <X className="h-4 w-4" />
                                    <span>Close Bar</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
