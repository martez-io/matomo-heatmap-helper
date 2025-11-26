/**
 * Options page for configuring Matomo API credentials.
 *
 * Security note: Credentials are stored in chrome.storage.local, which is isolated
 * by the browser and inaccessible to web pages. Only this extension can read them.
 */

import { useState, useEffect } from 'react';
import { Settings, Trash2, Bug, ArrowRightLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, saveCredentials, clearCredentials, saveAvailableSites, getDebugMode, setDebugMode, getEnforceTracker, setEnforceTracker, getEnforcedDomainMappings, removeEnforcedDomainMapping, clearAllEnforcedMappings } from '@/lib/storage';
import { CredentialsForm } from '@/entrypoints/options/CredentialsForm';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { Collapsible } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

type ValidationState = 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';

export default function App() {
    const [validationStatus, setValidationStatus] = useState<ValidationState>('idle');
    const [currentCredentials, setCurrentCredentials] = useState<{
        apiUrl: string;
        authToken: string;
    } | null>(null);
    const [validatedCredentials, setValidatedCredentials] = useState<{
        apiUrl: string;
        authToken: string;
    } | null>(null);
    const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
    const [debugModeEnabled, setDebugModeEnabled] = useState(false);
    const [enforceTrackerEnabled, setEnforceTrackerEnabled] = useState(false);
    const [enforcedDomains, setEnforcedDomains] = useState<Array<{ domain: string; siteId: number; siteName: string }>>([]);

    // Load existing credentials and settings on mount
    useEffect(() => {
        loadExistingCredentials();
        loadSettings();
        loadEnforcedDomains();
    }, []);

    async function loadSettings() {
        const debugMode = await getDebugMode();
        setDebugModeEnabled(debugMode);

        const enforceTracker = await getEnforceTracker();
        setEnforceTrackerEnabled(enforceTracker);
    }

    async function handleDebugModeChange(enabled: boolean) {
        setDebugModeEnabled(enabled);
        await setDebugMode(enabled);
        toast.success(`Debug mode ${enabled ? 'enabled' : 'disabled'}`, { duration: 2000 });
    }

    async function handleEnforceTrackerChange(enabled: boolean) {
        setEnforceTrackerEnabled(enabled);
        await setEnforceTracker(enabled);
        toast.success(`Enforce Matomo Tracker ${enabled ? 'enabled' : 'disabled'}`, { duration: 2000 });
    }

    async function loadEnforcedDomains() {
        const domains = await getEnforcedDomainMappings();
        setEnforcedDomains(domains);
    }

    async function handleRemoveEnforcedDomain(domain: string) {
        await removeEnforcedDomainMapping(domain);
        await loadEnforcedDomains();
        toast.success(`Removed ${domain} from enforced list`, { duration: 2000 });
    }

    async function handleClearAllEnforcedDomains() {
        await clearAllEnforcedMappings();
        await loadEnforcedDomains();
        toast.success('Cleared all enforced domain mappings', { duration: 2000 });
    }

    // Detect credential changes to re-enable validation button
    useEffect(() => {
        if (validatedCredentials && currentCredentials) {
            const credentialsChanged =
                currentCredentials.apiUrl !== validatedCredentials.apiUrl ||
                currentCredentials.authToken !== validatedCredentials.authToken;

            if (credentialsChanged && validationStatus === 'validated') {
                setValidationStatus('credentials-changed');
            }
        }
    }, [currentCredentials, validatedCredentials, validationStatus]);

    async function loadExistingCredentials() {
        const creds = await getCredentials();
        if (creds) {
            setCurrentCredentials({
                apiUrl: creds.apiUrl,
                authToken: creds.authToken,
            });
            setHasExistingCredentials(true);

            // Auto-validate silently to ensure sites are cached
            await handleValidate(creds.apiUrl, creds.authToken, { silent: true });
        }
    }

    async function handleValidate(apiUrl: string, authToken: string, options: { silent?: boolean } = {}) {
        const { silent = false } = options;
        setValidationStatus('loading');

        let loadingToast: string | number | undefined;
        if (!silent) {
            loadingToast = toast.loading('Connecting to Matomo and fetching sites with write access...');
        }

        try {
            const client = createMatomoClient(apiUrl, authToken);
            const fetchedSites = await client.getSitesWithWriteAccess();

            if (!Array.isArray(fetchedSites) || fetchedSites.length === 0) {
                throw new Error('No sites with write access found for this token');
            }

            // Cache sites for later use in popup
            await saveAvailableSites(fetchedSites);

            // Auto-save credentials after successful validation
            await saveCredentials({ apiUrl, authToken });

            setCurrentCredentials({ apiUrl, authToken });
            setValidatedCredentials({ apiUrl, authToken });
            setValidationStatus('validated');
            setHasExistingCredentials(true);

            if (!silent) {
                toast.success(`Connected successfully! Found ${fetchedSites.length} site(s) with write access.`, {
                    id: loadingToast,
                    duration: 4000,
                });
            }

            // Reset status after animation
            setTimeout(() => {
                setValidationStatus('idle');
            }, 2000);
        } catch (error) {
            setValidationStatus('error');

            if (!silent) {
                toast.error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
                    id: loadingToast,
                    duration: 6000,
                });
            }
        }
    }


    async function handleClear() {
        if (!confirm('Are you sure you want to clear all Matomo API credentials and cached data?')) {
            return;
        }

        await clearCredentials();
        setCurrentCredentials(null);
        setValidatedCredentials(null);
        setValidationStatus('idle');
        setHasExistingCredentials(false);

        toast.success('All settings cleared successfully', {
            duration: 3000,
        });
    }

    return (
        <>
            <Toaster position="bottom-center" />
            <div className="min-h-screen bg-gradient-to-b from-muted to-muted/50">
                <div className="max-w-2xl mx-auto py-16 px-4">

                    <Card className="border-border/40 shadow-sm">
                        <CardHeader className="space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Settings className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-2xl tracking-tight -mb-0.5">Matomo API Settings</CardTitle>
                                        <CardDescription className="text-md">
                                            Configure your Matomo instance credentials
                                        </CardDescription>
                                    </div>
                                </div>

                                {hasExistingCredentials && (
                                    <Button
                                        onClick={handleClear}
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <CredentialsForm
                                onValidate={handleValidate}
                                isLoading={validationStatus === 'loading'}
                                validationStatus={validationStatus}
                                initialValues={currentCredentials || undefined}
                            />

                            <Collapsible
                                trigger={<span className="text-xs uppercase tracking-wide">Advanced Settings</span>}
                            >
                                <div className="pt-3 pb-1 space-y-4">
                                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <Bug className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">Debug Mode</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Enable verbose logging for troubleshooting
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={debugModeEnabled}
                                            onClick={() => handleDebugModeChange(!debugModeEnabled)}
                                            className={`
                                                relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                                                transition-colors duration-200 ease-in-out focus-visible:outline-none
                                                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                                                ${debugModeEnabled ? 'bg-primary' : 'bg-input'}
                                            `}
                                        >
                                            <span
                                                className={`
                                                    pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg
                                                    ring-0 transition-transform duration-200 ease-in-out
                                                    ${debugModeEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                                                `}
                                            />
                                        </button>
                                    </label>

                                    <Separator />

                                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">Enforce Matomo Tracker</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Override any page's Matomo tracker with your configured instance for debugging
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={enforceTrackerEnabled}
                                            onClick={() => handleEnforceTrackerChange(!enforceTrackerEnabled)}
                                            className={`
                                                relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                                                transition-colors duration-200 ease-in-out focus-visible:outline-none
                                                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                                                ${enforceTrackerEnabled ? 'bg-primary' : 'bg-input'}
                                            `}
                                        >
                                            <span
                                                className={`
                                                    pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg
                                                    ring-0 transition-transform duration-200 ease-in-out
                                                    ${enforceTrackerEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                                                `}
                                            />
                                        </button>
                                    </label>

                                    {/* Enforced Domains List */}
                                    {enforceTrackerEnabled && (
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    Enforced Domains
                                                </p>
                                                {enforcedDomains.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleClearAllEnforcedDomains}
                                                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                                    >
                                                        Clear all
                                                    </Button>
                                                )}
                                            </div>
                                            {enforcedDomains.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">
                                                    No domains are currently enforced. Visit a page and select a site to enforce.
                                                </p>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {enforcedDomains.map(({ domain, siteName }) => (
                                                        <li
                                                            key={domain}
                                                            className="flex items-center justify-between text-xs p-2 bg-muted rounded"
                                                        >
                                                            <span>
                                                                <span className="font-medium">{domain}</span>
                                                                <span className="text-muted-foreground ml-2">→ {siteName}</span>
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveEnforcedDomain(domain)}
                                                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Collapsible>
                        </CardContent>
                    </Card>



                    {/* Footer */}
                    <p className="text-center text-sm text-muted-foreground mt-8">
                        Developed with ❤️ by{' '}
                        <a
                            href="https://martez.io"
                            className="text-foreground hover:underline transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Raphael @ Martez.io
                        </a>
                    </p>
                </div>
            </div>
        </>
    );
}
