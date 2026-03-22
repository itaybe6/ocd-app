import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Menu } from 'lucide-react-native';

const LOGO = require('../../assets/logopng/OCDLOGO-04.png');

interface AdminHeaderProps {
  onMenuPress: () => void;
  onBackPress?: () => void;
}

export function AdminHeader({ onMenuPress, onBackPress }: AdminHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.slot}>
          {onBackPress ? (
            <Pressable
              onPress={onBackPress}
              accessibilityRole="button"
              accessibilityLabel="חזור"
              hitSlop={10}
              style={({ pressed }) => [
                styles.btn,
                pressed && styles.backBtnPressed,
              ]}
            >
              <ChevronLeft size={24} color="#334155" strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>

        <View pointerEvents="none" style={styles.logoWrap}>
          <Image source={LOGO} resizeMode="contain" style={styles.logo} />
        </View>

        <View style={styles.slot}>
          <Pressable
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="פתח תפריט"
            hitSlop={10}
            style={({ pressed }) => [
              styles.btn,
              styles.menuBtn,
              pressed && styles.menuBtnPressed,
            ]}
          >
            <Menu size={20} color="#1E40AF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 10,
  },
  bar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  slot: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 164,
    height: 38,
  },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: '#F1F5F9',
  },
  menuBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE80',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuBtnPressed: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
});
