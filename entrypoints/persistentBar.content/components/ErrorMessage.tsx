/**
 * Error message component
 * Displays error with icon and dismiss button
 */

import { X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorMessageProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorMessage({ error, onDismiss }: ErrorMessageProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex items-start gap-2">
        <span className="flex-1">{error}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 hover:bg-red-100"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
