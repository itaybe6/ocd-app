import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanViewHistory, rememberProductView, type ProductView, type ViewedProduct } from './homeRecommendations';

const pending = new Map<string, Promise<ProductView[]>>();
const storageKey = (userId?: string) => `ocd:product-views:v1:${userId ? `user:${userId}` : 'guest'}`;

export async function readProductViews(userId?: string): Promise<ProductView[]> {
  const key = storageKey(userId);
  const write = pending.get(key);
  if (write) return cleanViewHistory(await write);
  try { return cleanViewHistory(JSON.parse(await AsyncStorage.getItem(key) ?? '[]')); }
  catch { return []; }
}

export function recordProductView(userId: string | undefined, product: ViewedProduct): Promise<ProductView[]> {
  const key = storageKey(userId);
  // Serialize writes for this account so quick navigation cannot overwrite a newer view.
  const previous = readProductViews(userId);
  const write = previous.then(async history => {
    const next = rememberProductView(history, product);
    try { await AsyncStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    return next;
  });
  pending.set(key, write);
  void write.finally(() => { if (pending.get(key) === write) pending.delete(key); });
  return write;
}
