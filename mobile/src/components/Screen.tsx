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
  statusBarStyle = 'dark-content',
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
        style={[
          {
            flex: 1,
            backgroundColor,
            paddingHorizontal: padded ? 16 : 0,
            paddingVertical: padded ? 12 : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

