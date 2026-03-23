import type { StoreProduct, StoreSubcategory } from '../screens/store/StoreHomeScreen';

export type StoreCategoryRouteParams = {
  categoryId: string;
  categoryTitle: string;
  categoryDescription?: string;
  parentTitle?: string;
  subcategories?: StoreSubcategory[];
};

export type RootStackParamList = {
  Main:
    | {
        initialTab?: 'home' | 'categories' | 'search';
        initialTabRequestId?: number;
      }
    | undefined;
  Login: undefined;
  StoreOcdPlus: undefined;
  StoreFavorites: undefined;
  StoreSearch: undefined;
  Product: { handle: string };
  StoreCategory: StoreCategoryRouteParams;
  StoreProduct: { product: StoreProduct };
  StoreCart: undefined;
  StoreCheckout: { checkoutUrl: string };
};

