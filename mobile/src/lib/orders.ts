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

export function getOrderStatusHeadline(status: CustomerOrderRow['status']) {
  if (status === 'confirmed') return 'בדרך אליך';
  if (status === 'cancelled') return 'ההזמנה בוטלה';
  return 'ההזמנה בטיפול';
}

export type CustomerOrderWithItems = CustomerOrderRow & {
  items: CustomerOrderItemRow[];
};

export async function fetchCustomerOrderWithItems(orderId: string): Promise<CustomerOrderWithItems | null> {
  const { data: orderData, error: orderError } = await supabase
    .from('customer_orders')
    .select('id, order_number, user_id, status, total_amount, currency_code, item_count, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!orderData) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from('customer_order_items')
    .select(
      'id, order_id, product_id, product_handle, product_title, image_url, unit_price, quantity, line_total, created_at'
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) throw itemsError;

  return {
    ...(orderData as CustomerOrderRow),
    items: (itemsData ?? []) as CustomerOrderItemRow[],
  };
}

export async function fetchRecentCustomerOrdersWithItems(
  userId: string,
  limit = 3
): Promise<CustomerOrderWithItems[]> {
  const { data: ordersData, error: ordersError } = await supabase
    .from('customer_orders')
    .select('id, order_number, user_id, status, total_amount, currency_code, item_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (ordersError) throw ordersError;

  const orders = (ordersData ?? []) as CustomerOrderRow[];
  if (!orders.length) return [];

  const orderIds = orders.map((order) => order.id);
  const { data: itemsData, error: itemsError } = await supabase
    .from('customer_order_items')
    .select(
      'id, order_id, product_id, product_handle, product_title, image_url, unit_price, quantity, line_total, created_at'
    )
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });

  if (itemsError) throw itemsError;

  const itemsByOrder = new Map<string, CustomerOrderItemRow[]>();
  for (const item of (itemsData ?? []) as CustomerOrderItemRow[]) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function placeCustomerOrder({
  userId,
  items,
  subtotal,
  shopifyOrderNumber,
}: {
  userId: string;
  items: CartItem[];
  subtotal: number;
  shopifyOrderNumber?: string;
}): Promise<CustomerOrderRow> {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const parsedShopifyOrderNumber = shopifyOrderNumber
    ? Number(shopifyOrderNumber.replace(/\D/g, ''))
    : null;

  const { data: orderData, error: orderError } = await supabase
    .from('customer_orders')
    .insert({
      ...(parsedShopifyOrderNumber && Number.isSafeInteger(parsedShopifyOrderNumber)
        ? { order_number: parsedShopifyOrderNumber }
        : {}),
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
