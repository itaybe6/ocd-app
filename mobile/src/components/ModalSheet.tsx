import React from 'react';
import { Modal, Pressable, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
};

export function ModalSheet({ visible, onClose, children, containerStyle }: ModalSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable className="flex-1" onPress={onClose} />
        <View
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
          <View className="items-center pb-3">
            <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: colors.border }} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

