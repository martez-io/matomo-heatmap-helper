/**
 * Popup - Control Center for enabling/disabling the Persistent Bar
 * Includes site resolution to match persistent bar behavior
 */
import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Settings, Bug, Loader2 } from 'lucide-react';
import { getStorage, setStorage, getCredentials, getAvailableSites, saveDomainSiteMapping, setAnimationPending } from '@/lib/storage';
import { generateBugReportUrl } from '@/lib/github-issue';
import { getCurrentTab } from '@/lib/messaging';
import { resolveSiteForCurrentTab, extractDomain, type ResolutionResult } from '@/lib/site-resolver';
import { createMatomoClient } from '@/lib/matomo-api';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SiteNotFound } from './SiteNotFound';
import { Unconfigured } from './Unconfigured';
import { NoPermission } from './NoPermission';
import { ControlCenter } from './ControlCenter';
import { SiteSelector } from './SiteSelector';
import type { MatomoSite } from '@/types/matomo';

type PopupState = 'loading' | 'unconfigured' | 'no-site' | 'no-permission' | 'site-selection' | 'ready';

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
    const [availableSites, setAvailableSites] = useState<MatomoSite[]>([]);
    const [defaultSiteId, setDefaultSiteId] = useState<number | undefined>(undefined);
    const [isFetchingSites, setIsFetchingSites] = useState(false);

    async function initialize() {
        setState('loading');
        await logger.init();

        // Get current URL for display
        let tabUrl = '';
        try {
            const tab = await getCurrentTab();
            tabUrl = tab?.url || '';
            setCurrentUrl(tabUrl);
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

        // Check if enforce mode is enabled
        const enforceEnabled = await getStorage('enforce:enabled');
        logger.debug('Popup', 'Enforce mode:', enforceEnabled);

        // Pre-fetch sites if enforce mode is enabled (to avoid duplicate API calls)
        let sitesForSelector: MatomoSite[] | null = null;
        if (enforceEnabled) {
            setIsFetchingSites(true);
            try {
                sitesForSelector = await getAvailableSites();
                if (!sitesForSelector || sitesForSelector.length === 0) {
                    const client = createMatomoClient(creds.apiUrl, creds.authToken);
                    sitesForSelector = await client.getSitesWithWriteAccess();
                }
            } catch (fetchErr) {
                logger.error('Popup', 'Failed to pre-fetch sites:', fetchErr);
            }
            setIsFetchingSites(false);
        }

        // Try normal auto-resolution first (both modes)
        try {
            const result: ResolutionResult = await resolveSiteForCurrentTab();

            if (result.success) {
                // Auto-resolution succeeded - use this site
                logger.debug('Popup', 'Site auto-resolved:', result.siteId, result.siteName);

                // Save as non-enforced domain mapping
                const domain = extractDomain(tabUrl);
                if (domain) {
                    await saveDomainSiteMapping(domain, result.siteId, result.siteName, false);
                }

                setSiteInfo({
                    siteId: result.siteId,
                    siteName: result.siteName,
                });
                setState('ready');
                return;
            }

            // Auto-resolution failed
            logger.debug('Popup', 'Site resolution failed:', result.error);

            // Handle based on enforce mode
            if (enforceEnabled && sitesForSelector && sitesForSelector.length > 0) {
                // Enforce mode ON + auto-resolve failed → show site selector
                logger.debug('Popup', 'Enforce mode enabled, showing site selector');
                setAvailableSites(sitesForSelector);
                setDefaultSiteId(sitesForSelector[0].idsite);
                setState('site-selection');
                return;
            }

            if (enforceEnabled && (!sitesForSelector || sitesForSelector.length === 0)) {
                logger.error('Popup', 'No sites available');
                setState('no-permission');
                return;
            }

            // Enforce mode OFF + auto-resolve failed → show appropriate error
            if (result.error === 'no-credentials') {
                setState('unconfigured');
            } else if (result.error === 'no-permission') {
                setState('no-permission');
            } else {
                setState('no-site');
            }
        } catch (err) {
            logger.error('Popup', 'Site resolution error:', err);

            if (enforceEnabled && sitesForSelector && sitesForSelector.length > 0) {
                // Enforce mode ON + error → show site selector with pre-fetched sites
                setAvailableSites(sitesForSelector);
                setDefaultSiteId(sitesForSelector[0].idsite);
                setState('site-selection');
                return;
            }

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

    async function handleSiteSelection(siteId: number, siteName: string) {
        logger.debug('Popup', 'User selected site:', siteId, siteName);

        // Save as enforced domain mapping
        const domain = extractDomain(currentUrl);
        if (domain) {
            await saveDomainSiteMapping(domain, siteId, siteName, true);
            logger.debug('Popup', 'Saved enforced mapping for domain:', domain);
        }

        setSiteInfo({ siteId, siteName });
        setState('ready');

        // Reload tab to apply enforced tracker
        try {
            const tab = await getCurrentTab();
            if (tab?.id) {
                await browser.tabs.reload(tab.id);
            }
        } catch (err) {
            logger.warn('Popup', 'Could not reload tab:', err);
        }
    }

    async function toggleBar(checked: boolean) {
        setBarEnabled(checked);

        // Set animation pending flag when enabling (so entrance animation knows to play)
        if (checked) {
            await setAnimationPending(true);
        }

        await setStorage('state:barVisible', checked);

        // Only reload when disabling the bar (to restore any locked/expanded elements)
        // When enabling, the content script's storage watcher will mount the bar dynamically
        if (!checked) {
            try {
                const tab = await getCurrentTab();
                if (tab?.id) {
                    await browser.tabs.reload(tab.id);
                }
            } catch (err) {
                logger.error('Popup', 'Failed to reload tab:', err);
            }
        }

        // Close the popup after toggling
        window.close();
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
                        <span className="text-sm text-muted-foreground">Getting things ready...</span>
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
            case 'site-selection':
                return (
                    <SiteSelector
                        sites={availableSites}
                        defaultSiteId={defaultSiteId}
                        onSelect={handleSiteSelection}
                        isLoading={isFetchingSites}
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
                    <h1 className="text-xl font-bold text-foreground -mb-1.5">Heatmap Helper</h1>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                        By Martez
                    </span>
                </div>
                <Badge
                    variant="default"
                    className="mt-2 bg-gradient-to-r from-primary-500 to-primary-600 text-[8px] uppercase tracking-wide border-0 text-white"
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
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                    <Bug className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Settings"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
