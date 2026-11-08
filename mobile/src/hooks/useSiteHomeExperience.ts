import { useQuery } from '@tanstack/react-query';
import { fetchSiteHomeExperience } from '../lib/siteHomeContent';

export const SITE_HOME_EXPERIENCE_QUERY_KEY = ['site-home-experience', 'v1'] as const;

export function useSiteHomeExperience() {
  return useQuery({
    queryKey: SITE_HOME_EXPERIENCE_QUERY_KEY,
    queryFn: fetchSiteHomeExperience,
    staleTime: 1000 * 60 * 2,
  });
}
