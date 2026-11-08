/** Keep visible products in place when another catalog page arrives. Shuffle only new arrivals. */
export function updateDiscoveryProducts<T extends { id: string }>(previous: T[], products: T[], random = Math.random): T[] {
  const available = new Map(products.map(product => [product.id, product]));
  const retained: T[] = [];
  for (const product of previous) {
    const current = available.get(product.id);
    if (current) {
      retained.push(current);
      available.delete(product.id);
    }
  }
  const incoming = [...available.values()];
  for (let i = incoming.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [incoming[i], incoming[j]] = [incoming[j], incoming[i]];
  }
  return [...retained, ...incoming];
}
