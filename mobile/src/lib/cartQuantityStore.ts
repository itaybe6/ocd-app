export type QuantitySnapshot = { quantity: number; isBootstrapping: boolean };

/** Per-product subscriptions: changing one quantity must not redraw the catalog. */
export function createCartQuantityStore() {
  let quantities: Readonly<Record<string, number>> = {};
  let isBootstrapping = true;
  const snapshots = new Map<string, QuantitySnapshot>();
  const listeners = new Map<string, Set<() => void>>();
  const read = (id: string): QuantitySnapshot => {
    const quantity = quantities[id] ?? 0;
    const previous = snapshots.get(id);
    if (previous?.quantity === quantity && previous.isBootstrapping === isBootstrapping) return previous;
    const next = { quantity, isBootstrapping };
    snapshots.set(id, next);
    return next;
  };
  return {
    read,
    subscribe(id: string, listener: () => void) {
      let group = listeners.get(id);
      if (!group) listeners.set(id, group = new Set());
      group.add(listener);
      return () => {
        group.delete(listener);
        if (!group.size) { listeners.delete(id); snapshots.delete(id); }
      };
    },
    publish(nextQuantities: Readonly<Record<string, number>>, bootstrapping: boolean) {
      quantities = nextQuantities;
      isBootstrapping = bootstrapping;
      for (const [id, group] of listeners) {
        const previous = snapshots.get(id);
        if (previous !== read(id)) group.forEach(listener => listener());
      }
    },
  };
}
