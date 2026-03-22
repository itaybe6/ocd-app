import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { ModalDialog } from './ModalDialog';
import { colors } from '../theme/colors';
import { Input } from './ui/Input';

export type PickerOption = { value: string; label: string };

type PickerDialogProps = {
  visible: boolean;
  title: string;
  value?: string | null;
  placeholder?: string;
  options: PickerOption[];
  onClose: () => void;
  onSelect: (value: string) => void;
  onClear?: () => void;
};

export function PickerDialog({
  visible,
  title,
  value,
  placeholder = 'חפש…',
  options,
  onClose,
  onSelect,
  onClear,
}: PickerDialogProps) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [options, q]);

  const renderPickerSurface = ({
    title,
    selected = false,
  }: {
    title: string;
    selected?: boolean;
  }) => (
    <View
      style={{
        backgroundColor: selected ? '#EAF2FF' : colors.elevated,
        borderColor: selected ? '#93C5FD' : colors.border,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{title}</Text>
    </View>
  );

  return (
    <ModalDialog
      visible={visible}
      onClose={() => {
        setQ('');
        onClose();
      }}
      containerStyle={{ height: '78%' }}
    >
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{title}</Text>
        <Pressable onPress={onClose} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: '900' }}>סגור</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 10, gap: 10 }}>
        <Input value={q} onChangeText={setQ} placeholder={placeholder} />
        {!!onClear && (
          <Pressable
            onPress={() => {
              onClear();
              onClose();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
          >
            {renderPickerSurface({ title: 'נקה בחירה' })}
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: 12, flex: 1 }}>
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.value}
          contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
          renderItem={({ item }) => {
            const selected = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
              >
                {renderPickerSurface({ title: item.label, selected })}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right' }}>אין תוצאות.</Text>}
        />
      </View>
    </ModalDialog>
  );
}

