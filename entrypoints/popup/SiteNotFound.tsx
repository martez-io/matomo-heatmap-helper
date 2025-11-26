import { StatusSection, StatusSectionContent, StatusSectionDescription, StatusSectionHeader, StatusSectionTitle, StatusSectionBody, StatusSectionActions } from './components/StatusSection';
import { Globe, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface SiteNotFoundProps {
    handleRetry: () => void;
    isRetrying: boolean;
    openMatomoSites: () => void;
}


export function SiteNotFound({ handleRetry, isRetrying, openMatomoSites }: SiteNotFoundProps) {
    return (
        <StatusSection>
            <StatusSectionContent>
                <StatusSectionHeader icon={Globe}>
                    <div className="flex flex-col">
                        <StatusSectionTitle>Site Not Found</StatusSectionTitle>
                        <StatusSectionDescription>
                            This page isn't tracked in your Matomo
                        </StatusSectionDescription>
                    </div>
                </StatusSectionHeader>
                <StatusSectionBody>
                    <h5 className="text-sm font-medium text-muted-foreground mb-2 mt-3">Potential reasons:</h5>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>This domain isn't added as a website in Matomo</li>
                        <li>The URL configured in Matomo doesn't match this page</li>
                        <li>You're on a local/staging environment not tracked</li>
                    </ul>
                </StatusSectionBody>
            </StatusSectionContent>
            <StatusSectionActions>
                <Button
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
                    variant="secondary"
                    onClick={openMatomoSites}
                    className="flex-1"
                >
                    <ExternalLink className="size-3.5" />
                    Manage Sites
                </Button>
            </StatusSectionActions>
        </StatusSection>
    );
}
