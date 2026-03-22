import React from 'react';
import { Pressable, Text, View, type PressableProps, type ViewStyle } from 'react-native';
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
  const textColor = variant === 'secondary' ? colors.text : '#fff';
  const disabledBackground = variant === 'secondary' ? colors.elevated : '#94A3B8';
  const disabledBorder = variant === 'secondary' ? colors.border : 'transparent';
  const disabledText = variant === 'secondary' ? colors.muted : '#fff';

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => ({
        width: fullWidth ? '100%' : undefined,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={[
          {
            backgroundColor: disabled ? disabledBackground : backgroundColor,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: disabled ? disabledBorder : variant === 'secondary' ? colors.border : undefined,
          },
          style,
        ]}
      >
        <Text style={{ color: disabled ? disabledText : textColor, fontWeight: '900' }}>{title}</Text>
      </View>
    </Pressable>
  );
}

