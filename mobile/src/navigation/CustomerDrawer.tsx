import React, { useMemo } from 'react';
import { Text, View, Pressable } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { Headset, User, Wrench } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { CustomerProfileScreen } from '../screens/customer/ProfileScreen';
import { CustomerServicesScreen } from '../screens/customer/ServicesScreen';
import { CustomerSupportScreen } from '../screens/customer/SupportScreen';

export type CustomerDrawerParamList = {
  Profile: undefined;
  Services: undefined;
  Support: undefined;
};

const Drawer = createDrawerNavigator<CustomerDrawerParamList>();

function CustomerDrawerContent(props: DrawerContentComponentProps) {
  const { signOut } = useAuth();
  const items = useMemo(
    () => [
      { key: 'Profile' as const, label: 'פרופיל', icon: <User size={18} color={colors.text} /> },
      { key: 'Services' as const, label: 'שירותים', icon: <Wrench size={18} color={colors.text} /> },
      { key: 'Support' as const, label: 'תמיכה טכנית', icon: <Headset size={18} color={colors.text} /> },
    ],
    []
  );

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>Customer</Text>
        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>מערכת לקוח</Text>
      </View>
      <View style={{ paddingHorizontal: 8 }}>
        {items.map((it) => (
          <DrawerItem
            key={it.key}
            label={it.label}
            icon={() => it.icon}
            onPress={() => props.navigation.navigate(it.key as any)}
            labelStyle={{ color: colors.text, textAlign: 'right', fontWeight: '700' }}
            style={{ borderRadius: 14, marginHorizontal: 4 }}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <Pressable
          onPress={() => signOut()}
          style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'right' }}>התנתקות</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

export function CustomerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <CustomerDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerPosition: 'right',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Profile" options={{ title: 'פרופיל' }} component={CustomerProfileScreen} />
      <Drawer.Screen name="Services" options={{ title: 'שירותים' }} component={CustomerServicesScreen} />
      <Drawer.Screen name="Support" options={{ title: 'תמיכה טכנית' }} component={CustomerSupportScreen} />
    </Drawer.Navigator>
  );
}

