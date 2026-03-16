import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../../theme/colors';

type InputProps = TextInputProps & {
  label?: string;
};

export function Input({ label, style, ...rest }: InputProps) {
  return (
    <View style={{ gap: 6 }}>
      {!!label && (
        <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>{label}</Text>
      )}
      <TextInput
        {...rest}
        placeholderTextColor={colors.muted}
        style={[
          {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.text,
            textAlign: 'right',
          },
          style,
        ]}
      />
    </View>
  );
}

