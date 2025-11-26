import { StatusSection, StatusSectionContent, StatusSectionDescription, StatusSectionHeader, StatusSectionTitle, StatusSectionBody, StatusSectionActions } from './components/StatusSection';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatomoIcon } from '@/components/icons/MatomoIcon';

interface SiteInfo {
    siteId: number;
    siteName: string;
}

interface ControlCenterProps {
    barEnabled: boolean;
    toggleBar: (checked: boolean) => void;
    siteInfo: SiteInfo | null;
}

export function ControlCenter({ barEnabled, toggleBar, siteInfo }: ControlCenterProps) {
    return (
        <StatusSection>
            <StatusSectionContent>
                <StatusSectionHeader icon={LayoutDashboard}>
                    <div className="flex flex-col">
                        <StatusSectionTitle>You are ready to go!</StatusSectionTitle>
                        <StatusSectionDescription>
                            Get started capturing heatmaps and screenshots.
                        </StatusSectionDescription>
                    </div>
                </StatusSectionHeader>
                <StatusSectionBody className="space-y-4 mt-3">
                    {/* Connected Site Badge */}
                    {siteInfo && (
                        <div className="flex items-center gap-2 bg-success-50 dark:bg-success-800 border border-success-200 dark:border-success-800 rounded-lg px-3 py-2">
                            <MatomoIcon className="h-4 w-4 text-success-700 dark:text-success-300" />
                            <span className="text-sm font-medium text-success-800 dark:text-success-200">{siteInfo.siteName}</span>
                            <Badge variant="secondary" className="ml-auto text-[10px] bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-300 border-0">
                                Connected
                            </Badge>
                        </div>
                    )}
                </StatusSectionBody>
            </StatusSectionContent>
            <StatusSectionActions>
                <Button
                    onClick={() => toggleBar(!barEnabled)}
                    variant={barEnabled ? 'secondary' : 'default'}
                    className="flex-1"
                >
                    {barEnabled ? (
                        <>
                            <EyeOff className="size-3.5" />
                            Close Control Center
                        </>
                    ) : (
                        <>
                            <Eye className="size-3.5" />
                            Get Started
                        </>
                    )}
                </Button>
            </StatusSectionActions>
        </StatusSection>
    );
}
