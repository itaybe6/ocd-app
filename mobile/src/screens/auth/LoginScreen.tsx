import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../state/AuthContext';

const LOGO_IMG = require('../../../assets/logopng/OCDLOGO-04.png');

const ui = {
  pageBg: '#FFFFFF',
  text: '#111111',
  muted: '#BBBBBB',
  mutedStrong: '#888888',
  line: '#E8E8E8',
  black: '#000000',
} as const;

/** Open underline-only input — no background, no box. */
const underlineInput = {
  borderWidth: 0,
  borderBottomWidth: 1.5,
  borderBottomColor: ui.line,
  borderRadius: 0,
  backgroundColor: 'transparent',
  paddingHorizontal: 2,
  paddingVertical: 14,
  color: ui.text,
  textAlign: 'right' as const,
  fontSize: 16,
  minHeight: 52,
};

type LoginScreenProps = {
  onBackToStore: () => void;
};

export function LoginScreen({ onBackToStore }: LoginScreenProps) {
  const { signInWithPassword, signUpCustomer } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      if (mode === 'login') {
        await signInWithPassword({ phone, password });
        return;
      }
      if (!name.trim()) { Toast.show({ type: 'error', text1: 'נא להזין שם מלא' }); return; }
      if (password.length < 4) { Toast.show({ type: 'error', text1: 'הסיסמה חייבת להכיל לפחות 4 תווים' }); return; }
      if (password !== confirmPassword) { Toast.show({ type: 'error', text1: 'אימות הסיסמה אינו תואם' }); return; }
      await signUpCustomer({ name, phone, address, password });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: mode === 'login' ? 'שגיאה בהתחברות' : 'שגיאה בהרשמה',
        text2: e?.message ?? 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (mode === 'login') return phone.trim().length >= 3 && password.length >= 1;
    return name.trim().length >= 2 && phone.trim().length >= 3 && password.length >= 4 && confirmPassword.length >= 4;
  }, [confirmPassword, mode, name, password, phone, submitting]);

  const primaryLabel = submitting
    ? (mode === 'login' ? 'מתחבר…' : 'נרשם…')
    : mode === 'login' ? 'כניסה' : 'צור חשבון לקוח';

  return (
    <Screen backgroundColor={ui.pageBg} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {/* Logo + headline */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image
              source={LOGO_IMG}
              style={{ width: 140, height: 52 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="לוגו"
            />
            <Text style={{ color: ui.text, fontSize: 27, fontWeight: '800', marginTop: 24, textAlign: 'center' }}>
              {mode === 'login' ? 'רגע לפני שנכנסים' : 'יצירת חשבון'}
            </Text>
            <Text style={{ color: ui.mutedStrong, marginTop: 8, fontSize: 15, fontWeight: '400', textAlign: 'center' }}>
              {mode === 'login' ? 'צריך טלפון וסיסמה' : 'הרשם כדי להמשיך'}
            </Text>
          </View>

          {/* Fields */}
          <View style={{ gap: 4 }}>
            {mode === 'signup' && (
              <Input
                label=""
                value={name}
                onChangeText={setName}
                placeholder="שם מלא"
                textContentType="name"
                autoComplete="name"
                style={underlineInput}
                placeholderTextColor={ui.muted}
              />
            )}

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="טלפון"
              placeholderTextColor={ui.muted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={underlineInput}
            />

            {mode === 'signup' && (
              <Input
                label=""
                value={address}
                onChangeText={setAddress}
                placeholder="כתובת"
                textContentType="fullStreetAddress"
                autoComplete="street-address"
                style={underlineInput}
                placeholderTextColor={ui.muted}
              />
            )}

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="סיסמה"
              placeholderTextColor={ui.muted}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              style={underlineInput}
            />

            {mode === 'signup' && (
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="אימות סיסמה"
                placeholderTextColor={ui.muted}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                style={underlineInput}
              />
            )}
          </View>

          {/* Forgot password */}
          {mode === 'login' && (
            <Pressable
              onPress={() =>
                Toast.show({ type: 'info', text1: 'טיפ', text2: 'אם שכחת סיסמה — פנה למנהל מערכת לאיפוס.' })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start', marginTop: 14, paddingVertical: 4 })}
              accessibilityRole="button"
            >
              <Text style={{ color: ui.mutedStrong, fontSize: 14 }}>שכחתי סיסמה</Text>
            </Pressable>
          )}

          {/* Submit */}
          <View style={{ marginTop: 36 }}>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => ({ opacity: pressed && canSubmit ? 0.88 : 1 })}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <View
              style={{
                backgroundColor: !canSubmit ? '#D1D5DB' : ui.black,
                borderRadius: 18,
                paddingVertical: 17,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 56,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{primaryLabel}</Text>
            </View>
          </Pressable>
          </View>

          {/* Switch mode */}
          <View style={{ alignItems: 'center', marginTop: 28, gap: 14 }}>
            {mode === 'login' ? (
              <Pressable
                onPress={() => setMode('signup')}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 15, textAlign: 'center', color: ui.mutedStrong }}>
                  אין לך חשבון עדיין?{'  '}
                  <Text style={{ fontWeight: '800', color: ui.text }}>הירשם כאן</Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setMode('login')}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 15, textAlign: 'center', color: ui.mutedStrong }}>
                  כבר יש לך חשבון?{'  '}
                  <Text style={{ fontWeight: '800', color: ui.text }}>התחבר כאן</Text>
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={onBackToStore}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              accessibilityRole="button"
            >
              <Text style={{ color: ui.muted, fontSize: 14 }}>חזרה לחנות</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
