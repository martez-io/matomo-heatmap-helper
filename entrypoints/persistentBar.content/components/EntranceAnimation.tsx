/**
 * Entrance Animation Component
 * Creates a heatmap-themed entrance effect with page darkening and hot zone blobs rising from below
 */

import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { getAlwaysShowEntranceAnimation, getHasSeenEntranceAnimation, setHasSeenEntranceAnimation, getAnimationPending, setAnimationPending } from '@/lib/storage';

type AnimationPhase = 'loading' | 'skipped' | 'ready' | 'darkening' | 'mystical-light' | 'bar-entering' | 'fading-out' | 'complete';

interface EntranceAnimationContextValue {
    phase: AnimationPhase;
    isBarVisible: boolean;
}

const EntranceAnimationContext = createContext<EntranceAnimationContextValue>({
    phase: 'complete',
    isBarVisible: true,
});

export function useEntranceAnimation() {
    return useContext(EntranceAnimationContext);
}

interface EntranceAnimationProps {
    children: React.ReactNode;
    onComplete?: () => void;
}

export function EntranceAnimation({ children, onComplete }: EntranceAnimationProps) {
    const [phase, setPhase] = useState<AnimationPhase>('loading');
    const onCompleteRef = useRef(onComplete);

    // Update ref when callback changes
    onCompleteRef.current = onComplete;

    // Pre-generate hot zone blob configurations
    const hotZones = useMemo(() =>
        Array.from({ length: 5 }).map((_, i) => ({
            id: i,
            // Cluster around center (40-60%), with slight spread
            xOffset: -10 + Math.random() * 20,
            // Vary the vertical position slightly
            yOffset: Math.random() * 30,
            // Each blob has different size
            size: 180 + Math.random() * 120,
            // Stagger animation timing
            delay: i * 0.3,
            // Different wandering cycle duration per blob
            duration: 8 + Math.random() * 6,
        })),
        []);

    // Store timer refs so they persist across renders
    const timersRef = useRef<NodeJS.Timeout[]>([]);

    // Check if animation should be shown and run the sequence
    useEffect(() => {
        async function startAnimation() {
            // Check settings and pending flag
            const [alwaysShow, hasSeen, isPending] = await Promise.all([
                getAlwaysShowEntranceAnimation(),
                getHasSeenEntranceAnimation(),
                getAnimationPending(),
            ]);

            // Only animate if triggered from popup (isPending) AND (always show enabled OR first time)
            const shouldAnimate = isPending && (alwaysShow || !hasSeen);

            // Clear the pending flag immediately
            if (isPending) {
                await setAnimationPending(false);
            }

            if (!shouldAnimate) {
                setPhase('skipped');
                onCompleteRef.current?.();
                return;
            }

            // Start the animation sequence
            // First render overlay in hidden "ready" state, then transition to darkening
            // This allows CSS transitions to work (they need a "before" state)
            setPhase('ready');

            // After one frame, start the actual animation
            // Double RAF ensures the browser has painted the "ready" state
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Timeline (from this point):
                    // 0.0s - darkening starts (overlay fades in over 2s)
                    // 2.0s - mystical-light (overlay fully dark, hot zones rise, glow appears)
                    // 4.5s - bar-entering (bar slides up, hot zones at full intensity)
                    // 6.5s - fading-out (overlay fades, hot zones fade)
                    // 9.0s - complete
                    setPhase('darkening');

                    // Phase 1: Darkening lasts 2s (matches CSS transition duration)
                    timersRef.current.push(setTimeout(() => {
                        setPhase('mystical-light');
                    }, 2000));

                    // Phase 2: Mystical light + hot zones rising, bar starts entering at 4.5s
                    timersRef.current.push(setTimeout(() => {
                        setPhase('bar-entering');
                    }, 4500));

                    // Phase 3: Start fading out overlay at 6.5s
                    timersRef.current.push(setTimeout(() => {
                        setPhase('fading-out');
                    }, 6500));

                    // Phase 4: Complete at 9s (after fade-out transition finishes)
                    timersRef.current.push(setTimeout(async () => {
                        // Mark as seen when animation completes
                        await setHasSeenEntranceAnimation(true);
                        setPhase('complete');
                        onCompleteRef.current?.();
                    }, 9000));
                });
            });
        }

        startAnimation();

        // Cleanup on unmount only
        return () => {
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current = [];
        };
    }, []);

    const isAnimating = phase !== 'complete' && phase !== 'skipped' && phase !== 'loading';
    const isBarVisible = phase === 'bar-entering' || phase === 'fading-out' || phase === 'complete' || phase === 'skipped';

    return (
        <EntranceAnimationContext.Provider value={{ phase, isBarVisible }}>
            {/* Full-page overlay for darkening effect */}
            {isAnimating && (
                <div className="entrance-overlay" data-phase={phase}>
                    {/* Central glow */}
                    <div className="mystical-glow" />

                    {/* Heatmap hot zone - wandering blobs */}
                    <div className="hot-zone">
                        {hotZones.map((blob) => (
                            <div
                                key={blob.id}
                                className="hot-blob"
                                style={{
                                    '--x-offset': `${blob.xOffset}%`,
                                    '--y-offset': `${blob.yOffset}px`,
                                    '--size': `${blob.size}px`,
                                    '--delay': `${blob.delay}s`,
                                    '--duration': `${blob.duration}s`,
                                } as React.CSSProperties}
                            />
                        ))}
                    </div>

                    {/* Grain overlay for heatmap texture */}
                    <div className="grain-overlay">
                        <svg width="100%" height="100%">
                            <filter id="grain-filter">
                                <feTurbulence
                                    type="fractalNoise"
                                    baseFrequency="0.75"
                                    numOctaves="4"
                                    stitchTiles="stitch"
                                    result="noise"
                                />
                                <feColorMatrix
                                    type="saturate"
                                    values="0"
                                    in="noise"
                                    result="mono"
                                />
                            </filter>
                            <rect width="100%" height="100%" filter="url(#grain-filter)" opacity="0.4" />
                        </svg>
                    </div>
                </div>
            )}

            {/* The actual bar content */}
            {children}
        </EntranceAnimationContext.Provider>
    );
}
