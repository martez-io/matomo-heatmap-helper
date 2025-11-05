import { useQuery } from '@tanstack/react-query';
import { createMatomoClient } from '@/lib/matomo-api';
import { getCredentials, getStorage, setStorage, removeStorage } from '@/lib/storage';
import type { MatomoHeatmap } from '@/types/matomo';

export function useHeatmaps() {
  const query = useQuery({
    queryKey: ['heatmaps'],
    queryFn: async () => {
      const credentials = await getCredentials();
      if (!credentials) {
        throw new Error('No credentials configured');
      }

      // Check cache first
      const cache = await getStorage('cache:heatmaps');
      if (cache && cache.siteId === credentials.siteId) {
        const isFresh = Date.now() - cache.timestamp < 5 * 60 * 1000; // 5 min
        if (isFresh) {
          console.log('[useHeatmaps] Using cached heatmaps');
          return cache.heatmaps;
        }
      }

      // Fetch fresh data
      const client = createMatomoClient(credentials.apiUrl, credentials.authToken);
      const heatmaps = await client.getHeatmaps(credentials.siteId);
      console.log(`[useHeatmaps] Fetched ${heatmaps.length} heatmaps from API`);

      // Cache the result
      await setStorage('cache:heatmaps', {
        siteId: credentials.siteId,
        heatmaps,
        timestamp: Date.now(),
      });

      return heatmaps;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Wrapper that clears cache before refetching to force server fetch
  const refetchFromServer = async () => {
    console.log('[useHeatmaps] Force refresh - clearing cache and fetching from server');
    await removeStorage('cache:heatmaps');
    return query.refetch({ cancelRefetch: true });
  };

  return {
    ...query,
    refetchFromServer,
  };
}

export function useSelectedHeatmap() {
  return useQuery({
    queryKey: ['selectedHeatmap'],
    queryFn: async (): Promise<MatomoHeatmap | null> => {
      const heatmapId = await getStorage('ui:selectedHeatmapId');
      if (!heatmapId) return null;

      // Get from heatmaps cache
      const cache = await getStorage('cache:heatmaps');
      if (cache) {
        const heatmap = cache.heatmaps.find((h) => h.idsitehsr === heatmapId);
        if (heatmap) return heatmap;
      }

      return null;
    },
  });
}
