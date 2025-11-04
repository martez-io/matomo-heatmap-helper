import { MatomoSite } from '@/types/matomo';

interface SiteSelectorProps {
  sites: MatomoSite[];
  selectedSiteId: number | null;
  onSelectSite: (siteId: number, siteName: string) => void;
}

export function SiteSelector({ sites, selectedSiteId, onSelectSite }: SiteSelectorProps) {
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
      <select
        id="site"
        value={selectedSiteId || ''}
        onChange={handleChange}
        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-200 transition-colors cursor-pointer"
      >
        <option value="">Select a site...</option>
        {sites.map((site) => (
          <option key={site.idsite} value={site.idsite}>
            {site.name} (ID: {site.idsite})
          </option>
        ))}
      </select>
    </div>
  );
}
