import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';

const LOGO_IMG = require('../../../assets/logo-vertical.png');

type LoginScreenProps = {
  onBackToStore: () => void;
};

function AuthModeButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.94 : 1 })}>
      <View
        style={{
          borderRadius: 14,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.primary : '#FFFFFF',
          borderWidth: active ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: '900' }}>{title}</Text>
      </View>
    </Pressable>
  );
}

export function LoginScreen({ onBackToStore }: LoginScreenProps) {
  const { signInWithPassword, signUpCustomer } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      if (mode === 'login') {
        await signInWithPassword({ phone, password });
        return;
      }

      if (!name.trim()) {
        Toast.show({ type: 'error', text1: 'נא להזין שם מלא' });
        return;
      }

      if (password.length < 4) {
        Toast.show({ type: 'error', text1: 'הסיסמה חייבת להכיל לפחות 4 תווים' });
        return;
      }

      if (password !== confirmPassword) {
        Toast.show({ type: 'error', text1: 'אימות הסיסמה אינו תואם' });
        return;
      }

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

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Animated.View pointerEvents="none" style={[blobA, { backgroundColor: '#DBEAFE' }]} />
          <Animated.View pointerEvents="none" style={[blobB, { backgroundColor: '#E0E7FF' }]} />
          <Animated.View pointerEvents="none" style={[blobC, { backgroundColor: '#DCFCE7' }]} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 24, paddingBottom: 18 }}
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
                התחברות מהירה ובטוחה לניהול
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
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      gap: 10,
                      padding: 4,
                      borderRadius: 18,
                      backgroundColor: colors.elevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <AuthModeButton title="התחברות" active={mode === 'login'} onPress={() => setMode('login')} />
                    <AuthModeButton title="הרשמה ללקוח" active={mode === 'signup'} onPress={() => setMode('signup')} />
                  </View>

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
                  <Input
                    label="סיסמה"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••"
                    secureTextEntry
                    textContentType="password"
                    autoComplete="password"
                  />
                  {mode === 'signup' && (
                    <Input
                      label="אימות סיסמה"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••"
                      secureTextEntry
                      textContentType="password"
                      autoComplete="password"
                    />
                  )}

                  <Button
                    title={
                      submitting ? (mode === 'login' ? 'מתחבר…' : 'נרשם…') : mode === 'login' ? 'התחבר' : 'צור חשבון לקוח'
                    }
                    onPress={onSubmit}
                    disabled={!canSubmit}
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
                    {mode === 'login' && (
                      <View style={{ flex: 1 }}>
                        <Pressable
                          onPress={() =>
                            Toast.show({
                              type: 'info',
                              text1: 'טיפ',
                              text2: 'אם שכחת סיסמה — פנה למנהל מערכת לאיפוס.',
                            })
                          }
                          style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
                        >
                          <View
                            style={{
                              borderRadius: 18,
                              paddingVertical: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#EEF4FF',
                              borderWidth: 1,
                              borderColor: '#C7D8FF',
                            }}
                          >
                            <Text style={{ color: colors.primary, fontWeight: '900' }}>שכחתי סיסמה</Text>
                          </View>
                        </Pressable>
                      </View>
                    )}
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
                          <Text style={{ color: colors.primary, fontWeight: '800', textAlign: 'center', fontSize: 12 }}>
                            ההרשמה יוצרת חשבון לקוח בלבד
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>
                    {mode === 'login'
                      ? 'ממשק בהיר • RTL • אנימציות חלקות'
                      : 'חשבון לקוח • אהבתי • התחברות מהירה אחרי הרשמה'}
                  </Text>
                </View>
              </Card>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

