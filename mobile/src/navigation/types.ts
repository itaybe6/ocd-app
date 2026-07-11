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
        initialTab?: 'home' | 'search';
        initialTabRequestId?: number;
        /** After customer sign-up, open profile (home with user details) once. */
        initialCustomerProfile?: boolean;
        /** Open customer OCD+ membership management inside the personal area. */
        initialCustomerOcdPlus?: boolean;
      }
    | undefined;
  Login: undefined;
  Register: undefined;
  StoreOcdPlus: undefined;
  StoreFavorites: undefined;
  StoreSearch: undefined;
  Product: { handle: string };
  StoreCategory: StoreCategoryRouteParams;
  StoreProduct: { product: StoreProduct };
  StoreCart: undefined;
  StoreCheckout: { checkoutUrl: string };
  OrderSuccess: { orderNumber?: string } | undefined;
};

