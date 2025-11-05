import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/shared/Button';

/**
 * Sanitize Matomo URL to only include protocol and domain
 */
function sanitizeUrl(url: string): string {
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);
    // Remove trailing slash, path, query, and hash
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    // If URL is invalid, return as-is and let validation handle it
    return url.trim();
  }
}

const credentialsSchema = z.object({
  apiUrl: z.string().url('Please enter a valid URL (e.g., https://matomo.example.com)'),
  authToken: z.string().min(1, 'Auth token is required'),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;

interface CredentialsFormProps {
  onValidate: (apiUrl: string, authToken: string) => Promise<void>;
  isLoading: boolean;
  validationStatus: 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';
  initialValues?: Partial<CredentialsFormData>;
}

export function CredentialsForm({ onValidate, isLoading, validationStatus, initialValues }: CredentialsFormProps) {
  const [showToken, setShowToken] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: initialValues,
  });

  // Sync form values when initialValues prop changes
  useEffect(() => {
    reset(initialValues || { apiUrl: '', authToken: '' });
  }, [initialValues, reset]);

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const sanitized = sanitizeUrl(e.target.value);
    setValue('apiUrl', sanitized);
  };

  const onSubmit = async (data: CredentialsFormData) => {
    // Sanitize URL before validation
    const sanitizedUrl = sanitizeUrl(data.apiUrl);
    await onValidate(sanitizedUrl, data.authToken);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-700 mb-2">
          Matomo Instance URL
        </label>
        <input
          id="apiUrl"
          type="text"
          {...register('apiUrl')}
          onBlur={handleUrlBlur}
          placeholder="https://matomo.example.com"
          className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.apiUrl
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200'
          }`}
        />
        {errors.apiUrl && (
          <p className="mt-1 text-sm text-red-600">{errors.apiUrl.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Your Matomo server URL (without trailing slash)
        </p>
      </div>

      <div>
        <label htmlFor="authToken" className="block text-sm font-medium text-gray-700 mb-2">
          Auth Token
        </label>
        <div className="relative">
          <input
            id="authToken"
            type={showToken ? 'text' : 'password'}
            {...register('authToken')}
            placeholder="Enter your auth token"
            className={`w-full px-4 py-2 pr-10 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.authToken
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
          >
            {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.authToken && (
          <p className="mt-1 text-sm text-red-600">{errors.authToken.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Found in Matomo under Personal → Security → Auth Tokens
        </p>
      </div>

      <Button
        type="submit"
        fullWidth
        isLoading={isLoading}
      >
        Validate and Save
      </Button>
    </form>
  );
}
