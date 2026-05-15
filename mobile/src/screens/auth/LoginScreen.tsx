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

<<<<<<< HEAD
=======
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

>>>>>>> 5276284aa7e8759d5d11c1b86dd7c1ca76cd326e
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

<<<<<<< HEAD
  const onSubmit = async () => {
=======
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
>>>>>>> 5276284aa7e8759d5d11c1b86dd7c1ca76cd326e
    try {
      setSubmitting(true);
      const phoneTrim = phone.trim();
      if (phoneTrim.length < 9) {
        Toast.show({ type: 'error', text1: 'נא להזין מספר טלפון תקין' });
        return;
      }
<<<<<<< HEAD
      if (!name.trim()) { Toast.show({ type: 'error', text1: 'נא להזין שם מלא' }); return; }
      if (password.length < 4) { Toast.show({ type: 'error', text1: 'הסיסמה חייבת להכיל לפחות 4 תווים' }); return; }
      if (password !== confirmPassword) { Toast.show({ type: 'error', text1: 'אימות הסיסמה אינו תואם' }); return; }
      await signUpCustomer({ name, phone, address, password });
=======

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
>>>>>>> 5276284aa7e8759d5d11c1b86dd7c1ca76cd326e
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 5276284aa7e8759d5d11c1b86dd7c1ca76cd326e
      </KeyboardAvoidingView>
    </Screen>
  );
}
