/**
 * Serializable element info for cross-context communication
 * Used to pass element data between content script and persistent bar
 */
export interface SerializedElementInfo {
  /** Unique ID (generated, stored as data-mhh-id on element) */
  id: string;
  /** CSS selector for display (e.g., ".main-content", "#sidebar") */
  selector: string;
  /** Tag name (e.g., "div", "section") */
  tag: string;
  /** Pixels of hidden content (scrollHeight - clientHeight) */
  hiddenContent: number;
  /** Whether user locked this element in interactive mode */
  isLocked: boolean;
  /** Timestamp when first detected (for ordering, newest first) */
  timestamp: number;
  /** List of fix titles that will be applied (e.g., "Expand height", "Remove scroll") */
  fixes: string[];
}
