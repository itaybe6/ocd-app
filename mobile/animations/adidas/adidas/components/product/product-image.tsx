import { memo } from "react";
import { Image } from "expo-image";

// adidas-product-infinite-carousel-animation 🔽

type ProductImageProps = {
  imageUrl: string;
  height: number;
  width: number;
};

// Memoized component: prevents re-renders when parent list updates
// Critical for performance with recycleItems - reused components shouldn't re-render unnecessarily
// Image uses expo-image for optimized loading and caching
const ProductImage = ({ imageUrl, height, width }: ProductImageProps) => {
  return <Image style={{ height, width }} source={{ uri: imageUrl }} contentFit="cover" />;
};

export default memo(ProductImage);

// adidas-product-infinite-carousel-animation 🔼
