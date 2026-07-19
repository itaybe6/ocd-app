import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export const LOGO_IMG = require('../../../assets/logopng/OCDLOGO-04.png');

export const RESEND_SECONDS = 30;
export const OTP_LENGTH = 6;

export const INK = '#0A0A0A';
export const TEXT = '#111111';
export const MUTED = '#8A8F98';
export const BORDER = '#E5E7EB';
export const SURFACE = '#F6F6F7';
export const DISABLED_BG = '#E9EAEC';
export const DISABLED_TEXT = '#A6ABB3';

export function AuthLogo() {
  return (
    <View style={{ alignItems: 'center', marginBottom: 28 }}>
      <Image source={LOGO_IMG} style={{ width: 96, height: 96 }} resizeMode="contain" />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          height: 54,
          borderRadius: 16,
          backgroundColor: disabled ? DISABLED_BG : INK,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: disabled ? DISABLED_TEXT : '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{title}</Text>
      </View>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          height: 54,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: BORDER,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: disabled ? DISABLED_TEXT : TEXT, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      </View>
    </Pressable>
  );
}

function Caret() {
  const blink = useSharedValue(0);
  useEffect(() => {
    blink.value = withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [blink]);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(blink.value, [0, 1], [0.15, 1]) }));
  return <Animated.View style={[{ width: 2, height: 24, borderRadius: 1, backgroundColor: INK }, style]} />;
}

export function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split('');

  return (
    <Pressable onPress={() => inputRef.current?.focus()} disabled={disabled}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          const active = i === digits.length;
          return (
            <View
              key={i}
              style={{
                width: 46,
                height: 58,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: filled || active ? INK : BORDER,
                backgroundColor: filled ? '#FFFFFF' : SURFACE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filled ? (
                <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT, fontVariant: ['tabular-nums'] }}>
                  {digits[i]}
                </Text>
              ) : active && !disabled ? (
                <Caret />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D+/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        editable={!disabled}
        caretHidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  );
}

export function Field({
  label,
  ...inputProps
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: MUTED, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <TextInput
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor="#B9BEC6"
        style={[
          {
            height: 54,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: focused ? INK : BORDER,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            color: TEXT,
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'right',
          },
          inputProps.style,
        ]}
      />
    </View>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: MUTED, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <View
        style={{
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: BORDER,
          backgroundColor: SURFACE,
          paddingHorizontal: 16,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700', textAlign: 'right', letterSpacing: 0.5 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export type GenderOption = 'male' | 'female' | 'prefer_not_to_say';

const GENDER_OPTIONS: { value: GenderOption; label: string }[] = [
  { value: 'male', label: 'זכר' },
  { value: 'female', label: 'נקבה' },
  { value: 'prefer_not_to_say', label: 'מעדיף/ה לא לציין' },
];

export function GenderChips({
  value,
  onChange,
  disabled,
}: {
  value: GenderOption | null;
  onChange: (v: GenderOption | null) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: MUTED, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>מגדר (לא חובה)</Text>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {GENDER_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              onPress={() => onChange(selected ? null : opt.value)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.88 : 1,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: selected ? INK : BORDER,
                backgroundColor: selected ? INK : '#FFFFFF',
              })}
            >
              <Text style={{ color: selected ? '#FFFFFF' : TEXT, fontSize: 14, fontWeight: '700' }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatDobLabel(date: Date | null): string {
  if (!date) return 'בחר תאריך לידה';
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateOfBirthField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(`${value}T12:00:00`) : null;
  const maxDate = new Date();
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !date) return;
    onChange(toYmd(date));
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: MUTED, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>תאריך לידה (לא חובה)</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          height: 54,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: open || selectedDate ? INK : BORDER,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          justifyContent: 'center',
        })}
      >
        <Text
          style={{
            color: selectedDate ? TEXT : '#B9BEC6',
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'right',
          }}
        >
          {formatDobLabel(selectedDate)}
        </Text>
      </Pressable>
      {selectedDate ? (
        <Pressable disabled={disabled} onPress={() => onChange(null)} style={{ alignSelf: 'flex-end' }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700' }}>ניקוי תאריך</Text>
        </Pressable>
      ) : null}
      {open ? (
        <DateTimePicker
          value={selectedDate ?? new Date(1990, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maxDate}
          minimumDate={minDate}
          onChange={onPickerChange}
          locale="he-IL"
        />
      ) : null}
    </View>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 22 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i === current ? INK : i < current ? '#C6C9CE' : BORDER,
          }}
        />
      ))}
    </View>
  );
}

export function PhoneField({
  value,
  onChange,
  editable,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  editable?: boolean;
  onSubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: MUTED, textAlign: 'right', fontSize: 13, fontWeight: '700' }}>מספר טלפון</Text>
      <View
        style={{
          height: 58,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: focused ? INK : BORDER,
          backgroundColor: '#FFFFFF',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^\d+\-\s]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          placeholder="050-0000000"
          placeholderTextColor="#B9BEC6"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={editable}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={{
            flex: 1,
            color: TEXT,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: 1,
            textAlign: 'center',
            height: '100%',
          }}
        />
      </View>
    </View>
  );
}

export function AuthFooterLink({
  prefix,
  linkText,
  onPress,
}: {
  prefix: string;
  linkText: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ color: MUTED, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
        {prefix}{' '}
        <Text style={{ color: TEXT, fontWeight: '800', textDecorationLine: 'underline' }}>{linkText}</Text>
      </Text>
    </Pressable>
  );
}
