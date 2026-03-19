import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { ModalSheet } from '../ModalSheet';
import { colors } from '../../theme/colors';

export type SelectOption = { value: string; label?: string };

type SelectSheetProps = {
  label?: string;
  value: string | null | undefined;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

export function SelectSheet({ label, value, placeholder = 'בחר…', options, onChange }: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? found?.value ?? '';
  }, [options, value]);

  return (
    <View style={{ gap: 6 }}>
      {!!label && (
        <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>{label}</Text>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.elevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <ChevronDown size={18} color={colors.muted} />
        <Text style={{ color: value ? colors.text : colors.muted, fontWeight: '800', flex: 1, textAlign: 'right' }}>
          {value ? selectedLabel : placeholder}
        </Text>
      </Pressable>

      <ModalSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>
          {label ?? 'בחר'}
        </Text>
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: 8 }}>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
                style={{
                  backgroundColor: o.value === value ? colors.primary : colors.elevated,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: o.value === value ? '#fff' : colors.text,
                    fontWeight: '800',
                    textAlign: 'right',
                  }}
                >
                  {o.label ?? o.value}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </ModalSheet>
    </View>
  );
}

