import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FavoriteToggleButtonProps = {
  active: boolean;
  loading?: boolean;
  onPress: (event?: GestureResponderEvent) => void;
  size?: number;
};

export function FavoriteToggleButton({
  active,
  loading = false,
  onPress,
  size = 40,
}: FavoriteToggleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        borderRadius: size / 2,
        alignSelf: 'flex-start',
        flexShrink: 0,
        overflow: 'hidden',
        opacity: pressed || loading ? 0.82 : 1,
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? '#FEE2E2' : '#FFFFFF',
          borderWidth: 1,
          borderColor: active ? '#FCA5A5' : '#E2E8F0',
          alignSelf: 'flex-start',
          flexShrink: 0,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <Ionicons
            name={active ? 'heart' : 'heart-outline'}
            size={Math.max(18, size * 0.48)}
            color={active ? '#DC2626' : '#0F172A'}
          />
        )}
      </View>
    </Pressable>
  );
}
