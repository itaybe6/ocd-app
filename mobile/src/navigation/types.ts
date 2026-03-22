<<<<<<< HEAD
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
  Product: { handle: string };
  StoreCategory: StoreCategoryRouteParams;
  StoreProduct: { product: StoreProduct };
  StoreCart: undefined;
=======
import type { StoreProduct } from '../screens/store/StoreHomeScreen';

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  StoreCategory: {
    categoryId: string;
    categoryTitle: string;
    categoryDescription?: string;
    parentTitle?: string;
  };
  StoreProduct: {
    product: StoreProduct;
  };
  StoreCart: undefined;
  Product: { handle: string };
>>>>>>> 0abe257aba02a7fc4b68771ace6e0d8ee186cc66
};

