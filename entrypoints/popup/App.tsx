/**
 * Popup - Control Center for enabling/disabling the Persistent Bar
 * Includes site resolution to match persistent bar behavior
 */
import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Settings, Bug, Loader2 } from 'lucide-react';
import { getStorage, setStorage, getCredentials } from '@/lib/storage';
import { generateBugReportUrl } from '@/lib/github-issue';
import { getCurrentTab } from '@/lib/messaging';
import { resolveSiteForCurrentTab, type ResolutionResult } from '@/lib/site-resolver';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SiteNotFound } from './SiteNotFound';
import { Unconfigured } from './Unconfigured';
import { NoPermission } from './NoPermission';
import { ControlCenter } from './ControlCenter';

type PopupState = 'loading' | 'unconfigured' | 'no-site' | 'no-permission' | 'ready';

interface SiteInfo {
    siteId: number;
    siteName: string;
}

export default function App() {
    const [state, setState] = useState<PopupState>('loading');
    const [barEnabled, setBarEnabled] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    async function initialize() {
        setState('loading');
        await logger.init();

        // Get current URL for display
        try {
            const tab = await getCurrentTab();
            setCurrentUrl(tab?.url || '');
        } catch (err) {
            logger.warn('Popup', 'Could not get current tab:', err);
        }

        // Check credentials first
        const creds = await getCredentials();
        if (!creds) {
            setState('unconfigured');
            return;
        }

        // Get current bar state
        const barVisible = await getStorage('state:barVisible');
        setBarEnabled(barVisible === true);

        // Resolve site for current tab
        try {
            const result: ResolutionResult = await resolveSiteForCurrentTab();

            if (!result.success) {
                logger.debug('Popup', 'Site resolution failed:', result.error);
                if (result.error === 'no-credentials') {
                    setState('unconfigured');
                } else if (result.error === 'no-permission') {
                    setState('no-permission');
                } else {
                    setState('no-site');
                }
                return;
            }

            setSiteInfo({
                siteId: result.siteId,
                siteName: result.siteName,
            });
            setState('ready');
        } catch (err) {
            logger.error('Popup', 'Site resolution error:', err);
            setState('no-site');
        }
    }

    useEffect(() => {
        initialize();
    }, []);

    async function handleRetry() {
        setIsRetrying(true);
        await initialize();
        setIsRetrying(false);
    }

    async function toggleBar(checked: boolean) {
        setBarEnabled(checked);
        await setStorage('state:barVisible', checked);

        // Reload current tab to apply changes
        try {
            const tab = await getCurrentTab();
            if (tab?.id) {
                await browser.tabs.reload(tab.id);
            }
        } catch (err) {
            logger.error('Popup', 'Failed to reload tab:', err);
        }
    }

    async function openSettings() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        browser.tabs.create({
            url: '/options.html',
            openerTabId: tabs[0]?.id,
        });
    }

    async function openBugReport() {
        try {
            const bugReportUrl = await generateBugReportUrl({ matomoDetected: false });
            browser.tabs.create({ url: bugReportUrl, active: true });
        } catch (err) {
            logger.error('Popup', 'Failed to open bug report:', err);
        }
    }

    function openMatomoSites() {
        // Open Matomo sites management page
        getCredentials().then((creds) => {
            if (creds?.apiUrl) {
                const matomoUrl = new URL(creds.apiUrl);
                browser.tabs.create({
                    url: `${matomoUrl.origin}/index.php?module=SitesManager&action=index`,
                    active: true,
                });
            }
        });
    }

    function renderContent() {
        switch (state) {
            case 'loading':
                return (
                    <div className="flex items-center justify-center py-8 space-x-2">
                        <Loader2 className="size-6 animate-spin text-primary-600" />
                        <span className="text-sm text-gray-600">Getting things ready...</span>
                    </div>
                );
            case 'unconfigured':
                return <Unconfigured openSettings={openSettings} />;
            case 'no-site':
                return (
                    <SiteNotFound
                        handleRetry={handleRetry}
                        isRetrying={isRetrying}
                        openMatomoSites={openMatomoSites}
                    />
                );
            case 'no-permission':
                return (
                    <NoPermission
                        currentUrl={currentUrl}
                        handleRetry={handleRetry}
                        isRetrying={isRetrying}
                        openSettings={openSettings}
                    />
                );
            case 'ready':
                return (
                    <ControlCenter
                        barEnabled={barEnabled}
                        toggleBar={toggleBar}
                        siteInfo={siteInfo}
                    />
                );
        }
    }

    return (
        <div className="w-[420px] p-4">
            <PopupHeader onOpenSettings={openSettings} onOpenBugReport={openBugReport} />
            {renderContent()}
        </div>
    );
}

function PopupHeader({
    onOpenSettings,
    onOpenBugReport,
}: {
    onOpenSettings: () => void;
    onOpenBugReport: () => void;
}) {
    return (
        <div className="mb-4 relative">
            <div className="flex items-start gap-2">
                <img src="/logo.png" alt="Logo" className="size-11" />
                <div>
                    <h1 className="text-xl font-bold text-gray-900 -mb-1.5">Heatmap Helper</h1>
                    <span className="text-[10px] text-gray-500 font-semibold">
                        By Martez
                    </span>
                </div>
                <Badge
                    variant="default"
                    className="mt-2 bg-gradient-to-r from-amber-500 to-amber-600 text-[8px] uppercase tracking-wide border-0 text-white"
                >
                    Beta
                </Badge>
            </div>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenBugReport}
                    title="Report a Bug"
                    className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                    <Bug className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Settings"
                    className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
