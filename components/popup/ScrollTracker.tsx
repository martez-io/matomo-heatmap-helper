import type { ScrollableElement } from '@/types/messages';
import { CheckboxIcon } from '@/components/shared/CheckboxIcon';

interface ScrollTrackerProps {
  count: number;
  scrollables: ScrollableElement[];
}

export function ScrollTracker({ count, scrollables }: ScrollTrackerProps) {
  // Log detected scroll areas to console for debugging
  if (count > 0) {
    console.log(`[Tracking] Detected ${count} scroll areas:`, scrollables);
  }

  return (
    <div className="space-y-4">
      {/* Pre-Screenshot Checklist */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-blue-900">Pre-Screenshot Checklist</h3>
        </div>
        <p className="text-sm text-blue-800 mb-3">Before capturing, scroll through the entire page and verify:</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-blue-900">
            <CheckboxIcon className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <span>Scroll to the bottom to trigger lazy-loaded content</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-blue-900">
            <CheckboxIcon className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <span>Wait for all images and media to finish loading</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-blue-900">
            <CheckboxIcon className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <span>Let animations and transitions complete</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-blue-900">
            <CheckboxIcon className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <span>Close any open popups, modals, or overlays</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-blue-900">
            <CheckboxIcon className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <span>Ensure dynamic content has fully rendered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
