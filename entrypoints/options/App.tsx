import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Settings, Trash2, CheckCircle } from 'lucide-react';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, saveCredentials, clearCredentials } from '@/lib/storage';
import { CredentialsForm } from '@/components/options/CredentialsForm';
import { SiteSelector } from '@/components/options/SiteSelector';
import { ValidationStatus } from '@/components/options/ValidationStatus';
import { Button } from '@/components/shared/Button';
import type { MatomoSite } from '@/types/matomo';

type ValidationState = 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';

export default function App() {
  const [validationStatus, setValidationStatus] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [sites, setSites] = useState<MatomoSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(null);
  const [currentCredentials, setCurrentCredentials] = useState<{
    apiUrl: string;
    authToken: string;
  } | null>(null);
  const [validatedCredentials, setValidatedCredentials] = useState<{
    apiUrl: string;
    authToken: string;
  } | null>(null);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [openerTabId, setOpenerTabId] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Load existing credentials on mount and get opener tab
  useEffect(() => {
    loadExistingCredentials();

    // Get the tab that opened this options page
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.openerTabId) {
        setOpenerTabId(tabs[0].openerTabId);
      }
    });
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
      setSelectedSiteId(creds.siteId);
      setSelectedSiteName(creds.siteName);
      setHasExistingCredentials(true);

      // Auto-load sites
      await handleValidate(creds.apiUrl, creds.authToken);
    }
  }

  async function handleValidate(apiUrl: string, authToken: string) {
    setValidationStatus('loading');
    setValidationMessage('Connecting to Matomo and fetching sites with write access...');

    try {
      const client = createMatomoClient(apiUrl, authToken);
      const fetchedSites = await client.getSitesWithWriteAccess();

      if (!Array.isArray(fetchedSites) || fetchedSites.length === 0) {
        throw new Error('No sites with write access found for this token');
      }

      setSites(fetchedSites);
      setCurrentCredentials({ apiUrl, authToken });
      setValidatedCredentials({ apiUrl, authToken });
      setValidationStatus('validated');
      setValidationMessage('');
    } catch (error) {
      setValidationStatus('error');
      setValidationMessage(
        `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setSites([]);
    }
  }

  async function handleSave() {
    if (!currentCredentials || !selectedSiteId || !selectedSiteName) {
      return;
    }

    try {
      await saveCredentials({
        apiUrl: currentCredentials.apiUrl,
        authToken: currentCredentials.authToken,
        siteId: selectedSiteId,
        siteName: selectedSiteName,
      });

      setValidationStatus('validated');
      setValidationMessage(`✓ Settings saved! Using site: ${selectedSiteName}`);
      setHasExistingCredentials(true);
      setJustSaved(true);

      // Reset the "just saved" state after 2 seconds
      setTimeout(() => {
        setJustSaved(false);
      }, 2000);
    } catch (error) {
      setValidationStatus('error');
      setValidationMessage('Failed to save settings');
    }
  }

  async function handleClear() {
    if (!confirm('Are you sure you want to clear all Matomo API credentials?')) {
      return;
    }

    await clearCredentials();
    setCurrentCredentials(null);
    setSelectedSiteId(null);
    setSelectedSiteName(null);
    setSites([]);
    setValidationStatus('idle');
    setValidationMessage('Credentials cleared successfully');
    setHasExistingCredentials(false);

    setTimeout(() => {
      setValidationStatus('idle');
      setValidationMessage('');
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Settings className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Matomo API Settings</h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure your Matomo instance credentials and site selection
              </p>
            </div>
          </div>

          {/* Credentials Form */}
          <div className="mb-6">
            <CredentialsForm
              onValidate={handleValidate}
              isLoading={validationStatus === 'loading'}
              validationStatus={validationStatus}
              initialValues={currentCredentials || undefined}
            />
          </div>

          {/* Validation Status */}
          <div className="mb-6">
            <ValidationStatus status={validationStatus} message={validationMessage} />
          </div>

          {/* Site Selection */}
          {sites.length > 0 && (
            <div className="mb-6">
              <SiteSelector
                sites={sites}
                selectedSiteId={selectedSiteId}
                onSelectSite={(siteId, siteName) => {
                  setSelectedSiteId(siteId);
                  setSelectedSiteName(siteName);
                }}
              />
            </div>
          )}

          {/* Actions */}
          {sites.length > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={!selectedSiteId}
                fullWidth
              >
                {justSaved ? 'Settings Saved!' : 'Save Settings'}
              </Button>
              {hasExistingCredentials && (
                <Button
                  onClick={handleClear}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Developed with ❤️ by <a href="https://martez.io" className="text-slate-500" target="_blank">Raphael @ Martez.io</a>
        </p>
      </div>
    </div>
  );
}
