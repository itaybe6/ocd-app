import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth } from '../state/AuthContext';
import { AdminDrawer } from './AdminDrawer';
import { WorkerDrawer } from './WorkerDrawer';
import { CustomerDrawer } from './CustomerDrawer';

type RootStackParamList = {
  Login: undefined;
  Admin: undefined;
  Worker: undefined;
  Customer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      await signInWithPassword({ phone, password });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שגיאה בהתחברות', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4">
        <Text className="text-3xl font-semibold" style={{ color: colors.text, textAlign: 'right' }}>
          התחברות
        </Text>
        <View className="gap-2">
          <Text className="text-sm" style={{ color: colors.muted, textAlign: 'right' }}>
            טלפון
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="050..."
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.text,
              textAlign: 'right',
            }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm" style={{ color: colors.muted, textAlign: 'right' }}>
            סיסמה
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.text,
              textAlign: 'right',
            }}
          />
        </View>
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? '#1F3A5F' : colors.primary,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting ? 'מתחבר…' : 'התחבר'}</Text>
        </Pressable>
        <Text className="text-xs" style={{ color: colors.muted, textAlign: 'right' }}>
          טיפ: נדרש להגדיר `EXPO_PUBLIC_SUPABASE_URL` ו-`EXPO_PUBLIC_SUPABASE_ANON_KEY` בקובץ `.env`.
        </Text>
      </View>
    </Screen>
  );
}

export function RootNavigator() {
  const { user, isBootstrapping } = useAuth();

  const navTheme = useMemo<Theme>(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.bg,
        card: colors.card,
        border: colors.border,
        text: colors.text,
        primary: colors.primary,
      },
    }),
    []
  );

  if (isBootstrapping) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const initialRouteName: keyof RootStackParamList = !user
    ? 'Login'
    : user.role === 'admin'
      ? 'Admin'
      : user.role === 'worker'
        ? 'Worker'
        : 'Customer';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminDrawer} />
        ) : user.role === 'worker' ? (
          <Stack.Screen name="Worker" component={WorkerDrawer} />
        ) : (
          <Stack.Screen name="Customer" component={CustomerDrawer} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

