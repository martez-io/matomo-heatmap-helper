import { AlertCircle, X } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({
  title = 'Error',
  message,
  onDismiss,
  className = '',
}: ErrorMessageProps) {
  return (
    <div
      className={`bg-red-50 border-2 border-red-200 rounded-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-semibold text-red-800">{title}</h3>
          <div className="mt-1 text-sm text-red-700 whitespace-pre-line">{message}</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 inline-flex text-red-600 hover:text-red-800 focus:outline-none"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
