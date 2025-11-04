import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ValidationStatusProps {
  status: 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';
  message: string;
}

export function ValidationStatus({ status, message }: ValidationStatusProps) {
  if (status === 'idle' || status === 'credentials-changed') return null;

  const styles = {
    loading: 'bg-blue-50 border-blue-200 text-blue-800',
    validated: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const icons = {
    loading: <Loader2 className="h-5 w-5 animate-spin" />,
    validated: <CheckCircle2 className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
  };

  if ( status === 'validated') return null;

  return (
    <div className={`flex items-start gap-3 p-4 border-2 rounded-lg ${styles[status]}`}>
      {icons[status]}
      <p className="text-sm flex-1">{message}</p>
    </div>
  );
}
