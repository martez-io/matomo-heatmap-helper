import { Settings } from 'lucide-react';
import { Button } from '@/components/shared/Button';

interface OnboardingProps {
  onOpenSettings: () => void;
}

export function Onboarding({ onOpenSettings }: OnboardingProps) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-center">
          Configure your Matomo credentials to get started
        </p>
      </div>
      <Button onClick={onOpenSettings} fullWidth>
        <Settings className="mr-2 h-4 w-4" />
        Open Settings
      </Button>
    </div>
  );
}
