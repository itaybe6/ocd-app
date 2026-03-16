import React from 'react';
import { Platform, StatusBar, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type ScreenProps = ViewProps & {
  padded?: boolean;
};

export function Screen({ padded = true, style, children, ...rest }: ScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {Platform.OS === 'android' ? <StatusBar barStyle="light-content" backgroundColor={colors.bg} /> : <StatusBar barStyle="light-content" />}
      <View
        {...rest}
        className={padded ? 'flex-1 px-4 py-3' : 'flex-1'}
        style={[{ backgroundColor: colors.bg }, style]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

