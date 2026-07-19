import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Toast from '../../components/toast/Toast';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../state/AuthContext';
import type { UserGender } from '../../types/database';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import {
  AuthFooterLink,
  AuthLogo,
  DateOfBirthField,
  Field,
  GenderChips,
  GhostButton,
  MUTED,
  OTP_LENGTH,
  OtpInput,
  PhoneField,
  PrimaryButton,
  ReadOnlyField,
  RESEND_SECONDS,
  StepDots,
  TEXT,
} from './authScreenUi';

type RegisterScreenProps = {
  onGoToLogin: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
};

type Step = 'phone' | 'code' | 'personal' | 'location' | 'contact';

const STEP_ORDER: Step[] = ['phone', 'code', 'personal', 'location', 'contact'];

const STEP_META: Record<Step, { title: string; subtitle: string }> = {
  phone: {
    title: 'יצירת חשבון',
    subtitle: 'הזן מספר טלפון כדי להתחיל בהרשמה',
  },
  code: {
    title: 'קוד אימות',
    subtitle: 'שלחנו קוד בן 6 ספרות למספר',
  },
  personal: {
    title: 'בוא נכיר',
    subtitle: 'ספר לנו קצת עליך',
  },
  location: {
    title: 'איפה אתה?',
    subtitle: 'כדי שנוכל לשרת אותך טוב יותר',
  },
  contact: {
    title: 'איך נשמור על קשר?',
    subtitle: 'הטלפון כבר אומת — נשאר רק אימייל',
  },
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, '');
  if (digits.startsWith('972') && digits.length >= 11) {
    const local = `0${digits.slice(3)}`;
    return local.replace(/(\d{3})(\d+)/, '$1-$2');
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return digits.replace(/(\d{3})(\d+)/, '$1-$2');
  }
  return phone.trim();
}

