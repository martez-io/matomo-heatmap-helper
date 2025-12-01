/**
 * Entry point for feedback bar content script
 * Shows success feedback UI after screenshot capture
 * Triggered by query params: ?mhh_success=1&mhh_heatmap={id}&mhh_ts={timestamp}
 */

import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import ReactDOM from 'react-dom/client';
import { get, set } from '@/lib/storage';
import { S } from '@/lib/storage-keys';
import { logger } from '@/lib/logger';
import { App } from './components/App';
import './styles.css';

export default defineContentScript({
    matches: ['<all_urls>'],
    cssInjectionMode: 'ui',

    async main(ctx: ContentScriptContext) {
        // 1. Check for success trigger params
        const params = new URLSearchParams(window.location.search);
        if (params.get('mhh_success') !== '1') return;

        await logger.init(true); // Skip watcher to avoid CSP violations
        logger.debug('FeedbackBar', 'Success params detected');

        // 2. Validate timestamp (30s expiry prevents stale bookmarks/refreshes)
        const ts = parseInt(params.get('mhh_ts') || '0', 10);
        if (Date.now() - ts > 30_000) {
            logger.debug('FeedbackBar', 'Timestamp expired, skipping');
            cleanupUrl();
            return;
        }

        // 3. Deduplication check (same ts = already processed)
        const lastTs = await get(S.LAST_PROCESSED_TS);
        if (lastTs === ts) {
            logger.debug('FeedbackBar', 'Already processed this success, skipping');
            cleanupUrl();
            return;
        }
        await set(S.LAST_PROCESSED_TS, ts);

        // 4. Extract context before cleanup
        const heatmapId = params.get('mhh_heatmap');

        // 5. Clean URL immediately (before UI mounts)
        cleanupUrl();

        logger.debug('FeedbackBar', 'Mounting UI for heatmap:', heatmapId);

        // 6. Mount Shadow DOM UI
        const ui = await createShadowRootUi(ctx, {
            name: 'matomo-heatmap-helper-feedback',
            position: 'inline',
            append: 'last',
            onMount: (container) => {
                const app = document.createElement('div');
                app.id = 'mhh-feedback-bar-root';
                container.append(app);

                const root = ReactDOM.createRoot(app);
                root.render(<App heatmapId={heatmapId} onDismiss={() => ui.remove()} />);

                logger.debug('FeedbackBar', 'UI mounted');
                return root;
            },
            onRemove: (root: ReactDOM.Root | undefined) => {
                logger.debug('FeedbackBar', 'UI unmounted');
                root?.unmount();
            },
        });

        ui.mount();
    },
});

/**
 * Remove mhh_* query params from URL to prevent re-triggers
 */
function cleanupUrl() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('mhh_success');
        url.searchParams.delete('mhh_heatmap');
        url.searchParams.delete('mhh_ts');
        window.history.replaceState({}, '', url.toString());
    } catch (e) {
        logger.warn('FeedbackBar', 'URL cleanup failed:', e);
    }
}
