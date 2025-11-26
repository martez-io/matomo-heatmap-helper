/**
 * Heatmap dropdown component
 * Custom searchable dropdown (Shadow DOM compatible)
 */

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import type { MatomoHeatmap } from '@/types/matomo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/index';

interface HeatmapDropdownProps {
    heatmaps: MatomoHeatmap[];
    selectedHeatmap: MatomoHeatmap | null;
    onSelect: (heatmap: MatomoHeatmap) => void;
}

/**
 * Helper function to safely format match_page_rules for display
 * Handles arrays of objects with {value} property
 */
function formatMatchRules(rules: any): string {
    if (!rules) return '';
    if (typeof rules === 'string') return rules;
    if (Array.isArray(rules)) {
        return rules.map(r => (typeof r === 'object' && r.value) ? r.value : String(r)).join(', ');
    }
    return String(rules);
}

export function HeatmapDropdown({ heatmaps, selectedHeatmap, onSelect }: HeatmapDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter heatmaps based on search
    const filteredHeatmaps = heatmaps.filter((heatmap) => {
        const searchTerm = search.toLowerCase();
        const matchRules = formatMatchRules(heatmap.match_page_rules).toLowerCase();
        return heatmap.name.toLowerCase().includes(searchTerm) || matchRules.includes(searchTerm);
    });

    // Handle click outside to close
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            setSearch('');
        }
    }, [open]);

    const handleSelect = (heatmap: MatomoHeatmap) => {
        onSelect(heatmap);
        setOpen(false);
    };

    return (
        <div className="relative w-full flex-1">
            <Button
                ref={buttonRef}
                variant="secondary"
                role="combobox"
                aria-expanded={open}
                aria-label="Select heatmap"
                onClick={() => setOpen(!open)}
                className="w-full max-w-[305px] justify-between h-9 font-normal"
            >
                <span className="truncate">
                    {selectedHeatmap
                        ? `${selectedHeatmap.name} (${formatMatchRules(selectedHeatmap.match_page_rules)})`
                        : heatmaps.length === 0
                            ? 'No heatmaps available'
                            : 'Select a heatmap...'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            {open && (
                <div
                    ref={dropdownRef}
                    className="absolute bottom-full left-0 right-0 mb-2 z-50 w-full min-w-[400px] bg-background border border-border rounded-md shadow-lg overflow-hidden"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Search Input */}
                    <div className="flex items-center border-b border-border px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search heatmaps..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>

                    {/* Items List */}
                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filteredHeatmaps.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No heatmaps found.
                            </div>
                        ) : (
                            filteredHeatmaps.map((heatmap) => {
                                const matchRules = formatMatchRules(heatmap.match_page_rules);
                                const isSelected = selectedHeatmap?.idsitehsr === heatmap.idsitehsr;
                                return (
                                    <div
                                        key={heatmap.idsitehsr}
                                        onClick={() => handleSelect(heatmap)}
                                        className={cn(
                                            'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                                            'hover:bg-muted',
                                            isSelected && 'bg-muted/50'
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4 shrink-0 text-foreground',
                                                isSelected ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="font-medium truncate text-foreground">{heatmap.name}</span>
                                            <span className="text-xs text-muted-foreground truncate">{matchRules}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
