import React from 'react';
import { View, type ViewProps } from 'react-native';
import { colors } from '../../theme/colors';

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 14,
        },
        style,
      ]}
    />
  );
}