export function RegisterScreen({ onGoToLogin, onTabPress }: RegisterScreenProps) {
  const { sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<UserGender | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoVerifiedCode = useRef('');

  const inHeader = useSharedValue(0);
  useEffect(() => {
    inHeader.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
  }, [inHeader]);

  useEffect(
    () => () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    },
    []
  );

  const headerStyle = useAnimatedStyle(() => ({
    opacity: inHeader.value,
    transform: [{ translateY: interpolate(inHeader.value, [0, 1], [12, 0]) }],
  }));

  const startResendTimer = useCallback(() => {
    setResendIn(RESEND_SECONDS);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const resetFlow = useCallback(() => {
    setStep('phone');
    setCode('');
    setVerifiedPhone('');
    setResendIn(0);
    lastAutoVerifiedCode.current = '';
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }, []);

  const onSendCode = useCallback(async () => {
    const phoneTrim = phone.trim();
    if (phoneTrim.replace(/\D+/g, '').length < 9) {
      Toast.show({ type: 'error', text1: 'נא להזין מספר טלפון תקין' });
      return;
    }
    try {
      setSubmitting(true);
      const res = await sendRegisterOtp({ phone: phoneTrim });
      setVerifiedPhone(res.phone);
      setCode('');
      lastAutoVerifiedCode.current = '';
      setStep('code');
      startResendTimer();
      Toast.show({ type: 'success', text1: 'נשלח קוד אימות', text2: 'הקוד יגיע ב-SMS תוך מספר שניות' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת הקוד', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [phone, sendRegisterOtp, startResendTimer]);

  const onResendCode = useCallback(async () => {
    if (resendIn > 0 || submitting) return;
    try {
      setSubmitting(true);
      const target = verifiedPhone || phone.trim();
      const res = await sendRegisterOtp({ phone: target });
      setVerifiedPhone(res.phone);
      setCode('');
      lastAutoVerifiedCode.current = '';
      startResendTimer();
      Toast.show({ type: 'success', text1: 'נשלח קוד חדש' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת קוד חדש', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [phone, resendIn, sendRegisterOtp, startResendTimer, submitting, verifiedPhone]);

  const onCompleteSignup = useCallback(async () => {
    const nameTrim = name.trim();
    const cityTrim = city.trim();
    const emailTrim = email.trim();

    if (nameTrim.length < 2) {
      Toast.show({ type: 'error', text1: 'נא להזין שם מלא' });
      return;
    }
    if (cityTrim.length < 2) {
      Toast.show({ type: 'error', text1: 'נא להזין עיר' });
      return;
    }
    if (!isValidEmail(emailTrim)) {
      Toast.show({ type: 'error', text1: 'נא להזין כתובת אימייל תקינה' });
      return;
    }

    try {
      setSubmitting(true);
      await verifyRegisterOtp({
        phone: verifiedPhone || phone.trim(),
        code: code.trim(),
        name: nameTrim,
        address: address.trim() || null,
        gender,
        dateOfBirth,
        city: cityTrim,
        email: emailTrim,
      });
    } catch (e: any) {
      const message: string = e?.message ?? 'Unknown error';
      Toast.show({ type: 'error', text1: 'שגיאה בהרשמה', text2: message });
      if (/code|קוד|otp|expired|invalid/i.test(message)) {
        setCode('');
        lastAutoVerifiedCode.current = '';
        setStep('code');
      }
    } finally {
      setSubmitting(false);
    }
  }, [address, city, code, dateOfBirth, email, gender, name, phone, verifiedPhone, verifyRegisterOtp]);

  useEffect(() => {
    if (step !== 'code' || submitting) return;
    if (code.length !== OTP_LENGTH) return;
    if (lastAutoVerifiedCode.current === code) return;
    lastAutoVerifiedCode.current = code;
    setStep('personal');
  }, [code, step, submitting]);

  const canSendCode = useMemo(
    () => !submitting && phone.trim().replace(/\D+/g, '').length >= 9,
    [phone, submitting]
  );

  const displayPhone = formatDisplayPhone(verifiedPhone ? `0${verifiedPhone.replace(/^972/, '')}` : phone.trim());
  const signupStepIndex = STEP_ORDER.indexOf(step);
  const meta = STEP_META[step];
  const subtitle =
    step === 'code' ? `${meta.subtitle} ${displayPhone}` : meta.subtitle;

  const canAdvancePersonal = !submitting && name.trim().length >= 2;
  const canAdvanceLocation = !submitting && city.trim().length >= 2;
  const canCompleteSignup = !submitting && isValidEmail(email);

  const goBackWithinDetails = useCallback(() => {
    if (step === 'contact') {
      setStep('location');
      return;
    }
    if (step === 'location') {
      setStep('personal');
      return;
    }
    if (step === 'personal') {
      setCode('');
      lastAutoVerifiedCode.current = '';
      setStep('code');
    }
  }, [step]);

  return (
    <Screen padded={false} backgroundColor="#FFFFFF" safeAreaEdges={['top']}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 36,
            paddingBottom: contentPaddingBottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
        >
          <Animated.View style={headerStyle}>
            <AuthLogo />
          </Animated.View>

          <Animated.View key={`title-${step}`} entering={FadeInDown.duration(280)} style={{ marginBottom: 24 }}>
            <Text style={{ color: TEXT, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>{meta.title}</Text>
            <Text
              style={{
                color: MUTED,
                fontSize: 14,
                fontWeight: '600',
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 21,
              }}
            >
              {subtitle}
            </Text>
            <View style={{ marginTop: 16 }}>
              <StepDots total={STEP_ORDER.length} current={signupStepIndex} />
            </View>
          </Animated.View>

          {step === 'phone' && (
            <Animated.View
              key="phone"
              entering={FadeInDown.duration(320).delay(40)}
              exiting={FadeOut.duration(120)}
              style={{ gap: 16 }}
            >
              <PhoneField value={phone} onChange={setPhone} editable={!submitting} onSubmit={onSendCode} />

              <PrimaryButton
                title={submitting ? 'שולח קוד…' : 'שליחת קוד אימות'}
                onPress={onSendCode}
                disabled={!canSendCode}
              />

              <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                לאחר אימות הטלפון נמשיך להשלמת פרטי החשבון
              </Text>

              <AuthFooterLink prefix="כבר יש לך חשבון?" linkText="לחץ כאן להתחברות" onPress={onGoToLogin} />
            </Animated.View>
          )}

          {step === 'code' && (
            <Animated.View
              key="code"
              entering={FadeInDown.duration(320).delay(40)}
              exiting={FadeOut.duration(120)}
              style={{ gap: 20 }}
            >
              <OtpInput value={code} onChange={setCode} disabled={submitting} />

              <View style={{ alignItems: 'center', gap: 14 }}>
                <Pressable disabled={resendIn > 0 || submitting} onPress={onResendCode}>
                  <Text
                    style={{
                      color: resendIn > 0 ? MUTED : TEXT,
                      fontSize: 14,
                      fontWeight: '800',
                      textDecorationLine: resendIn > 0 ? 'none' : 'underline',
                    }}
                  >
                    {resendIn > 0 ? `ניתן לשלוח קוד חדש בעוד ${resendIn} שניות` : 'שליחת קוד מחדש'}
                  </Text>
                </Pressable>

                <Pressable disabled={submitting} onPress={resetFlow}>
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700' }}>שינוי מספר טלפון</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {step === 'personal' && (
            <Animated.View
              key="personal"
              entering={FadeInDown.duration(320).delay(40)}
              exiting={FadeOut.duration(120)}
              style={{ gap: 16 }}
            >
              <Field
                label="שם מלא"
                value={name}
                onChangeText={setName}
                placeholder="ישראל ישראלי"
                textContentType="name"
                autoComplete="name"
                autoFocus
                editable={!submitting}
              />

              <GenderChips value={gender} onChange={setGender} disabled={submitting} />

              <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} disabled={submitting} />

              <PrimaryButton
                title="המשך"
                onPress={() => setStep('location')}
                disabled={!canAdvancePersonal}
              />

              <Pressable disabled={submitting} onPress={goBackWithinDetails} style={{ alignItems: 'center' }}>
                <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700' }}>חזרה לקוד האימות</Text>
              </Pressable>
            </Animated.View>
          )}

          {step === 'location' && (
            <Animated.View
              key="location"
              entering={FadeInDown.duration(320).delay(40)}
              exiting={FadeOut.duration(120)}
              style={{ gap: 16 }}
            >
              <Field
                label="עיר"
                value={city}
                onChangeText={setCity}
                placeholder="תל אביב"
                textContentType="addressCity"
                autoComplete="postal-address-locality"
                autoFocus
                editable={!submitting}
              />

              <Field
                label="כתובת (לא חובה)"
                value={address}
                onChangeText={setAddress}
                placeholder="רחוב ומספר בית"
                textContentType="fullStreetAddress"
                autoComplete="street-address"
                editable={!submitting}
              />

              <PrimaryButton title="המשך" onPress={() => setStep('contact')} disabled={!canAdvanceLocation} />

              <GhostButton title="חזרה" onPress={goBackWithinDetails} disabled={submitting} />
            </Animated.View>
          )}

          {step === 'contact' && (
            <Animated.View
              key="contact"
              entering={FadeInDown.duration(320).delay(40)}
              exiting={FadeOut.duration(120)}
              style={{ gap: 16 }}
            >
              <ReadOnlyField label="מספר טלפון" value={displayPhone} />

              <Field
                label="אימייל"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                autoFocus
                editable={!submitting}
              />

              <PrimaryButton
                title={submitting ? 'יוצר חשבון…' : 'השלמת הרשמה'}
                onPress={onCompleteSignup}
                disabled={!canCompleteSignup}
              />

              <GhostButton title="חזרה" onPress={goBackWithinDetails} disabled={submitting} />
            </Animated.View>
          )}
        </ScrollView>
        <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
      </View>
    </Screen>
  );
}
