import { useEffect, useRef, useState } from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { CAROUSEL_INTERVAL, CAROUSEL_MESSAGES } from '../lib/constants.tsx';
import { PauseIcon, PlayIcon } from 'lucide-react';
import type { CarouselApi } from '@/components/ui/carousel';

export function MessageCarousel() {
    const [isPaused, setIsPaused] = useState(false);
    const [animationKey, setAnimationKey] = useState(0);
    const [api, setApi] = useState<CarouselApi>();
    const plugin = useRef(
        Autoplay({ delay: CAROUSEL_INTERVAL, stopOnInteraction: false })
    );

    useEffect(() => {
        if (!api) return;

        // Reset animation when slide changes
        api.on('select', () => {
            setAnimationKey((prev) => prev + 1);
        });
    }, [api]);

    const handleMouseEnter = () => {
        setIsPaused(true);
        plugin.current.stop();
    };

    const handleMouseLeave = () => {
        setIsPaused(false);
        plugin.current.play();
    };

    return (
        <div
            className="relative overflow-hidden bg-gradient-to-r from-primary-600 to-primary-700"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            role="region"
            aria-label="Tips carousel"
        >
            <Carousel
                setApi={setApi}
                opts={{
                    align: 'center',
                    loop: true,
                }}
                plugins={[plugin.current]}
                className="w-full"
            >
                <CarouselContent className="-ml-0">
                    {CAROUSEL_MESSAGES.map((message, index) => (
                        <CarouselItem key={index} className="pl-0">
                            <div className="py-2 flex items-center justify-center px-6 cursor-grab active:cursor-grabbing">
                                <div className="text-white text-sm font-medium text-center leading-tight">
                                    {message}
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {/* Play/Pause indicator with progress */}
            <div className="absolute top-3 right-3 pointer-events-none">
                {isPaused ? (
                    <div className="text-white text-opacity-70">
                        <PauseIcon className="size-3 mt-1 mr-1" />
                    </div>
                ) : (
                    <div className="relative" key={animationKey}>
                        {/* Circular progress background */}
                        <svg className="size-5 -rotate-90" viewBox="0 0 24 24">
                            {/* Background circle */}
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="white"
                                strokeWidth="2"
                                fill="none"
                                opacity="0.2"
                            />
                            {/* Animated progress circle */}
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="white"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray="62.83"
                                strokeDashoffset="62.83"
                                strokeLinecap="round"
                                opacity="0.8"
                                style={{
                                    animation: `fillCircle ${CAROUSEL_INTERVAL}ms linear forwards`,
                                }}
                            />
                        </svg>
                        {/* Play icon centered */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <PlayIcon className="size-2 text-white fill-white" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
