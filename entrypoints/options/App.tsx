import { useState, useEffect } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, saveCredentials, clearCredentials, saveAvailableSites } from '@/lib/storage';
import { CredentialsForm } from '@/components/options/CredentialsForm';
import { ValidationStatus } from '@/components/options/ValidationStatus';
import { Button } from '@/components/shared/Button';

type ValidationState = 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';

export default function App() {
  const [validationStatus, setValidationStatus] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('');
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

      // Auto-validate to ensure sites are cached
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

      // Cache sites for later use in popup
      await saveAvailableSites(fetchedSites);

      // Auto-save credentials after successful validation
      await saveCredentials({ apiUrl, authToken });

      setCurrentCredentials({ apiUrl, authToken });
      setValidatedCredentials({ apiUrl, authToken });
      setValidationStatus('validated');
      setValidationMessage(`Connected successfully! Found ${fetchedSites.length} site(s) with write access. Settings saved.`);
      setHasExistingCredentials(true);

      // Keep success message visible for 2 seconds
      setTimeout(() => {
        setValidationStatus('idle');
        setValidationMessage('');
      }, 2000);
    } catch (error) {
      setValidationStatus('error');
      setValidationMessage(
        `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }


  async function handleClear() {
    if (!confirm('Are you sure you want to clear all Matomo API credentials and cached data?')) {
      return;
    }

    await clearCredentials();
    setCurrentCredentials(null);
    setValidationStatus('idle');
    setValidationMessage('✓ All settings cleared successfully');
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
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Matomo API Settings</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Configure your Matomo instance credentials
                </p>
              </div>
            </div>
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
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Developed with ❤️ by <a href="https://martez.io" className="text-slate-500" target="_blank">Raphael @ Martez.io</a>
        </p>
      </div>
    </div>
  );
}
