/**
 * NegativeFeedback component
 * Shows troubleshooting checklist and report issue button
 */

import { Bug, HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { TROUBLESHOOTING_ITEMS } from '../lib/constants';

interface NegativeFeedbackProps {
    onReportIssue: () => void;
    onDismiss: () => void;
}

export function NegativeFeedback({ onReportIssue, onDismiss }: NegativeFeedbackProps) {
    return (
        <div className="space-y-3 animate-slideUp w-full">
            {/* Header with dismiss button */}
            <div className="flex items-start justify-start gap-x-2 w-full border-b border-gray-200 pb-2">
                <div className="flex items-center justify-center bg-primary/10 rounded-md p-2 mt-1"><HelpCircle className="size-5 text-primary" /></div>
                <div className="flex flex-col">
                    <h2
                        className="text-base font-medium"
                    >
                        Follow these steps to fix the issue
                    </h2>
                    <p className="text-xs text-gray-600">
                        If you still need help, please report the issue.
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDismiss}
                    className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 ml-auto"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Troubleshooting checklist */}
            <Accordion type="single" collapsible className="w-full">
                {TROUBLESHOOTING_ITEMS.map(({ issue, listItems }, i) => (
                    <AccordionItem key={i} value={`item-${i}`} className="border-b border-gray-200">
                        <AccordionTrigger className="text-sm text-left hover:no-underline">
                            {issue}
                        </AccordionTrigger>
                        <AccordionContent>
                            <ul className="list-disc pl-4 space-y-1 text-sm text-gray-600 pb-2">
                                {listItems.map((item, j) => (
                                    <li key={j}>{item}</li>
                                ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            {/* Action button */}
            <div className="flex gap-2 pt-1">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onReportIssue}
                    className="text-gray-700"
                >
                    <Bug className="w-4 h-4 mr-1.5" />
                    Still stuck? Report Issue
                </Button>
            </div>
        </div>
    );
}
