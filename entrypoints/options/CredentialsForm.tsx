import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

/**
 * Sanitize Matomo URL to only include protocol and domain
 */
function sanitizeUrl(url: string): string {
    try {
        const trimmed = url.trim();
        const parsed = new URL(trimmed);
        // Remove trailing slash, path, query, and hash
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        // If URL is invalid, return as-is and let validation handle it
        return url.trim();
    }
}

const credentialsSchema = z.object({
    apiUrl: z.string().url('Please enter a valid URL (e.g., https://matomo.example.com)'),
    authToken: z.string().min(1, 'Auth token is required'),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;

interface CredentialsFormProps {
    onValidate: (apiUrl: string, authToken: string) => Promise<void>;
    isLoading: boolean;
    validationStatus: 'idle' | 'loading' | 'validated' | 'credentials-changed' | 'error';
    initialValues?: Partial<CredentialsFormData>;
}

export function CredentialsForm({ onValidate, isLoading, validationStatus, initialValues }: CredentialsFormProps) {
    const [showToken, setShowToken] = useState(false);

    const form = useForm<CredentialsFormData>({
        resolver: zodResolver(credentialsSchema),
        defaultValues: initialValues,
    });

    // Sync form values when initialValues prop changes
    useEffect(() => {
        form.reset(initialValues || { apiUrl: '', authToken: '' });
    }, [initialValues, form]);

    const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const sanitized = sanitizeUrl(e.target.value);
        form.setValue('apiUrl', sanitized);
    };

    const onSubmit = async (data: CredentialsFormData) => {
        // Sanitize URL before validation
        const sanitizedUrl = sanitizeUrl(data.apiUrl);
        await onValidate(sanitizedUrl, data.authToken);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="apiUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium">Matomo Instance URL</FormLabel>
                            <FormControl>
                                <Input
                                    type="text"
                                    placeholder="https://matomo.example.com"
                                    {...field}
                                    onBlur={(e) => {
                                        field.onBlur();
                                        handleUrlBlur(e);
                                    }}
                                    className="h-10"
                                />
                            </FormControl>
                            <FormDescription className="text-xs">
                                Your Matomo server URL (without trailing slash)
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="authToken"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium">Auth Token</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        type={showToken ? 'text' : 'password'}
                                        placeholder="Enter your auth token"
                                        {...field}
                                        className="h-10 pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-0 top-0 h-10 w-10 px-0 hover:bg-transparent"
                                    >
                                        {showToken ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="sr-only">
                                            {showToken ? 'Hide token' : 'Show token'}
                                        </span>
                                    </Button>
                                </div>
                            </FormControl>
                            <FormDescription className="text-xs">
                                Found in Matomo under Personal → Security → Auth Tokens
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Security note */}
                <div className="flex items-start gap-3 mt-6 p-4 rounded-lg bg-muted/50 border border-border/40">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                        Your credentials are stored securely in the browser's extension storage and cannot be accessed by websites you visit.
                    </p>
                </div>

                <Button
                    type="submit"
                    className="w-full h-10 gap-2"
                    disabled={isLoading}
                >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Validate and Save
                </Button>
            </form>
        </Form>
    );
}
