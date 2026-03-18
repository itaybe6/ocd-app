import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth } from '../state/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StoreHomeScreen } from '../screens/store/StoreHomeScreen';

type RootStackParamList = {
  Store: undefined;
  Login: undefined;
  Admin: undefined;
  Worker: undefined;
  Customer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AdminEntryScreen() {
  const AdminDrawer = require('./AdminDrawer').AdminDrawer as React.ComponentType;
  return <AdminDrawer />;
}

function WorkerEntryScreen() {
  const WorkerDrawer = require('./WorkerDrawer').WorkerDrawer as React.ComponentType;
  return <WorkerDrawer />;
}

function CustomerEntryScreen() {
  const CustomerDrawer = require('./CustomerDrawer').CustomerDrawer as React.ComponentType;
  return <CustomerDrawer />;
}

function PublicStoreScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Store'>) {
  return <StoreHomeScreen onAdminPress={() => navigation.navigate('Login')} />;
}

function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
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
          כניסת מנהל
        </Text>
        <Text className="text-sm" style={{ color: colors.muted, textAlign: 'right' }}>
          מסך זה נשאר עבור התחברות לניהול. הלקוחות רואים קודם את החנות.
        </Text>
        <Input
          label="טלפון"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="050..."
        />
        <Input
          label="סיסמה"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••"
          secureTextEntry
        />
        <Button title={submitting ? 'מתחבר...' : 'התחבר'} onPress={onSubmit} disabled={submitting} />
        <Button title="חזרה לחנות" variant="secondary" onPress={() => navigation.navigate('Store')} />
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

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        key={user ? `role:${user.role}` : 'anon'}
        screenOptions={{ headerShown: false }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Store" component={PublicStoreScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminEntryScreen} />
        ) : user.role === 'worker' ? (
          <Stack.Screen name="Worker" component={WorkerEntryScreen} />
        ) : (
          <Stack.Screen name="Customer" component={CustomerEntryScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

