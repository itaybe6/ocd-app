import { useQuery } from '@tanstack/react-query';
import { fetchHomeCategoryCovers } from '../lib/homeCategoryCovers';

/** Bump when the homepage tile markup changes and cached covers should refresh. */
export const HOME_CATEGORY_COVERS_QUERY_KEY = ['home-category-covers', 'v1'] as const;

export function useHomeCategoryCovers() {
  return useQuery({
    queryKey: HOME_CATEGORY_COVERS_QUERY_KEY,
    queryFn: fetchHomeCategoryCovers,
    staleTime: 1000 * 60 * 10,
  });
}
