/**
 * Site Selector - Allows manual site selection when enforce mode is enabled
 */
import { useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MatomoSite } from '@/types/matomo';

interface SiteSelectorProps {
  sites: MatomoSite[];
  defaultSiteId?: number;
  onSelect: (siteId: number, siteName: string) => void;
  isLoading?: boolean;
}

export function SiteSelector({ sites, defaultSiteId, onSelect, isLoading = false }: SiteSelectorProps) {
  // Guard against empty sites array
  if (!sites || sites.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <ArrowRightLeft className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary-900">No Sites Available</p>
            <p className="text-xs text-primary-700">
              No sites found with write access. Please check your Matomo permissions or credentials.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [selectedSiteId, setSelectedSiteId] = useState<number>(
    defaultSiteId ?? sites[0].idsite
  );

  const handleContinue = () => {
    const selectedSite = sites.find((site) => site.idsite === selectedSiteId);
    if (selectedSite) {
      onSelect(selectedSite.idsite, selectedSite.name);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <ArrowRightLeft className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary-900">Enforce Mode Active</p>
          <p className="text-xs text-primary-700">
            Select a site from your Matomo instance. The page's tracker will be overridden for debugging.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="site-select" className="text-sm font-medium text-foreground">
          Select Site
        </label>
        <select
          id="site-select"
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          disabled={isLoading}
        >
          {sites.map((site) => (
            <option key={site.idsite} value={site.idsite}>
              {site.name} (ID: {site.idsite})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {sites.length} site{sites.length !== 1 ? 's' : ''} available with write access
        </p>
      </div>

      <Button
        onClick={handleContinue}
        disabled={isLoading || !selectedSiteId}
        className="w-full"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continue
      </Button>
    </div>
  );
}
