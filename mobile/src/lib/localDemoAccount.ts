import type { UserRow } from '../types/database';

// Local UI fixture only. No server account, token, SMS or Shopify identity.
// A deliberately non-UUID id cannot refer to a real database customer.
export const LOCAL_DEMO_USER_ID = 'local-demo-adir';
export const LOCAL_DEMO_PHONE = '972521234567';

export function isLocalDemoPhone(phone: string): boolean {
  if (!__DEV__) return false;
  const digits = phone.replace(/[\s()+-]/g, '');
  return digits === '0521234567' || digits === LOCAL_DEMO_PHONE;
}

export function isLocalDemoUser(id?: string | null): boolean {
  return __DEV__ && id === LOCAL_DEMO_USER_ID;
}

export function verifyLocalDemoAccount(phone: string, code: string): Omit<UserRow, 'password'> {
  if (!isLocalDemoPhone(phone) || code.trim() !== '123456') throw new Error('קוד אימות שגוי');
  return {
    id: LOCAL_DEMO_USER_ID, name: 'אדיר', phone: LOCAL_DEMO_PHONE,
    role: 'customer', ocd_plus_subscriber: false, shopify_customer_id: null,
    email: null, address: null, avatar_url: null,
  };
}
