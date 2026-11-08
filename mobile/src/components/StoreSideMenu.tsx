import { radii } from '../theme/radii';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Phone, Search } from 'lucide-react-native';
import { ModalSheet, SheetScrollView } from './ModalSheet';
import type { RemoteBrand } from '../lib/brands';
import { normalizeBrandImageUrl } from '../lib/brands';

export type StoreSideMenuSection = {
  id: string;
  title: string;
  categoryId?: string;
  children?: Array<{
    id: string;
    title: string;
    categoryId: string;
    parentTitle?: string;
    categoryDescription?: string;
  }>;
};

type StoreSideMenuProps = {
  visible: boolean;
  onClose: () => void;
  sections: StoreSideMenuSection[];
  expandedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  onPressSection: (section: StoreSideMenuSection) => void;
  onPressChild: (
    section: StoreSideMenuSection,
    child: NonNullable<StoreSideMenuSection['children']>[number],
  ) => void;
  onSearchPress: () => void;
  onProfilePress: () => void;
  onFavoritesPress?: () => void;
  brands?: RemoteBrand[];
  onPressBrand?: (brand: RemoteBrand) => void;
};

const STORE_PHONE = '08-6422822';
const STORE_PHONE_TEL = 'tel:086422822';

/** Same brand groups the website menu shows under each top category. */
const CATEGORY_BRAND_HANDLES: Record<string, string[]> = {
  'חומרי-ניקיון': ['סנו-1', 'סוסיטסא', 'סאג', 'מארזי-ניקיון-משתלמים-copy-1', 'יעקבי', 'פינל-1', 'מוצרי-tnx', 'ocd', 'טאצ'],
  'בישום-חללים': ['voluspa', 'דקרודו', 'cereria-molla', 'spring-collection'],
  'מרככי-כביסה-וטקסטיל': ['פינל-1', 'מוצרי-פרפיוםכביסכל', 'מוצרי-tnx', 'mari', 'be-fresh'],
  'אביזרי-נקיון': ['טירולר', 'shiny', 'יעקבי'],
};

const SECTION_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SECTION_MS = 240;

function AnimatedChevron({ open }: { open: boolean }) {
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: SECTION_MS, easing: SECTION_EASE });
  }, [open, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
    </Animated.View>
  );
}

function CollapsibleSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  const progress = useSharedValue(open ? 1 : 0);
  const measured = useSharedValue(0);
  const [hasOpened, setHasOpened] = useState(open);

  useEffect(() => {
    if (open) setHasOpened(true);
    progress.value = withTiming(open ? 1 : 0, { duration: SECTION_MS, easing: SECTION_EASE });
  }, [open, progress]);

  const clipStyle = useAnimatedStyle(() => ({
    height: measured.value * progress.value,
    opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
  }));

  return (
    <Animated.View style={[styles.collapseClip, clipStyle]} pointerEvents={open ? 'auto' : 'none'}>
      {hasOpened ? <View
        style={styles.collapseMeasure}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          if (next > 0 && Math.abs(next - measured.value) > 1) {
            if (measured.value === 0 && open) {
              progress.value = 0;
              progress.value = withTiming(1, { duration: SECTION_MS, easing: SECTION_EASE });
            }
            measured.value = next;
          }
        }}
      >
        {children}
      </View> : null}
    </Animated.View>
  );
}

function brandsForCategory(categoryId: string | undefined, brands: RemoteBrand[]): RemoteBrand[] {
  if (!categoryId) return [];
  const handles = CATEGORY_BRAND_HANDLES[categoryId];
  if (!handles?.length) return [];
  const byHandle = new Map(brands.map((brand) => [brand.handle, brand]));
  return handles.flatMap((handle) => {
    const brand = byHandle.get(handle);
    return brand ? [brand] : [];
  });
}

export type StoreSideMenuHandle = { open: () => void; close: () => void };

