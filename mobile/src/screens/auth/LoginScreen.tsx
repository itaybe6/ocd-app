import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';

const LOGO_IMG = require('../../../assets/logopng/OCDLOGO-04.png');

type LoginScreenProps = {
  onBackToStore: () => void;
};

type Mode = 'login' | 'signup';
type Step = 'collect' | 'code';

const RESEND_SECONDS = 30;

function SegmentedToggle({
  mode,
  onChangeMode,
}: {
  mode: Mode;
  onChangeMode: (m: Mode) => void;
}) {
  const [pillWidth, setPillWidth] = useState(0);
  const slide = useSharedValue(mode === 'login' ? 1 : 0);

  useEffect(() => {
    slide.value = withSpring(mode === 'login' ? 1 : 0, {
      damping: 20,
      stiffness: 180,
      mass: 0.7,
    });
  }, [mode]);

  const onLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setPillWidth(w / 2);
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(slide.value, [0, 1], [pillWidth, 0]) }],
  }));

  const loginTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(slide.value, [0, 1], [colors.primary, '#FFFFFF']),
    fontWeight: '800',
    fontSize: 14,
  }));

  const signupTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(slide.value, [0, 1], ['#FFFFFF', colors.primary]),
    fontWeight: '800',
    fontSize: 14,
  }));

  return (
    <View
      onLayout={onLayout}
      style={{
        height: 52,
        borderRadius: 16,
        backgroundColor: '#E8EEFF',
        borderWidth: 1.5,
        borderColor: 'rgba(37,99,235,0.15)',
        flexDirection: 'row-reverse',
        padding: 4,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: pillWidth - 4,
            borderRadius: 12,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          },
          indicatorStyle,
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'signup' }}
        onPress={() => onChangeMode('signup')}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
      >
        <Animated.Text numberOfLines={1} style={signupTextStyle}>
          הרשמה ללקוח
        </Animated.Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'login' }}
        onPress={() => onChangeMode('login')}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
      >
        <Animated.Text numberOfLines={1} style={loginTextStyle}>
          התחברות
        </Animated.Text>
      </Pressable>
    </View>
  );
}

