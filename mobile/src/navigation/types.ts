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
};

