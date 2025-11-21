import { StatusSection, StatusSectionContent, StatusSectionDescription, StatusSectionHeader, StatusSectionTitle, StatusSectionBody, StatusSectionActions } from './components/StatusSection';
import { ShieldX, RefreshCw, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NoPermissionProps {
    currentUrl: string | null;
    handleRetry: () => void;
    isRetrying: boolean;
    openSettings: () => void;
}

export function NoPermission({ currentUrl, handleRetry, isRetrying, openSettings }: NoPermissionProps) {
    return (
        <StatusSection>
            <StatusSectionContent>
                <StatusSectionHeader icon={ShieldX}>
                    <div className="flex flex-col">
                        <StatusSectionTitle>No Write Access</StatusSectionTitle>
                        <StatusSectionDescription>
                            Your account lacks permissions for this site
                        </StatusSectionDescription>
                    </div>
                </StatusSectionHeader>
                <StatusSectionBody className="space-y-4 mt-3">
                    {/* Current URL */}
                    {currentUrl && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500">Current page</Label>
                            <p className="text-xs truncate bg-white px-2 py-1.5 rounded-md font-mono text-gray-700">
                                {currentUrl}
                            </p>
                        </div>
                    )}

                    <Separator className="bg-gray-200" />

                    <Alert className="border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-600">
                        <ShieldX className="h-4 w-4" />
                        <AlertTitle className="text-sm font-medium">Permission Required</AlertTitle>
                        <AlertDescription className="text-xs">
                            This site exists in Matomo, but your API token doesn't have write access.
                            You need at least "Write" permission to capture heatmap screenshots.
                        </AlertDescription>
                    </Alert>

                    {/* Potential fixes */}
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-600 font-medium flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" />
                            How to fix
                        </Label>
                        <ul className="text-xs text-gray-600 space-y-1.5 pl-1">
                            <li className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">1.</span>
                                <span>Ask a Matomo admin to grant you "Write" or "Admin" access</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">2.</span>
                                <span>Or use an API token from a user with sufficient permissions</span>
                            </li>
                        </ul>
                    </div>
                </StatusSectionBody>
            </StatusSectionContent>
            <StatusSectionActions>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="flex-1"
                >
                    {isRetrying ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="size-3.5" />
                    )}
                    Retry
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={openSettings}
                    className="flex-1"
                >
                    <Settings className="size-3.5" />
                    Settings
                </Button>
            </StatusSectionActions>
        </StatusSection>
    );
}
