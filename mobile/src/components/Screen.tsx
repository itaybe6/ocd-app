import React from 'react';
import { Platform, StatusBar, View, type StatusBarStyle, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type ScreenProps = ViewProps & {
  padded?: boolean;
  backgroundColor?: string;
  statusBarStyle?: StatusBarStyle;
};

export function Screen({
  padded = true,
  style,
  children,
  backgroundColor = colors.bg,
  statusBarStyle = 'light-content',
  ...rest
}: ScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      {Platform.OS === 'android' ? (
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      ) : (
        <StatusBar barStyle={statusBarStyle} />
      )}
      <View
        {...rest}
        className={padded ? 'flex-1 px-4 py-3' : 'flex-1'}
        style={[{ backgroundColor }, style]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

