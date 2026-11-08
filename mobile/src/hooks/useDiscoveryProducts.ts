import { useState } from 'react';
import { updateDiscoveryProducts } from '../lib/productDiscovery';

export function useDiscoveryProducts<T extends { id: string }>(products: T[], resetKey: number): T[] {
  const [discovery, setDiscovery] = useState(() => ({
    source: products, resetKey, items: updateDiscoveryProducts([], products),
  }));
  // Adjust on a new catalog snapshot before React commits, keeping cached products
  // visible immediately and avoiding a second, empty frame from an effect.
  if (discovery.source !== products || discovery.resetKey !== resetKey) {
    const items = updateDiscoveryProducts(discovery.resetKey === resetKey ? discovery.items : [], products);
    setDiscovery({ source: products, resetKey, items });
    return items;
  }
  return discovery.items;
}
