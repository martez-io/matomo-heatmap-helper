import * as React from 'react';
import { cn } from '@/lib/index';
import { LucideIcon } from 'lucide-react';

interface StatusSectionProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: LucideIcon;
}

const StatusSection = React.forwardRef<HTMLDivElement, StatusSectionProps>(
    ({ className, icon: Icon, children, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
            {Icon && <StatusSectionIcon icon={Icon} />}
            {children}
        </div>
    )
);
StatusSection.displayName = "StatusSection";

const StatusSectionHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { icon?: LucideIcon }
>(({ className, icon: Icon, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center gap-3 border-b border-border pb-2", className)}
        {...props}
    >
        {Icon && <div className="flex items-center justify-center bg-primary/10 rounded-md p-2"><Icon className="size-5 text-primary" /></div>}
        {children}
    </div>
));
StatusSectionHeader.displayName = "StatusSectionHeader";

const StatusSectionIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
    <Icon className="size-5 text-muted-foreground" />
);
StatusSectionIcon.displayName = "StatusSectionIcon";

const StatusSectionTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn("text-base font-medium", className)}
        {...props}
    />
));
StatusSectionTitle.displayName = "StatusSectionTitle";

const StatusSectionDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-xs text-muted-foreground", className)}
        {...props}
    />
));
StatusSectionDescription.displayName = "StatusSectionDescription";

const StatusSectionContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("bg-muted p-4 rounded-lg", className)}
        {...props}
    />
));
StatusSectionContent.displayName = "StatusSectionContent";

const StatusSectionBody = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
));
StatusSectionBody.displayName = "StatusSectionBody";

const StatusSectionActions = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex gap-2 pt-3", className)}
        {...props}
    />
));
StatusSectionActions.displayName = "StatusSectionActions";

export {
    StatusSection,
    StatusSectionHeader,
    StatusSectionTitle,
    StatusSectionDescription,
    StatusSectionContent,
    StatusSectionBody,
    StatusSectionActions,
};
