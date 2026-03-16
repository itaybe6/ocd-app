import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme/colors';

export function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <View className="rounded-2xl px-6 py-5" style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </View>
  );
}

