import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';

type ModalDialogProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  durationMs?: number;
};

export function ModalDialog({ visible, onClose, children, containerStyle, durationMs = 220 }: ModalDialogProps) {
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
      <View style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(durationMs)}
          exiting={FadeOut.duration(durationMs)}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,23,42,0.35)' }]}
        />

        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(durationMs)}
          exiting={FadeOutDown.duration(durationMs)}
          style={[styles.card, containerStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    maxHeight: '92%',
    width: '100%',
  },
});

