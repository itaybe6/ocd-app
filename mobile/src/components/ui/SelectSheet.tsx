import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { ModalSheet } from '../ModalSheet';
import { Avatar } from './Avatar';
import { colors } from '../../theme/colors';

export type SelectOption = { value: string; label?: string; avatarUrl?: string | null };

type SelectSheetProps = {
  label?: string;
  value: string | null | undefined;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

export function SelectSheet({ label, value, placeholder = 'בחר…', options, onChange }: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const selectedLabel = useMemo(() => selected?.label ?? selected?.value ?? '', [selected]);
  const selectedAvatarUrl = useMemo(() => (selected?.avatarUrl === undefined ? undefined : selected?.avatarUrl ?? null), [selected]);

  return (
    <View style={{ gap: 6 }}>
      {!!label && (
        <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>{label}</Text>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      >
        <View
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
          <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            {value && selectedAvatarUrl !== undefined ? (
              <Avatar size={24} uri={selectedAvatarUrl} name={selectedLabel} style={{ backgroundColor: '#fff' }} />
            ) : null}
            <Text style={{ color: value ? colors.text : colors.muted, fontWeight: '800', flex: 1, textAlign: 'right' }}>
              {value ? selectedLabel : placeholder}
            </Text>
          </View>
        </View>
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
                style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
              >
                <View
                  style={{
                    backgroundColor: o.value === value ? colors.primary : colors.elevated,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: o.value === value ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                    {o.avatarUrl !== undefined ? (
                      <Avatar
                        size={26}
                        uri={o.avatarUrl ?? null}
                        name={o.label ?? o.value}
                        style={{ backgroundColor: o.value === value ? 'rgba(255,255,255,0.12)' : '#fff', borderColor: 'rgba(0,0,0,0.10)' }}
                      />
                    ) : null}
                    <Text
                      style={{
                        color: o.value === value ? '#fff' : colors.text,
                        fontWeight: '800',
                        textAlign: 'right',
                        flex: 1,
                      }}
                    >
                      {o.label ?? o.value}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </ModalSheet>
    </View>
  );
}