// Keep menu interaction state out of the storefront's product-heavy render tree.
export const StoreSideMenu = forwardRef<StoreSideMenuHandle, Omit<StoreSideMenuProps, 'visible' | 'onClose' | 'expandedSections' | 'onToggleSection'>>(function StoreSideMenu(props, ref) {
  const [visible, setVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const close = useCallback(() => setVisible(false), []);
  useImperativeHandle(ref, () => ({ open: () => setVisible(true), close }), [close]);
  const toggle = useCallback((id: string) => {
    setExpandedSections((current) => ({ ...current, [id]: !current[id] }));
  }, []);
  return <StoreSideMenuContent {...props} visible={visible} onClose={close} expandedSections={expandedSections} onToggleSection={toggle} />;
});

function StoreSideMenuContent({
  visible,
  onClose,
  sections,
  expandedSections,
  onToggleSection,
  onPressSection,
  onPressChild,
  onSearchPress,
  brands = [],
  onPressBrand,
}: StoreSideMenuProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const sheetHeight = Math.round(screenHeight * 0.86);
  const listMaxHeight = Math.max(220, sheetHeight - 224);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const closeAndNavigate = (action: () => void) => {
    if (pendingNavigation.current) return;
    pendingNavigation.current = action;
    onClose();
  };
  const afterClose = useCallback(() => {
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    action?.();
  }, []);
  useEffect(() => {
    if (visible) pendingNavigation.current = null;
  }, [visible]);

  const handleSearch = () => {
    closeAndNavigate(onSearchPress);
  };

  const handlePhone = () => {
    void Linking.openURL(STORE_PHONE_TEL);
  };

  const handleBrand = (brand: RemoteBrand) => {
    closeAndNavigate(() => onPressBrand?.(brand));
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      onAfterClose={afterClose}
      dismissOnScroll
      containerStyle={{ maxHeight: sheetHeight, backgroundColor: '#FFFFFF' }}
    >
      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Text style={styles.title}>תפריט</Text>

        <Pressable
          onPress={handleSearch}
          style={styles.searchBar}
          accessibilityRole="button"
          accessibilityLabel="חיפוש מוצרים"
        >
          <Search size={18} color="#9CA3AF" strokeWidth={2} />
          <Text style={styles.searchPlaceholder}>חיפוש מוצרים</Text>
        </Pressable>

        <SheetScrollView
          style={{ maxHeight: listMaxHeight, flexGrow: 0 }}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section) => {
            const hasChildren = !!section.children?.length;
            const isExpanded = !!expandedSections[section.id];
            const categoryBrands = brandsForCategory(section.categoryId, brands);

            return (
              <View key={section.id}>
                <Pressable
                  onPress={() => {
                    if (hasChildren) {
                      onToggleSection(section.id);
                      return;
                    }
                    closeAndNavigate(() => onPressSection(section));
                  }}
                  style={styles.menuRow}
                >
                  {hasChildren ? (
                    <AnimatedChevron open={isExpanded} />
                  ) : (
                    <View style={styles.chevronSpacer} />
                  )}
                  <Text style={styles.menuRowTitle}>{section.title}</Text>
                </Pressable>

                {hasChildren ? (
                  <CollapsibleSection open={isExpanded}>
                  <View style={styles.submenuWrap}>
                    <Pressable onPress={() => closeAndNavigate(() => onPressSection(section))} style={styles.submenuRow}>
                      <Text style={styles.submenuTitle}>{`כל ${section.title}`}</Text>
                    </Pressable>
                    {section.children!.map((child) => (
                      <Pressable
                        key={child.id}
                        onPress={() => closeAndNavigate(() => onPressChild(section, child))}
                        style={styles.submenuRow}
                      >
                        <Text style={styles.submenuTitle}>{child.title}</Text>
                      </Pressable>
                    ))}

                    {categoryBrands.length > 0 ? (
                      <View style={styles.brandsBlock}>
                        <Text style={styles.brandsTitle}>מותגים בקטגוריה</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.brandsRow}
                        >
                          {categoryBrands.map((brand) => {
                            const imageUri = normalizeBrandImageUrl(brand.image);
                            return (
                              <Pressable
                                key={brand.handle}
                                onPress={() => handleBrand(brand)}
                                style={styles.brandItem}
                                accessibilityRole="button"
                                accessibilityLabel={brand.label}
                              >
                                <View style={styles.brandRing}>
                                  {imageUri ? (
                                    <Image
                                      source={{ uri: imageUri }}
                                      accessibilityLabel={brand.label}
                                      resizeMode="contain"
                                      style={styles.brandImage}
                                    />
                                  ) : (
                                    <Text style={styles.brandFallback}>{brand.short}</Text>
                                  )}
                                </View>
                                <Text numberOfLines={1} style={styles.brandLabel}>
                                  {brand.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                  </CollapsibleSection>
                ) : null}

                <View style={styles.divider} />
              </View>
            );
          })}
        </SheetScrollView>

        <View style={styles.footer}>
          <Pressable onPress={handlePhone} style={styles.phoneRow} accessibilityRole="button" accessibilityLabel={`לשיחה ישירה, ${STORE_PHONE}`}>
            <View style={styles.phoneEnd}>
              <View style={styles.phoneIcon}>
                <Phone size={14} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Text style={styles.phoneHint}>לשיחה ישירה</Text>
            </View>
            <Text style={styles.phoneNumber}>{STORE_PHONE}</Text>
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: '#F3F2F0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#A1A1AA',
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  menuScrollContent: {
    paddingBottom: 8,
  },
  collapseClip: {
    overflow: 'hidden',
  },
  collapseMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chevronSpacer: {
    width: 18,
  },
  menuRowTitle: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  submenuWrap: {
    backgroundColor: '#F6F4F1',
    paddingTop: 6,
    paddingBottom: 12,
  },
  submenuRow: {
    minHeight: 44,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  submenuTitle: {
    color: '#3F3F46',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  brandsBlock: {
    marginTop: 8,
    paddingTop: 8,
  },
  brandsTitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  brandsRow: {
    flexDirection: 'row-reverse',
    gap: 16,
    paddingHorizontal: 18,
  },
  brandItem: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  brandRing: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandImage: {
    width: 46,
    height: 46,
  },
  brandFallback: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  brandLabel: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECEAE7',
  },
  footer: {
    paddingTop: 12,
  },
  phoneRow: {
    direction: 'ltr',
    marginHorizontal: 16,
    minHeight: 48,
    borderRadius: radii.surface,
    backgroundColor: '#F7F6F4',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneHint: {
    writingDirection: 'rtl',
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  phoneEnd: {
    direction: 'ltr',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  phoneNumber: {
    writingDirection: 'ltr',
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  phoneIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
