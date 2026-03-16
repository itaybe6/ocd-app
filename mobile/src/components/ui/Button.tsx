import React from 'react';
import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

type Variant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({ title, variant = 'primary', fullWidth = true, disabled, style, ...rest }: ButtonProps) {
  const backgroundColor =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.elevated;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={[
        {
          backgroundColor: disabled ? '#1F3A5F' : backgroundColor,
          borderRadius: 18,
          paddingVertical: 14,
          alignItems: 'center',
          width: fullWidth ? '100%' : undefined,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: variant === 'secondary' ? colors.border : undefined,
        },
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontWeight: '900' }}>{title}</Text>
    </Pressable>
  );
}

