import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Heart, Phone, Search, User, X } from 'lucide-react-native';

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
};

const SLIDE_MS = 360;
const PANEL_WIDTH_RATIO = 0.88;
const PANEL_MAX_WIDTH = 380;
const STORE_PHONE = '08-6422822';
const STORE_PHONE_TEL = 'tel:086422822';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const STORE_LOGO = require('../../assets/logopng/OCDLOGO-04.png');

export function StoreSideMenu({
  visible,
  onClose,
  sections,
  expandedSections,
  onToggleSection,
  onPressSection,
  onPressChild,
  onSearchPress,
  onProfilePress,
  onFavoritesPress,
}: StoreSideMenuProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = Math.min(screenWidth * PANEL_WIDTH_RATIO, PANEL_MAX_WIDTH);
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (!mounted) return;

    progress.value = withTiming(
      0,
      {
        duration: SLIDE_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.22,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidth }],
  }));

  const handleSearch = () => {
    onClose();
    requestAnimationFrame(() => onSearchPress());
  };

  const handleProfile = () => {
    onClose();
    requestAnimationFrame(() => onProfilePress());
  };

  const handleFavorites = () => {
    onClose();
    requestAnimationFrame(() => onFavoritesPress?.());
  };

  const handlePhone = () => {
    void Linking.openURL(STORE_PHONE_TEL);
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="סגירת תפריט" />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 16),
            },
            panelStyle,
          ]}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="סגירת תפריט"
            >
              <X size={22} color="#111827" strokeWidth={1.8} />
            </Pressable>
            <Image source={STORE_LOGO} style={styles.logo} resizeMode="contain" />
          </View>

          <Pressable
            onPress={handleSearch}
            style={styles.searchBar}
            accessibilityRole="button"
            accessibilityLabel="חיפוש מוצרים"
          >
            <Text style={styles.searchPlaceholder}>חיפוש מוצרים</Text>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
          </Pressable>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section) => {
              const hasChildren = !!section.children?.length;
              const isExpanded = !!expandedSections[section.id];

              return (
                <View key={section.id}>
                  <Pressable
                    onPress={() => {
                      if (hasChildren) {
                        onToggleSection(section.id);
                        return;
                      }
                      onPressSection(section);
                    }}
                    style={styles.menuRow}
                  >
                    <Text style={styles.menuRowTitle}>{section.title}</Text>
                    {hasChildren ? (
                      <ChevronDown
                        size={18}
                        color="#6B7280"
                        strokeWidth={2}
                        style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                      />
                    ) : null}
                  </Pressable>

                  {hasChildren && isExpanded ? (
                    <View style={styles.submenuWrap}>
                      {section.children!.map((child) => (
                        <Pressable
                          key={child.id}
                          onPress={() => onPressChild(section, child)}
                          style={styles.submenuRow}
                        >
                          <Text style={styles.submenuTitle}>{child.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.divider} />
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleProfile} style={styles.footerRow}>
              <View style={styles.footerRowInner}>
                <Text style={styles.footerText}>החשבון שלי</Text>
                <User size={18} color="#111827" strokeWidth={1.8} />
              </View>
            </Pressable>
            <View style={styles.divider} />

            {onFavoritesPress ? (
              <>
                <Pressable onPress={handleFavorites} style={styles.footerRow}>
                  <View style={styles.footerRowInner}>
                    <Text style={styles.footerText}>רשימת משאלות</Text>
                    <Heart size={18} color="#111827" strokeWidth={1.8} />
                  </View>
                </Pressable>
                <View style={styles.divider} />
              </>
            ) : null}

            <Pressable onPress={handlePhone} style={styles.footerRow}>
              <View style={styles.footerRowInner}>
                <Text style={styles.footerText}>{STORE_PHONE}</Text>
                <Phone size={18} color="#111827" strokeWidth={1.8} />
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#111827',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'ltr',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 118,
    height: 40,
  },
  searchBar: {
    marginHorizontal: 18,
    marginBottom: 8,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'right',
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingBottom: 8,
  },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuRowTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
  },
  submenuWrap: {
    paddingBottom: 4,
  },
  submenuRow: {
    minHeight: 44,
    paddingHorizontal: 22,
    paddingRight: 34,
    justifyContent: 'center',
  },
  submenuTitle: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 18,
  },
  footer: {
    paddingTop: 4,
  },
  footerRow: {
    minHeight: 52,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    direction: 'ltr',
  },
  footerText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
});
