import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import type { ProductFavoriteRow } from '../types/database';
import type { ShopifyProduct } from './shopify';

export type FavoriteProductInput = {
  product_id: string;
  product_handle: string;
  product_title: string;
  product_description?: string | null;
  product_type?: string | null;
  image_url?: string | null;
  image_alt_text?: string | null;
  price: number;
  currency_code: string;
};

export function favoriteInputFromShopify(product: ShopifyProduct): FavoriteProductInput {
  return {
    product_id: product.id,
    product_handle: product.handle,
    product_title: product.title,
    product_description: product.description,
    product_type: product.productType,
    image_url: product.imageUrl,
    image_alt_text: product.imageAltText,
    price: product.price,
    currency_code: product.currencyCode,
  };
}

export function favoriteInputFromStoreProduct(product: StoreProduct): FavoriteProductInput {
  return {
    product_id: product.id,
    product_handle: product.handle,
    product_title: product.name,
    product_description: product.description,
    product_type: product.subtitle,
    image_url: product.imageUrl,
    image_alt_text: product.imageAltText,
    price: product.price,
    currency_code: product.currencyCode,
  };
}

export function formatFavoritePrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

export function toStoreProductLike(favorite: ProductFavoriteRow): StoreProduct {
  return {
    id: favorite.product_id,
    name: favorite.product_title,
    subtitle: favorite.product_type?.trim() || 'מוצר',
    categoryId: 'favorites',
    price: favorite.price,
    currencyCode: favorite.currency_code || 'ILS',
    handle: favorite.product_handle,
    description: favorite.product_description ?? '',
    coverColor: '#F3F4F6',
    accentColor: '#FFFFFF',
    imageUrl: favorite.image_url ?? null,
    imageAltText: favorite.image_alt_text ?? null,
    variantId: '',
    variantTitle: null,
    availableForSale: false,
  };
}
