import confetti, { CreateTypes } from 'canvas-confetti';
import { useCallback, useEffect, useRef } from 'react';

interface UseConfettiOptions {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
}

const defaultOptions: UseConfettiOptions = {
    particleCount: 180,
    spread: 55,
    origin: { x: 0.5, y: 1 },
};

export function useConfetti(options: UseConfettiOptions = {}) {
    const confettiRef = useRef<CreateTypes | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // Create canvas in document.body to escape Shadow DOM constraints
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 2147483647;
        `;
        document.body.appendChild(canvas);
        canvasRef.current = canvas;

        confettiRef.current = confetti.create(canvas, {
            resize: true,
            useWorker: false, // Disabled due to CSP restrictions on blob: workers
        });

        return () => {
            confettiRef.current?.reset();
            canvas.remove();
        };
    }, []);

    const fire = useCallback(() => {
        const mergedOptions = { ...defaultOptions, ...options };
        // Fire from bottom left
        confettiRef.current?.({
            particleCount: mergedOptions.particleCount,
            spread: mergedOptions.spread,
            origin: { x: 0, y: 1 },
            angle: 60,
            startVelocity: 80,
            gravity: 0.8,
            disableForReducedMotion: true,
        });
        // Fire from bottom right
        confettiRef.current?.({
            particleCount: mergedOptions.particleCount,
            spread: mergedOptions.spread,
            origin: { x: 1, y: 1 },
            angle: 120,
            startVelocity: 80,
            gravity: 0.8,
            disableForReducedMotion: true,
        });
    }, [options]);

    return { fire };
}
