import type { MatomoHeatmap } from '@/types/matomo';
import type { ProcessingStep } from '@/types/storage';
import type { SerializedElementInfo } from '@/types/elements';

export interface BarState {
  // UI state
  isMinimized: boolean;
  isVisible: boolean;

  // Heatmap selection
  selectedHeatmap: MatomoHeatmap | null;
  heatmaps: MatomoHeatmap[];

  // Tracking state
  elements: SerializedElementInfo[];
  isTracking: boolean;
  isInteractiveMode: boolean;

  // Screenshot process state
  isProcessing: boolean;
  processingStep: ProcessingStep | null;

  // Error state
  error: string | null;

  // Site info
  siteId: number | null;
  siteName: string | null;
}

export type BarAction =
  | { type: 'SET_STATE'; payload: Partial<BarState> }
  | { type: 'SET_MINIMIZED'; payload: boolean }
  | { type: 'SELECT_HEATMAP'; payload: MatomoHeatmap }
  | { type: 'UPDATE_ELEMENT_LIST'; payload: SerializedElementInfo[] }
  | { type: 'SET_TRACKING'; payload: boolean }
  | { type: 'SET_INTERACTIVE_MODE'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_PROCESSING_STEP'; payload: ProcessingStep | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };
