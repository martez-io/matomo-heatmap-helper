/**
 * Video/Media Fixer
 *
 * Handles video and audio elements:
 * - Pauses playback during screenshot
 * - Ensures poster or first frame is visible for video
 */

import type { ComposableFixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const videoFixer: ComposableFixer = {
  id: 'specialized:video',
  priority: 120,
  composesFixers: ['base:height'],

  shouldApply(context: FixerContext): boolean {
    const tagName = context.element.tagName.toLowerCase();
    return tagName === 'video' || tagName === 'audio';
  },

  apply(context: FixerContext): FixerResult {
    const media = context.element as HTMLVideoElement | HTMLAudioElement;

    const wasPlaying = !media.paused;
    const originalCurrentTime = media.currentTime;

    if (wasPlaying) {
      media.pause();
    }

    // For video, seek to start to show poster or first frame
    if (media instanceof HTMLVideoElement && !media.poster && media.readyState >= 1) {
      media.currentTime = 0;
    }

    return {
      fixerId: 'specialized:video',
      applied: true,
      restore() {
        media.currentTime = originalCurrentTime;
        if (wasPlaying) {
          media.play().catch(() => {
            // Ignore autoplay restrictions
          });
        }
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(videoFixer);
