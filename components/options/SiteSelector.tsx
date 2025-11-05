import { RefreshCw } from 'lucide-react';
import { MatomoSite } from '@/types/matomo';

interface SiteSelectorProps {
  sites: MatomoSite[];
  selectedSiteId: number | null;
  onSelectSite: (siteId: number, siteName: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function SiteSelector({ sites, selectedSiteId, onSelectSite, onRefresh, isRefreshing }: SiteSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      const site = sites.find((s) => s.idsite === parseInt(value));
      if (site) {
        onSelectSite(site.idsite, site.name);
      }
    }
  };

  return (
    <div className="mb-6">
      <label htmlFor="site" className="block text-sm font-medium text-gray-700 mb-2">
        Select Site
      </label>
      <div className="flex items-center gap-2">
        <select
          id="site"
          value={selectedSiteId || ''}
          onChange={handleChange}
          className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-200 transition-colors cursor-pointer"
        >
          <option value="">Select a site...</option>
          {sites.map((site) => (
            <option key={site.idsite} value={site.idsite}>
              {site.name} (ID: {site.idsite})
            </option>
          ))}
        </select>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh sites from Matomo"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
