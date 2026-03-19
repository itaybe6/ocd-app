import React from 'react';
import { Dimensions, StyleSheet, TouchableWithoutFeedback, View, type ViewStyle } from 'react-native';
import { Entypo } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  KeyboardState,
  LinearTransition,
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated';

const AnimatedEntypo = Animated.createAnimatedComponent(Entypo);

const { width } = Dimensions.get('window');
const DEFAULT_DURATION_MS = 500;

export type FabButtonProps = {
  onPress: () => void;
  isOpen: boolean;
  children: React.ReactNode;
  panelStyle?: ViewStyle;
  fabStyle?: ViewStyle;
  duration?: number;
  openedSize?: number;
  closedSize?: number;
  openIconName?: React.ComponentProps<typeof Entypo>['name'];
};

export function FabButton({
  onPress,
  isOpen,
  panelStyle,
  fabStyle,
  children,
  duration = DEFAULT_DURATION_MS,
  openedSize = width * 0.9,
  closedSize = 64,
  openIconName = 'controller-play',
}: FabButtonProps) {
  const spacing = closedSize * 0.2;
  const closeIconSize = closedSize * 0.3;
  const openIconSize = closedSize * 0.45;
  const { height: keyboardHeight, state } = useAnimatedKeyboard();

  const keyboardHeightStyle = useAnimatedStyle(() => {
    return {
      marginBottom: state.value === KeyboardState.OPEN ? keyboardHeight.value - 80 + spacing : 0,
    };
  });

  return (
    <Animated.View
      style={[
        styles.panel,
        panelStyle,
        {
          width: isOpen ? openedSize : closedSize,
          height: isOpen ? 'auto' : closedSize,
          borderRadius: closedSize / 2,
          padding: spacing,
        },
        keyboardHeightStyle,
      ]}
      layout={LinearTransition.duration(duration)}
    >
      <TouchableWithoutFeedback onPress={onPress}>
        <Animated.View
          style={[
            {
              justifyContent: 'center',
              alignItems: 'center',
              position: 'absolute',
              right: 0,
              top: 0,
              width: closedSize,
              height: closedSize,
              zIndex: 2,
            },
            styles.fab,
            fabStyle,
          ]}
          layout={LinearTransition.duration(duration)}
        >
          {isOpen ? (
            <AnimatedEntypo
              key="close"
              name="cross"
              size={closeIconSize}
              color="white"
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          ) : (
            <AnimatedEntypo
              key="open"
              name={openIconName}
              size={openIconSize}
              color="white"
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration)}
            />
          )}
        </Animated.View>
      </TouchableWithoutFeedback>

      {isOpen && (
        <Animated.View
          entering={FadeInDown.duration(duration)}
          exiting={FadeOutDown.duration(duration)}
          style={{ flex: 1, gap: spacing * 2, padding: spacing }}
        >
          <View style={[styles.content, { gap: spacing * 2 }]}>{children}</View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    bottom: 18,
    backgroundColor: '#111',
    zIndex: 9999,
  },
  fab: {
    backgroundColor: '#111',
  },
  content: { flex: 1, paddingTop: 0 },
});

