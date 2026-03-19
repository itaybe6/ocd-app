import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  durationMs?: number;
};

export function ModalSheet({ visible, onClose, children, containerStyle, durationMs = 260 }: ModalSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMounted(true);
      return;
    }

    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMounted(false), durationMs);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
    };
  }, [durationMs, visible]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn.duration(durationMs)}
          exiting={FadeOut.duration(durationMs)}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        />
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={FadeInUp.duration(durationMs)}
          exiting={FadeOutDown.duration(durationMs)}
          style={[
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 14,
            },
            containerStyle,
          ]}
        >
          <View style={{ alignItems: 'center', paddingBottom: 12 }}>
            <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: colors.border }} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

