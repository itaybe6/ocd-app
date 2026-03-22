import { View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { ProductItem } from "../../lib/data/product-items";

// adidas-product-infinite-carousel-animation 🔽

// Pagination indicator dimensions: 1px dash height with 20px spacing creates visual rhythm
// Total spacing per item = DASH_HEIGHT + DASH_SPACING = 21px
const DASH_HEIGHT = 1;
const DASH_SPACING = 20;

type PaginationProps = {
  productItems: ProductItem[];
  currentSlideIndex: SharedValue<number>;
};

const Pagination = ({ productItems, currentSlideIndex }: PaginationProps) => {
  // Derives vertical position from slide index: multiplies index by item spacing (21px)
  // withSpring adds natural bounce physics, making indicator movement feel responsive
  // Runs on UI thread, recalculates only when currentSlideIndex changes
  const translateY = useDerivedValue(() => {
    return withSpring(currentSlideIndex.get() * (DASH_HEIGHT + DASH_SPACING));
  });

  // Animated indicator style: uses transform (not top/left) for hardware acceleration
  // translateY moves indicator vertically without triggering layout recalculation
  // Reads derived value on UI thread, updates every frame during spring animation
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.get() }],
    };
  });

  return (
    <View className="absolute right-3 self-center top-1/2 -translate-y-1/2">
      {productItems.map((_, index) => (
        <View
          className="w-1.5 bg-black"
          key={index}
          style={{ height: DASH_HEIGHT, marginVertical: DASH_SPACING / 2 }}
        />
      ))}
      {/* Animated indicator: height matches DASH_SPACING (20px) to span one dash + spacing
          Positioned absolutely, moves via translateY transform for smooth 60fps animation
          Uses Animated.View (createAnimatedComponent) to enable UI thread animations */}
      <Animated.View
        className="absolute w-1.5 bg-black"
        style={[animatedIndicatorStyle, { height: DASH_SPACING }]}
      />
    </View>
  );
};

export default Pagination;

// adidas-product-infinite-carousel-animation 🔼
