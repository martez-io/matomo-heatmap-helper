import { useQuery } from '@tanstack/react-query';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, getStorage, setStorage } from '@/lib/storage';
import type { MatomoHeatmap } from '@/types/matomo';

export function useHeatmaps(siteId: number | null) {
  const query = useQuery({
    queryKey: ['heatmaps', siteId],
    queryFn: async () => {
      if (!siteId) {
        throw new Error('No site ID provided');
      }

      const credentials = await getCredentials();
      if (!credentials) {
        throw new Error('No credentials configured');
      }

      // Check cache first
      const cache = await getStorage('cache:heatmaps');
      if (cache && cache[siteId]) {
        const siteCache = cache[siteId];
        const isFresh = Date.now() - siteCache.timestamp < 5 * 60 * 1000; // 5 min
        if (isFresh) {
          console.log(`[useHeatmaps] Using cached heatmaps for site ${siteId}`);
          return siteCache.heatmaps;
        }
      }

      // Fetch fresh data
      const client = createMatomoClient(credentials.apiUrl, credentials.authToken);
      const heatmaps = await client.getHeatmaps(siteId);
      console.log(`[useHeatmaps] Fetched ${heatmaps.length} heatmaps from API for site ${siteId}`);

      // Cache the result
      const existingCache = (await getStorage('cache:heatmaps')) || {};
      await setStorage('cache:heatmaps', {
        ...existingCache,
        [siteId]: {
          heatmaps,
          timestamp: Date.now(),
        },
      });

      return heatmaps;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: siteId !== null, // Only run query if siteId is provided
  });

  // Wrapper that clears cache before refetching to force server fetch
  const refetchFromServer = async () => {
    if (!siteId) return;

    console.log(`[useHeatmaps] Force refresh - clearing cache and fetching from server for site ${siteId}`);

    // Clear only this site's cache
    const cache = (await getStorage('cache:heatmaps')) || {};
    delete cache[siteId];
    await setStorage('cache:heatmaps', cache);

    return query.refetch({ cancelRefetch: true });
  };

  return {
    ...query,
    refetchFromServer,
  };
}

export function useSelectedHeatmap(siteId: number | null) {
  return useQuery({
    queryKey: ['selectedHeatmap', siteId],
    queryFn: async (): Promise<MatomoHeatmap | null> => {
      if (!siteId) return null;

      const heatmapId = await getStorage('ui:selectedHeatmapId');
      if (!heatmapId) return null;

      // Get from heatmaps cache for this site
      const cache = await getStorage('cache:heatmaps');
      if (cache && cache[siteId]) {
        const heatmap = cache[siteId].heatmaps.find((h) => h.idsitehsr === heatmapId);
        if (heatmap) return heatmap;
      }

      return null;
    },
    enabled: siteId !== null,
  });
}
