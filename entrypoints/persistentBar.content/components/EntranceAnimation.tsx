/**
 * Entrance Animation Component
 * Creates a mystical entrance effect with page darkening and sparkles from below
 */

import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { getAlwaysShowEntranceAnimation, getHasSeenEntranceAnimation, setHasSeenEntranceAnimation, getAnimationPending, setAnimationPending } from '@/lib/storage';

type AnimationPhase = 'loading' | 'skipped' | 'darkening' | 'mystical-light' | 'bar-entering' | 'fading-out' | 'complete';

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

    // Pre-generate particle positions to avoid re-renders changing them
    const particles = useMemo(() =>
        Array.from({ length: 18 }).map((_, i) => ({
            id: i,
            delay: 1 + Math.random() * 3,
            xStart: 40 + Math.random() * 20,
            xEnd: 20 + Math.random() * 50,
            size: 10 + Math.random() * 5,
            duration: 6 + Math.random() * 3,
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
            setPhase('darkening');

            // Phase 1: Darkening (0-1s), glow starts at 1s
            timersRef.current.push(setTimeout(() => {
                setPhase('mystical-light');
            }, 1000));

            // Phase 2: Mystical light + particles, bar starts entering at 3.5s
            timersRef.current.push(setTimeout(() => {
                setPhase('bar-entering');
            }, 3500));

            // Phase 3: Start fading out overlay at 5.5s
            timersRef.current.push(setTimeout(() => {
                setPhase('fading-out');
            }, 5500));

            // Phase 4: Complete at 8s (after fade-out transition finishes)
            timersRef.current.push(setTimeout(async () => {
                // Mark as seen when animation completes
                await setHasSeenEntranceAnimation(true);
                setPhase('complete');
                onCompleteRef.current?.();
            }, 8000));
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

                    {/* Particle effects / sparkles */}
                    <div className="particles">
                        {particles.map((p) => (
                            <div
                                key={p.id}
                                className="particle"
                                style={{
                                    '--delay': `${p.delay}s`,
                                    '--x-start': `${p.xStart}%`,
                                    '--x-end': `${p.xEnd}%`,
                                    '--size': `${p.size}px`,
                                    '--duration': `${p.duration}s`,
                                } as React.CSSProperties}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* The actual bar content */}
            {children}
        </EntranceAnimationContext.Provider>
    );
}
