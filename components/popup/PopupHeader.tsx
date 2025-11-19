import { Settings, Bug } from 'lucide-react';

interface PopupHeaderProps {
  onOpenSettings: () => void;
  onOpenBugReport: () => void;
}

export function PopupHeader({ onOpenSettings, onOpenBugReport }: PopupHeaderProps) {
  return (
    <div className="mb-6 relative">
      <div className="flex items-start gap-2">
        <img src="/logo.png" alt="Matomo Heatmap Helper Logo" className="size-11" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 -mb-1.5">
            Heatmap Helper
          </h1>
          <span style={{ fontSize: '10px' }} className="text-gray-900/80 font-bold">By Martez</span>
        </div>
        <span className="px-2 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full uppercase tracking-wide mt-2">
          Beta
        </span>
      </div>
      <button
        onClick={onOpenBugReport}
        className="absolute top-1/2 right-12 -translate-y-1/2 text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
        title="Report a Bug"
      >
        <Bug className="w-5 h-5" />
      </button>
      <button
        onClick={onOpenSettings}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
