import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createStoreResourceReader } from '../lib/storeResources';

export function useStoreResources() {
  const client = useQueryClient();
  return useMemo(() => createStoreResourceReader(client), [client]);
}
