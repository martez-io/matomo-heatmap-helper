import { Button } from '@/components/shared/Button';

type ErrorType = 'no-matomo' | 'no-site' | 'no-permission';

interface ErrorStateViewProps {
  errorType: ErrorType;
  onRetry: () => void;
  onSettings: () => void;
  onBypass?: () => void;
  isRetrying?: boolean;
}

const ERROR_CONFIG: Record<ErrorType, {
  emoji: string;
  title: string;
  description: string;
  helpTitle: string;
  helpItems: string[];
  bgColor: string;
  borderColor: string;
  textColor: string;
  titleColor: string;
  bypassable: boolean;
}> = {
  'no-matomo': {
    emoji: '⚠️',
    title: 'Matomo Not Detected',
    description: "This page doesn't appear to have Matomo installed.",
    helpTitle: 'Common reasons:',
    helpItems: [
      "Page doesn't use Matomo tracking",
      'Matomo is still loading',
      'Ad blocker is blocking Matomo',
    ],
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    titleColor: 'text-amber-900',
    bypassable: true,
  },
  'no-site': {
    emoji: '⚠️',
    title: 'Site Not Found',
    description: 'The current domain is not listed in any of your sites in the Matomo dashboard.',
    helpTitle: 'To use this extension:',
    helpItems: [
      'Add this domain to your Matomo sites',
      'Ensure the site is properly configured',
      'Refresh this popup after adding the site',
    ],
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    titleColor: 'text-amber-900',
    bypassable: false,
  },
  'no-permission': {
    emoji: '🔒',
    title: 'Insufficient Permissions',
    description: 'You need at least write permission for this site to capture heatmap screenshots.',
    helpTitle: 'To use this extension:',
    helpItems: [
      'Request write access for this site in Matomo',
      'Ask your Matomo administrator for permissions',
      'Refresh this popup after permissions are granted',
    ],
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    titleColor: 'text-red-900',
    bypassable: false,
  },
};

export function ErrorStateView({ errorType, onRetry, onSettings, onBypass, isRetrying = false }: ErrorStateViewProps) {
  const config = ERROR_CONFIG[errorType];

  return (
    <div className="space-y-4">
      <div className={`${config.bgColor} border-2 ${config.borderColor} rounded-lg p-4`}>
        <h2 className={`font-bold ${config.titleColor} mb-2`}>
          {config.emoji} {config.title}
        </h2>
        <p className={`text-sm ${config.textColor}`}>
          {config.description}
        </p>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-medium">{config.helpTitle}</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          {config.helpItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onRetry}
          variant="secondary"
          isLoading={isRetrying}
          disabled={isRetrying}
        >
          {config.bypassable ? 'Retry Check' : 'Retry Detection'}
        </Button>
        {config.bypassable && onBypass ? (
          <Button onClick={onBypass}>
            Continue Anyway
          </Button>
        ) : (
          <Button onClick={onSettings} disabled={isRetrying}>
            Open Settings
          </Button>
        )}
      </div>
    </div>
  );
}
