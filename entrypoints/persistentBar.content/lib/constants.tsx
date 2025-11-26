import type { ProcessingStep } from '@/types/storage';
import { BinocularsIcon, CameraIcon, CircleCheckBig, ExpandIcon, SearchCheckIcon } from 'lucide-react';
import { getPlatformName } from '@/lib/platform';

// Processing step configurations
export const STEP_CONFIGS: Record<
    ProcessingStep,
    {
        label: string;
        description: string;
        icon: any;
    }
> = {
    validating: {
        label: 'Validating',
        description: 'Checking heatmap configuration...',
        icon: SearchCheckIcon,
    },
    expanding: {
        label: 'Expanding',
        description: 'Expanding scrollable elements...',
        icon: ExpandIcon,
    },
    capturing: {
        label: 'Capturing',
        description: 'Taking screenshot...',
        icon: CameraIcon,
    },
    verifying: {
        label: 'Verifying',
        description: 'Confirming screenshot was captured...',
        icon: BinocularsIcon,
    },
    complete: {
        label: 'Complete',
        description: 'Screenshot captured successfully!',
        icon: CircleCheckBig,
    },
};

export const STEP_ORDER: ProcessingStep[] = [
    'validating',
    'expanding',
    'capturing',
    'verifying',
    'complete',
];

// Carousel configurations
const utmParams = `mtm_source=matomo-heatmap-helper&mtm_medium=${getPlatformName()}-extension&mtm_campaign=carousel`;

export const CAROUSEL_MESSAGES = [
    <span>Need Support? Hire an official <a className="underline" href={`https://matomo.org/request-matomo-partner/?${utmParams}`} target="_blank" rel="noopener noreferrer">Matomo Partner</a> </span>,
    <span>ROAS and Marketing Attribution for Matomo: <a className="underline" href={`https://www.martez.io/?${utmParams}`} target="_blank" rel="noopener noreferrer">Join waitlist</a></span>,
    <span>Want to become an official <a className="underline" href={`https://matomo.org/matomo-partner-programme/?${utmParams}`} target="_blank" rel="noopener noreferrer">Matomo Partner</a>?</span>,
];

export const CAROUSEL_INTERVAL = 15000; // 15 seconds
