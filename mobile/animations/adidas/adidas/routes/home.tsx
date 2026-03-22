import { Car, PawPrint, Percent, Search, UserRound } from "lucide-react-native";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "react-native-collapsible-tab-view";
import { cn } from "@/src/shared/lib/utils/cn";
import { Marquee } from "@/src/shared/components/marquee";

// adidas-home-header-marquee-animation 🔽

/**
 * Motion intent: A continuous top ticker that surfaces promos while the header stays collapsible.
 * The marquee should feel effortless (low velocity) and never compete with scroll momentum.
 *
 * Architecture: Marquee lives inside the collapsible header (Tabs.Container renderHeader), so it
 * remains visible at the top and keeps animating independently as content scrolls underneath.
 */

type MarqueeItemProps = {
  icon: React.ReactNode;
  text: string;
};

const Header = () => {
  return (
    <View className="py-3 border-b border-neutral-200">
      {/*
        spacing: Horizontal gap between repeated chunks to prevent visual collision when looping.
        48px chosen to create a readable pause between items at this speed and text size.
        speed: Lower value = slower travel. 0.6 tuned for legibility at ~60fps without stutter.
        Note: Keep speed and spacing correlated—doubling speed usually requires ~+16–24px spacing.
      */}
      <Marquee spacing={48} speed={0.6}>
        <View className="flex-row items-center gap-12">
          <MarqueeItem
            icon={<Car size={18} color="black" strokeWidth={1} />}
            text="Безкоштовна доставка замоовлень від 2500грн"
          />
          <MarqueeItem
            icon={<Percent size={18} color="black" strokeWidth={1} />}
            text="Знижка 5% при оплаті банківською картою"
          />
          <MarqueeItem
            icon={<PawPrint size={18} color="black" fill="black" strokeWidth={1} />}
            text="Покупка частинами від monobank"
          />
        </View>
      </Marquee>
    </View>
  );
};

const MarqueeItem = ({ icon, text }: MarqueeItemProps) => {
  return (
    <View className="flex-row items-center gap-4">
      {icon}
      <Text className="font-light italic uppercase text-sm tracking-wide">{text}</Text>
    </View>
  );
};

type TabItemProps = {
  label: string;
  isActive?: boolean;
};

const TabItem = ({ label, isActive }: TabItemProps) => {
  return (
    <Text className={cn("text-sm font-light uppercase tracking-wide", isActive && "font-semibold")}>
      {label}
    </Text>
  );
};

export default function Home() {
  // Safe area ensures header content (marquee + toolbar) avoids notch/status bar overlap.
  // Using paddingTop (vs extra spacer views) keeps layout simpler for the collapsible container.
  const insets = useSafeAreaInsets();

  return (
    <>
      <View className="bg-white z-50" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white z-50">
          <Text className="text-lg font-semibold uppercase tracking-widest">Вибір Adidas</Text>

          <View className="flex-row items-center gap-5">
            <Search size={20} color="black" strokeWidth={1} />
            <UserRound size={20} color="black" strokeWidth={1} />
          </View>
        </View>
      </View>
      {/*
       * Collapsible header container:
       * - renderHeader: Injects marquee band as the collapsible header content.
       * - headerContainerStyle: Disable platform shadows to avoid double borders/elevation flicker when snapping.
       */}
      <Tabs.Container
        renderHeader={Header}
        renderTabBar={() => {
          return (
            <View
              style={{
                elevation: 0,
                shadowOpacity: 0,
                shadowColor: "transparent",
              }}
              className="flex-row gap-10 px-4 py-4 border-b border-neutral-200 bg-white"
            >
              <TabItem label="Чоловіки" isActive />
              <TabItem label="Жінки" />
              <TabItem label="Діти" />
              <TabItem label="Новинки" />
              <TabItem label="Види спорту" />
            </View>
          );
        }}
        headerContainerStyle={{ elevation: 0, shadowOpacity: 0, shadowColor: "transparent" }}
      >
        <Tabs.Tab name="Content">
          <Tabs.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ backgroundColor: "white" }}
          >
            <View className="h-[600px] bg-stone-100 justify-end px-6 pb-3">
              <View className="h-6 w-[100px] bg-white mb-1" />
              <View className="h-6 w-[130px] bg-white mb-4" />
              <View className="h-12 w-full bg-white" />
            </View>

            <View className="py-16 px-8">
              <View className="h-6 w-[110px] bg-stone-100 mb-1" />
              <View className="h-6 w-[140px] bg-stone-100 mb-4" />

              <View className="flex-row gap-2">
                <View className="h-[300px] w-[45%] bg-stone-100" />
                <View className="h-[300px] w-[45%] bg-stone-100" />
              </View>
            </View>
            <View className="py-16 px-8">
              <View className="h-6 w-[110px] bg-stone-100 mb-1" />
              <View className="h-6 w-[140px] bg-stone-100 mb-4" />

              <View className="flex-row gap-2">
                <View className="h-[300px] w-[45%] bg-stone-100" />
                <View className="h-[300px] w-[45%] bg-stone-100" />
              </View>
            </View>
            <View className="py-16 px-8">
              <View className="h-6 w-[110px] bg-stone-100 mb-1" />
              <View className="h-6 w-[140px] bg-stone-100 mb-4" />

              <View className="flex-row gap-2">
                <View className="h-[300px] w-[45%] bg-stone-100" />
                <View className="h-[300px] w-[45%] bg-stone-100" />
              </View>
            </View>
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </>
  );
}

// adidas-home-header-marquee-animation 🔼
