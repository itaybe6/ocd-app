import React, { useMemo } from 'react';
import { Text, View, Pressable } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { CalendarDays, ClipboardList, PlayCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { WorkerScheduleScreen } from '../screens/worker/ScheduleScreen';
import { WorkerJobsScreen } from '../screens/worker/JobsScreen';

export type WorkerDrawerParamList = {
  Schedule: undefined;
  Jobs: undefined;
};

const Drawer = createDrawerNavigator<WorkerDrawerParamList>();

function WorkerDrawerContent(props: DrawerContentComponentProps) {
  const { signOut } = useAuth();
  const items = useMemo(
    () => [
      { key: 'Schedule' as const, label: 'לוז יומי', icon: <CalendarDays size={18} color={colors.text} /> },
      { key: 'Jobs' as const, label: 'היסטוריית משימות', icon: <ClipboardList size={18} color={colors.text} /> },
    ],
    []
  );

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>Worker</Text>
        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>מערכת עובד</Text>
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

export function WorkerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <WorkerDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerPosition: 'right',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Schedule" options={{ title: 'לוז יומי', drawerIcon: () => <PlayCircle size={18} color={colors.text} /> }} component={WorkerScheduleScreen} />
      <Drawer.Screen name="Jobs" options={{ title: 'היסטוריית משימות' }} component={WorkerJobsScreen} />
    </Drawer.Navigator>
  );
}

