/**
 * Global state and type definitions for content script
 */

export interface ElementMetadata {
  /** Unique ID for cross-context communication */
  id: string;
  element: HTMLElement;
  selector: string;
  tag: string;
  scrollHeight: number;
  clientHeight: number;
  hiddenContent: number;
  parents: Array<{ element: HTMLElement; selector: string }>;
  firstDetected: number;
}

export interface ElementStyles {
  height: string;
  minHeight: string;
  maxHeight: string;
  overflow: string;
  overflowY: string;
  position: string;
  outline: string;
  outlineOffset: string;
}

/**
 * Global scroll tracker state
 * Singleton that maintains all content script state
 */
export const ScrollTracker = {
  scrolledElements: new Map<HTMLElement, ElementMetadata>(),
  originalStates: new Map<HTMLElement, ElementStyles>(),
  isTracking: false,
  heatmapId: null as number | null,
  startTime: null as number | null,
  // Track elements with listeners for cleanup
  elementsWithListeners: [] as Element[],
  // Interactive mode state
  isInteractiveMode: false,
  lockedElements: new Map<HTMLElement, ElementMetadata>(),
  // Elements ignored/dismissed by user (keyed by element ID)
  ignoredElements: new Set<string>(),
};

/** Generate a unique ID for an element */
export function generateElementId(): string {
  return crypto.randomUUID();
}
