/**
 * FeedbackBar container component
 * Fixed bottom positioning with card styling
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { useConfetti } from '../hooks/useConfetti';

interface FeedbackBarProps {
    children: ReactNode;
    showConfetti?: boolean;
}

export function FeedbackBar({ children, showConfetti }: FeedbackBarProps) {
    const { fire } = useConfetti();
    const hasFired = useRef(false);

    useEffect(() => {
        if (showConfetti && !hasFired.current) {
            fire();
            hasFired.current = true;
        }
    }, [showConfetti, fire]);

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[999999] flex justify-center animate-slideInFromBottom"
            role="region"
            aria-label="Feedback"
        >
            <Card className="bg-background rounded-t-xl shadow-2xl border-primary border-2 rounded-b-none border-b-0 min-w-[min(90vw,500px)] max-w-[min(95vw,700px)] px-4 py-3">
                {children}
            </Card>
        </div>
    );
}