export function LoginScreen({ onBackToStore }: LoginScreenProps) {
  const { sendLoginOtp, verifyLoginOtp, sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('collect');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');

  /** Phone normalized + confirmed by the function (used when verifying / resending). */
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inLogo = useSharedValue(0);
  const inCard = useSharedValue(0);
  const floatA = useSharedValue(0);
  const floatB = useSharedValue(0);
  const floatC = useSharedValue(0);

  useEffect(() => {
    inLogo.value = withSpring(1, { damping: 12, stiffness: 140, mass: 0.9 });
    inCard.value = withDelay(120, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));

    floatA.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }), -1, true);
    floatB.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, true);
    floatC.value = withRepeat(withTiming(1, { duration: 6400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [inCard, inLogo, floatA, floatB, floatC]);

  useEffect(
    () => () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    },
    []
  );

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

  const logoStyle = useAnimatedStyle(() => {
    const s = interpolate(inLogo.value, [0, 1], [0.92, 1]);
    const y = interpolate(inLogo.value, [0, 1], [8, 0]);
    return {
      opacity: inLogo.value,
      transform: [{ translateY: y }, { scale: s }],
    };
  });

  const cardStyle = useAnimatedStyle(() => {
    const y = interpolate(inCard.value, [0, 1], [18, 0]);
    return { opacity: inCard.value, transform: [{ translateY: y }] };
  });

  const blobA = useAnimatedStyle(() => {
    const t = floatA.value;
    return {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      left: -120,
      top: -70,
      opacity: 0.35,
      transform: [
        { translateX: interpolate(t, [0, 1], [-10, 10]) },
        { translateY: interpolate(t, [0, 1], [10, -10]) },
        { scale: interpolate(t, [0, 1], [1, 1.06]) },
      ],
    };
  });

  const blobB = useAnimatedStyle(() => {
    const t = floatB.value;
    return {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      left: 220,
      top: -110,
      opacity: 0.28,
      transform: [
        { translateX: interpolate(t, [0, 1], [-12, 12]) },
        { translateY: interpolate(t, [0, 1], [12, -12]) },
        { scale: interpolate(t, [0, 1], [1, 1.05]) },
      ],
    };
  });

  const blobC = useAnimatedStyle(() => {
    const t = floatC.value;
    return {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      left: 120,
      top: 420,
      opacity: 0.22,
      transform: [
        { translateX: interpolate(t, [0, 1], [-10, 10]) },
        { translateY: interpolate(t, [0, 1], [10, -10]) },
        { scale: interpolate(t, [0, 1], [1, 1.04]) },
      ],
    };
  });

  const resetToCollect = useCallback(() => {
    setStep('collect');
    setCode('');
    setVerifiedPhone('');
    setResendIn(0);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }, []);

  const handleChangeMode = useCallback(
    (m: Mode) => {
      if (m === mode) return;
      setMode(m);
      resetToCollect();
    },
    [mode, resetToCollect]
  );

  const onSendCode = useCallback(async () => {
    try {
      setSubmitting(true);
      const phoneTrim = phone.trim();
      if (phoneTrim.length < 9) {
        Toast.show({ type: 'error', text1: 'נא להזין מספר טלפון תקין' });
        return;
      }

      if (mode === 'signup' && !name.trim()) {
        Toast.show({ type: 'error', text1: 'נא להזין שם מלא' });
        return;
      }

      const res = mode === 'login' ? await sendLoginOtp({ phone: phoneTrim }) : await sendRegisterOtp({ phone: phoneTrim });
      setVerifiedPhone(res.phone);
      setStep('code');
      startResendTimer();
      Toast.show({ type: 'success', text1: 'נשלח קוד אימות', text2: 'הקוד יגיע ב-SMS תוך מספר שניות' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת הקוד', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [mode, name, phone, sendLoginOtp, sendRegisterOtp, startResendTimer]);

  const onResendCode = useCallback(async () => {
    if (resendIn > 0) return;
    try {
      setSubmitting(true);
      const res =
        mode === 'login'
          ? await sendLoginOtp({ phone: verifiedPhone || phone.trim() })
          : await sendRegisterOtp({ phone: verifiedPhone || phone.trim() });
      setVerifiedPhone(res.phone);
      setCode('');
      startResendTimer();
      Toast.show({ type: 'success', text1: 'נשלח קוד חדש' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בשליחת קוד חדש', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  }, [mode, phone, resendIn, sendLoginOtp, sendRegisterOtp, startResendTimer, verifiedPhone]);

  const onVerifyCode = useCallback(async () => {
    try {
      setSubmitting(true);
      const codeTrim = code.trim();
      if (codeTrim.length < 4) {
        Toast.show({ type: 'error', text1: 'נא להזין קוד אימות תקין' });
        return;
      }
      if (mode === 'login') {
        await verifyLoginOtp({ phone: verifiedPhone || phone.trim(), code: codeTrim });
      } else {
        await verifyRegisterOtp({
          phone: verifiedPhone || phone.trim(),
          code: codeTrim,
          name: name.trim(),
          address: address.trim() || null,
        });
      }
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: mode === 'login' ? 'שגיאה בהתחברות' : 'שגיאה בהרשמה',
        text2: e?.message ?? 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [address, code, mode, name, phone, verifiedPhone, verifyLoginOtp, verifyRegisterOtp]);

  const canSendCode = useMemo(() => {
    if (submitting) return false;
    if (phone.trim().length < 9) return false;
    if (mode === 'signup' && name.trim().length < 2) return false;
    return true;
  }, [mode, name, phone, submitting]);

  const canVerify = useMemo(() => {
    if (submitting) return false;
    return code.trim().length >= 4;
  }, [code, submitting]);

  const sendCodeLabel =
    mode === 'login' ? (submitting ? 'שולח קוד…' : 'שלח קוד אימות') : submitting ? 'שולח קוד…' : 'שלח קוד והמשך להרשמה';

  const verifyLabel = submitting ? 'מאמת…' : mode === 'login' ? 'אמת והתחבר' : 'אמת והרשם';

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Animated.View pointerEvents="none" style={[blobA, { backgroundColor: '#DBEAFE' }]} />
          <Animated.View pointerEvents="none" style={[blobB, { backgroundColor: '#E0E7FF' }]} />
          <Animated.View pointerEvents="none" style={[blobC, { backgroundColor: '#DCFCE7' }]} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 24, paddingBottom: 96 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <Animated.View style={[{ alignItems: 'center', marginBottom: 16 }, logoStyle]}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 28,
                  backgroundColor: colors.primary,
                  borderWidth: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 4,
                }}
              >
                <Image source={LOGO_IMG} style={{ width: 86, height: 86 }} resizeMode="contain" />
              </View>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' }}>
                מערכת ניהול משימות
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6, fontWeight: '700', textAlign: 'center' }}>
                התחברות מהירה ובטוחה ב-SMS
              </Text>
            </Animated.View>

            <Animated.View style={[cardStyle]}>
              <Card
                style={{
                  padding: 16,
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 3,
                }}
              >
                <View style={{ gap: 12 }}>
                  <SegmentedToggle mode={mode} onChangeMode={handleChangeMode} />

                  {step === 'collect' && (
                    <>
                      {mode === 'signup' && (
                        <Input
                          label="שם מלא"
                          value={name}
                          onChangeText={setName}
                          placeholder="ישראל ישראלי"
                          textContentType="name"
                          autoComplete="name"
                        />
                      )}

                      <Input
                        label="טלפון"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="050..."
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                      />

                      {mode === 'signup' && (
                        <Input
                          label="כתובת"
                          value={address}
                          onChangeText={setAddress}
                          placeholder="רחוב, עיר"
                          textContentType="fullStreetAddress"
                          autoComplete="street-address"
                        />
                      )}

                      <Button
                        title={sendCodeLabel}
                        onPress={onSendCode}
                        disabled={!canSendCode}
                        style={{
                          shadowColor: colors.primary,
                          shadowOpacity: 0.18,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 2,
                        }}
                      />

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Button title="חזרה לחנות" variant="secondary" onPress={onBackToStore} />
                        </View>
                        {mode === 'signup' && (
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                borderRadius: 18,
                                paddingVertical: 14,
                                paddingHorizontal: 12,
                                alignItems: 'center',
                                backgroundColor: 'rgba(37,99,235,0.06)',
                                borderWidth: 1,
                                borderColor: 'rgba(37,99,235,0.14)',
                              }}
                            >
                              <Text
                                style={{ color: colors.primary, fontWeight: '800', textAlign: 'center', fontSize: 12 }}
                              >
                                ההרשמה יוצרת חשבון לקוח בלבד
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </>
                  )}

                  {step === 'code' && (
                    <>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'right',
                          lineHeight: 20,
                        }}
                      >
                        שלחנו קוד אימות בן 6 ספרות למספר{' '}
                        <Text style={{ color: colors.primary }}>
                          {verifiedPhone || phone}
                        </Text>
                      </Text>

                      <Input
                        label="קוד אימות"
                        value={code}
                        onChangeText={(v) => setCode(v.replace(/\D+/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        placeholder="------"
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        maxLength={6}
                        style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: '800' }}
                      />

                      <Button
                        title={verifyLabel}
                        onPress={onVerifyCode}
                        disabled={!canVerify}
                        style={{
                          shadowColor: colors.primary,
                          shadowOpacity: 0.18,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 2,
                        }}
                      />

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Button title="שינוי טלפון" variant="secondary" onPress={resetToCollect} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Pressable
                            disabled={resendIn > 0 || submitting}
                            onPress={onResendCode}
                            style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
                          >
                            <View
                              style={{
                                borderRadius: 18,
                                paddingVertical: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: resendIn > 0 ? '#F1F5F9' : '#EEF4FF',
                                borderWidth: 1,
                                borderColor: resendIn > 0 ? '#E2E8F0' : '#C7D8FF',
                              }}
                            >
                              <Text
                                style={{
                                  color: resendIn > 0 ? colors.muted : colors.primary,
                                  fontWeight: '900',
                                }}
                              >
                                {resendIn > 0 ? `שליחה מחדש בעוד ${resendIn}s` : 'שלח קוד מחדש'}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </Card>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
