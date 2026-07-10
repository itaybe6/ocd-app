import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import {
  AuthFooterLink,
  AuthLogo,
  MUTED,
  OTP_LENGTH,
  OtpInput,
  PhoneField,
  PrimaryButton,
  RESEND_SECONDS,
  TEXT,
} from './authScreenUi';

type LoginScreenProps = {
  onGoToRegister: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
};

type Step = 'phone' | 'code';

export function LoginScreen({ onGoToRegister, onTabPress }: LoginScreenProps) {
  const { sendLoginOtp, verifyLoginOtp } = useAuth();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpNoticeVisible, setOtpNoticeVisible] = useState(false);
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
      const res = await sendLoginOtp({ phone: phoneTrim });
      setVerifiedPhone(res.phone);
      setCode('');
      lastAutoVerifiedCode.current = '';
      setStep('code');
      startResendTimer();
      Keyboard.dismiss();
      setOtpNoticeVisible(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת הקוד', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [phone, sendLoginOtp, startResendTimer]);

  const onResendCode = useCallback(async () => {
    if (resendIn > 0 || submitting) return;
    try {
      setSubmitting(true);
      const target = verifiedPhone || phone.trim();
      const res = await sendLoginOtp({ phone: target });
      setVerifiedPhone(res.phone);
      setCode('');
      lastAutoVerifiedCode.current = '';
      startResendTimer();
      Keyboard.dismiss();
      setOtpNoticeVisible(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת קוד חדש', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [phone, resendIn, sendLoginOtp, startResendTimer, submitting, verifiedPhone]);

  const doVerifyLogin = useCallback(
    async (codeToVerify: string) => {
      try {
        setSubmitting(true);
        await verifyLoginOtp({ phone: verifiedPhone || phone.trim(), code: codeToVerify });
      } catch (e: any) {
        setCode('');
        lastAutoVerifiedCode.current = '';
        Toast.show({ type: 'error', text1: 'שגיאה בהתחברות', text2: e?.message ?? 'Unknown error' });
      } finally {
        setSubmitting(false);
      }
    },
    [phone, verifiedPhone, verifyLoginOtp]
  );

  useEffect(() => {
    if (step !== 'code' || submitting) return;
    if (code.length !== OTP_LENGTH) return;
    if (lastAutoVerifiedCode.current === code) return;
    lastAutoVerifiedCode.current = code;
    void doVerifyLogin(code);
  }, [code, doVerifyLogin, step, submitting]);

  const canSendCode = useMemo(
    () => !submitting && phone.trim().replace(/\D+/g, '').length >= 9,
    [phone, submitting]
  );

  const displayPhone = verifiedPhone ? `0${verifiedPhone.replace(/^972/, '')}` : phone.trim();

  const title = step === 'phone' ? 'ברוך שובך' : 'קוד אימות';
  const subtitle =
    step === 'phone'
      ? 'הזן מספר טלפון ונשלח לך קוד אימות ב-SMS'
      : `שלחנו קוד בן 6 ספרות למספר ${displayPhone}`;

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
            <Text style={{ color: TEXT, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
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

              <AuthFooterLink prefix="עדיין לא רשום?" linkText="לחץ כאן להרשמה" onPress={onGoToRegister} />
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

              <PrimaryButton
                title={submitting ? 'מאמת…' : 'התחברות'}
                onPress={() => doVerifyLogin(code)}
                disabled={submitting || code.length < OTP_LENGTH}
              />

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
          </ScrollView>
        <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
      </View>
    </Screen>
  );
}
