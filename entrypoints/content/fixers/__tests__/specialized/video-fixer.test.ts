/**
 * Tests for the video fixer
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { videoFixer } from '../../specialized/video-fixer';
import { createElement, createVideoElement, createFixerContext, cleanup } from '../test-utils';

describe('VideoFixer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(videoFixer.id).toBe('specialized:video');
    });

    it('should have priority 120', () => {
      expect(videoFixer.priority).toBe(120);
    });

    it('should compose base:height', () => {
      expect(videoFixer.composesFixers).toContain('base:height');
    });
  });

  describe('shouldApply', () => {
    it('should return true for video elements', () => {
      const video = createVideoElement();
      const context = createFixerContext(video);

      expect(videoFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for audio elements', () => {
      const audio = document.createElement('audio');
      const context = createFixerContext(audio);

      expect(videoFixer.shouldApply(context)).toBe(true);
    });

    it('should return false for non-media elements', () => {
      const div = createElement('div');
      const context = createFixerContext(div);

      expect(videoFixer.shouldApply(context)).toBe(false);
    });

    it('should return false for iframe elements', () => {
      const iframe = document.createElement('iframe');
      const context = createFixerContext(iframe);

      expect(videoFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should pause playing video', () => {
      const video = createVideoElement({ autoplay: true });
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      document.body.appendChild(video);
      const context = createFixerContext(video);

      videoFixer.apply(context);

      expect(video.pause).toHaveBeenCalled();
    });

    it('should not pause already paused video', () => {
      const video = createVideoElement({ autoplay: false });
      Object.defineProperty(video, 'paused', { value: true, writable: true });
      document.body.appendChild(video);
      const context = createFixerContext(video);

      videoFixer.apply(context);

      expect(video.pause).not.toHaveBeenCalled();
    });

    it('should seek to start for video without poster', () => {
      const video = createVideoElement();
      Object.defineProperty(video, 'poster', { value: '', writable: true });
      Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
      document.body.appendChild(video);
      const context = createFixerContext(video);

      videoFixer.apply(context);

      expect(video.currentTime).toBe(0);
    });

    it('should not seek for video with poster', () => {
      const video = createVideoElement({ poster: 'poster.jpg' });
      Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
      document.body.appendChild(video);
      const context = createFixerContext(video);

      videoFixer.apply(context);

      expect(video.currentTime).toBe(30);
    });

    it('should return applied: true', () => {
      const video = createVideoElement();
      const context = createFixerContext(video);

      const result = videoFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('specialized:video');
    });
  });

  describe('restore', () => {
    it('should restore original currentTime', () => {
      const video = createVideoElement();
      const originalTime = 45;
      Object.defineProperty(video, 'currentTime', { value: originalTime, writable: true });
      Object.defineProperty(video, 'paused', { value: true, writable: true });
      const context = createFixerContext(video);

      const result = videoFixer.apply(context);

      // Simulate time being changed during apply
      video.currentTime = 0;

      result.restore();

      expect(video.currentTime).toBe(originalTime);
    });

    it('should resume playback if video was playing', () => {
      const video = createVideoElement({ autoplay: true });
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      const context = createFixerContext(video);

      const result = videoFixer.apply(context);
      result.restore();

      expect(video.play).toHaveBeenCalled();
    });

    it('should not resume playback if video was paused', () => {
      const video = createVideoElement({ autoplay: false });
      Object.defineProperty(video, 'paused', { value: true, writable: true });
      const context = createFixerContext(video);

      const result = videoFixer.apply(context);
      result.restore();

      expect(video.play).not.toHaveBeenCalled();
    });
  });

  describe('audio elements', () => {
    it('should pause playing audio', () => {
      const audio = document.createElement('audio') as HTMLAudioElement;
      const pauseMock = vi.fn();
      const playMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(audio, 'paused', { value: false, writable: true });
      Object.defineProperty(audio, 'currentTime', { value: 10, writable: true });
      audio.pause = pauseMock;
      audio.play = playMock;

      document.body.appendChild(audio);
      const context = createFixerContext(audio);

      videoFixer.apply(context);

      expect(pauseMock).toHaveBeenCalled();
    });

    it('should restore audio playback state', () => {
      const audio = document.createElement('audio') as HTMLAudioElement;
      const pauseMock = vi.fn();
      const playMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(audio, 'paused', { value: false, writable: true });
      Object.defineProperty(audio, 'currentTime', { value: 10, writable: true });
      audio.pause = pauseMock;
      audio.play = playMock;

      document.body.appendChild(audio);
      const context = createFixerContext(audio);

      const result = videoFixer.apply(context);
      result.restore();

      expect(playMock).toHaveBeenCalled();
    });
  });
});
