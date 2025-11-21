import { StatusSection, StatusSectionContent, StatusSectionDescription, StatusSectionHeader, StatusSectionTitle, StatusSectionBody, StatusSectionActions } from './components/StatusSection';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UnconfiguredProps {
    openSettings: () => void;
}

export function Unconfigured({ openSettings }: UnconfiguredProps) {
    return (
        <StatusSection>
            <StatusSectionContent>
                <StatusSectionHeader icon={Settings}>
                    <div className="flex flex-col">
                        <StatusSectionTitle>Setup Required</StatusSectionTitle>
                        <StatusSectionDescription>
                            Configure your Matomo credentials to get started
                        </StatusSectionDescription>
                    </div>
                </StatusSectionHeader>
                <StatusSectionBody>
                    <p className="text-xs text-gray-600 mt-3">
                        Thanks for installing the Matomo Heatmap Screenshots extension!
                        Open the settings and add your Matomo credentials to get started.
                    </p>
                </StatusSectionBody>
            </StatusSectionContent>
            <StatusSectionActions>
                <Button
                    onClick={openSettings}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
                >
                    <Settings className="size-3.5" />
                    Open Settings
                </Button>
            </StatusSectionActions>
        </StatusSection>
    );
}
