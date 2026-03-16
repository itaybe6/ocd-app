import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function Badge({ count }: { count: number }) {
  if (!count) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View
      style={{
        minWidth: 24,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 999,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

