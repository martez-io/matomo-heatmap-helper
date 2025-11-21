/**
 * Options page for configuring Matomo API credentials.
 *
 * Security note: Credentials are stored in chrome.storage.local, which is isolated
 * by the browser and inaccessible to web pages. Only this extension can read them.
 */

import { useState, useEffect } from 'react';
import { Settings, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, saveCredentials, clearCredentials, saveAvailableSites } from '@/lib/storage';
import { CredentialsForm } from '@/entrypoints/options/CredentialsForm';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

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

    // Load existing credentials on mount
    useEffect(() => {
        loadExistingCredentials();
    }, []);

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
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/50">
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

                        <CardContent>
                            <CredentialsForm
                                onValidate={handleValidate}
                                isLoading={validationStatus === 'loading'}
                                validationStatus={validationStatus}
                                initialValues={currentCredentials || undefined}
                            />
                        </CardContent>
                    </Card>

                    {/* Security note */}
                    <div className="flex items-start gap-3 mt-6 p-4 rounded-lg bg-muted/50 border border-border/40">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                            Your credentials are stored securely in the browser's extension storage and cannot be accessed by websites you visit.
                        </p>
                    </div>

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
