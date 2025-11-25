/**
 * Background script module for fetching cross-origin resources
 * Uses extension privileges to bypass CORS restrictions
 */

import { logger } from '@/lib/logger';
import type { CorsResourceRequest, CorsResourceResult } from '@/types/messages';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

const FETCH_TIMEOUT_MS = 10000;
const BATCH_SIZE = 5;
const DEFAULT_MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Detect MIME type from URL extension or Content-Type header
 */
function detectMimeType(url: string, contentType?: string): string {
  // Prefer Content-Type header if valid
  if (contentType && !contentType.includes('text/html')) {
    return contentType.split(';')[0].trim();
  }

  // Fall back to extension detection
  const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  return ext ? MIME_TYPES[ext] || 'application/octet-stream' : 'application/octet-stream';
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Fetch a single resource and convert to data URI
 */
async function fetchResource(request: CorsResourceRequest): Promise<CorsResourceResult> {
  const { id, url } = request;

  try {
    // Skip data URIs - they're already embedded
    if (url.startsWith('data:')) {
      return { id, url, success: true, dataUri: url, sizeBytes: url.length };
    }

    // Skip blob URLs - can't fetch cross-context
    if (url.startsWith('blob:')) {
      return { id, url, success: false, error: 'Cannot fetch blob URLs' };
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'omit', // Don't send cookies for cross-origin
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { id, url, success: false, error: `HTTP ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const mimeType = detectMimeType(url, response.headers.get('content-type') || undefined);
    const dataUri = `data:${mimeType};base64,${base64}`;

    return {
      id,
      url,
      success: true,
      dataUri,
      mimeType,
      sizeBytes: buffer.byteLength,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return {
      id,
      url,
      success: false,
      error: isAbort ? 'Timeout' : message,
    };
  }
}

/**
 * Fetch multiple CORS resources with batching and size limits
 */
export async function fetchCorsResources(
  requests: CorsResourceRequest[],
  maxTotalSizeBytes: number = DEFAULT_MAX_TOTAL_SIZE_BYTES
): Promise<{ results: CorsResourceResult[]; totalSizeBytes: number }> {
  const results: CorsResourceResult[] = [];
  let totalSizeBytes = 0;

  logger.debug('Background', `Fetching ${requests.length} CORS resources`);

  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchResource));

    for (const result of batchResults) {
      // Check size limit
      if (result.success && result.sizeBytes) {
        if (totalSizeBytes + result.sizeBytes > maxTotalSizeBytes) {
          logger.warn(
            'Background',
            `CORS fetch: Size limit exceeded at ${totalSizeBytes} bytes, skipping ${result.url}`
          );
          results.push({
            ...result,
            success: false,
            dataUri: undefined,
            error: 'Size limit exceeded',
          });
          continue;
        }
        totalSizeBytes += result.sizeBytes;
      }
      results.push(result);
    }

    // Early exit if we've hit the size limit
    if (totalSizeBytes >= maxTotalSizeBytes) {
      logger.warn('Background', 'CORS fetch: Hit total size limit, stopping early');
      break;
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.debug(
    'Background',
    `CORS fetch complete: ${successCount}/${requests.length} succeeded, ${totalSizeBytes} bytes total`
  );

  return { results, totalSizeBytes };
}
