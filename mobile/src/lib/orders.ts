import type { CartItem } from '../state/CartContext';
import type { CustomerOrderItemRow, CustomerOrderRow } from '../types/database';
import { supabase } from './supabase';

export function formatOrderPrice(amount: number | string, currencyCode = 'ILS') {
  const normalizedAmount = Number(amount ?? 0);
  if (currencyCode === 'ILS') return `₪${normalizedAmount.toLocaleString('he-IL')}.00`;
  return `${normalizedAmount.toLocaleString('he-IL')} ${currencyCode}`;
}

export function formatOrderDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function getOrderStatusLabel(status: CustomerOrderRow['status']) {
  if (status === 'confirmed') return 'אושרה';
  if (status === 'cancelled') return 'בוטלה';
  return 'בטיפול';
}

export async function placeCustomerOrder({
  userId,
  items,
  subtotal,
}: {
  userId: string;
  items: CartItem[];
  subtotal: number;
}): Promise<CustomerOrderRow> {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const { data: orderData, error: orderError } = await supabase
    .from('customer_orders')
    .insert({
      user_id: userId,
      total_amount: subtotal,
      currency_code: 'ILS',
      item_count: itemCount,
      status: 'confirmed',
    })
    .select('id, order_number, user_id, status, total_amount, currency_code, item_count, created_at')
    .single();

  if (orderError) throw orderError;

  const order = orderData as CustomerOrderRow;
  const rows: Omit<CustomerOrderItemRow, 'id' | 'created_at'>[] = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_handle: item.product.handle,
    product_title: item.product.name,
    image_url: item.product.imageUrl,
    unit_price: item.product.price,
    quantity: item.quantity,
    line_total: item.product.price * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('customer_order_items').insert(rows);
  if (itemsError) throw itemsError;

  return order;
}
