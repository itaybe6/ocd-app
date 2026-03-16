import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, type DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  ClipboardList,
  LayoutDashboard,
  Users as UsersIcon,
  PlusCircle,
  PlayCircle,
  CalendarDays,
  FileBarChart2,
  Headset,
  Settings,
  Package,
  Wrench,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { Badge } from '../components/ui/Badge';
import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { SupportScreen } from '../screens/admin/SupportScreen';
import { UsersScreen } from '../screens/admin/UsersScreen';
import { JobsScreen } from '../screens/admin/JobsScreen';
import { AddJobsScreen } from '../screens/admin/AddJobsScreen';
import { JobExecutionScreen } from '../screens/admin/JobExecutionScreen';
import { WorkTemplatesScreen } from '../screens/admin/WorkTemplatesScreen';
import { WorkScheduleScreen } from '../screens/admin/WorkScheduleScreen';
import { DailyScheduleScreen } from '../screens/admin/DailyScheduleScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { DeviceInstallationScreen } from '../screens/admin/DeviceInstallationScreen';
import { InstallationJobsScreen } from '../screens/admin/InstallationJobsScreen';
import { DevicesAndScentsScreen } from '../screens/admin/DevicesAndScentsScreen';

export type AdminDrawerParamList = {
  Dashboard: undefined;
  Users: undefined;
  Jobs: undefined;
  AddJobs: undefined;
  JobExecution: undefined;
  WorkTemplates: undefined;
  WorkSchedule: undefined;
  DailySchedule: undefined;
  Support: undefined;
  Reports: undefined;
  DeviceInstallation: undefined;
  InstallationJobs: undefined;
  DevicesAndScents: undefined;
};

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

type Item = { key: keyof AdminDrawerParamList; label: string; icon: React.ReactNode };

function AdminDrawerContent(props: DrawerContentComponentProps) {
  const { signOut } = useAuth();
  const [supportNewCount, setSupportNewCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const { count, error } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('is_new', true);
      if (!alive) return;
      if (!error) setSupportNewCount(count ?? 0);
    };

    refresh();
    const channel = supabase
      .channel('support_tickets_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, refresh)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const items: Item[] = useMemo(
    () => [
      { key: 'Jobs', label: 'משימות ריח', icon: <ClipboardList size={18} color={colors.text} /> },
      { key: 'InstallationJobs', label: 'משימות מיוחדות', icon: <Wrench size={18} color={colors.text} /> },
      { key: 'AddJobs', label: 'הוספת משימות', icon: <PlusCircle size={18} color={colors.text} /> },
      { key: 'JobExecution', label: 'ביצוע משימות', icon: <PlayCircle size={18} color={colors.text} /> },
      { key: 'Dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} color={colors.text} /> },
      { key: 'DailySchedule', label: 'לוז יומי', icon: <CalendarDays size={18} color={colors.text} /> },
      { key: 'Users', label: 'משתמשים', icon: <UsersIcon size={18} color={colors.text} /> },
      { key: 'DevicesAndScents', label: 'מכשירים וניחוחות', icon: <Package size={18} color={colors.text} /> },
      { key: 'WorkTemplates', label: 'תבניות עבודה', icon: <Settings size={18} color={colors.text} /> },
      { key: 'WorkSchedule', label: 'קווי עבודה', icon: <CalendarDays size={18} color={colors.text} /> },
      { key: 'Support', label: 'שירות לקוחות', icon: <Headset size={18} color={colors.text} /> },
      { key: 'Reports', label: 'דוחות', icon: <FileBarChart2 size={18} color={colors.text} /> },
    ],
    []
  );

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingTop: 10 }}
      style={{ backgroundColor: colors.bg }}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>Admin</Text>
        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>מערכת ניהול</Text>
      </View>
      <View style={{ paddingHorizontal: 8 }}>
        {items.map((it) => (
          <DrawerItem
            key={String(it.key)}
            label={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                {it.key === 'Support' ? <Badge count={supportNewCount} /> : <View />}
                <Text style={{ color: colors.text, textAlign: 'right', fontWeight: '700', flex: 1 }}>{it.label}</Text>
              </View>
            )}
            icon={() => it.icon}
            focused={props.state.routeNames[props.state.index] === it.key}
            onPress={() => props.navigation.navigate(it.key as any)}
            style={{
              borderRadius: 14,
              marginHorizontal: 4,
              backgroundColor: props.state.routeNames[props.state.index] === it.key ? colors.elevated : 'transparent',
            }}
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

export function AdminDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <AdminDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerPosition: 'right',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Dashboard" options={{ title: 'לוח בקרה' }} component={DashboardScreen} />
      <Drawer.Screen name="Users" options={{ title: 'משתמשים' }} component={UsersScreen} />
      <Drawer.Screen name="Jobs" options={{ title: 'משימות ריח' }} component={JobsScreen} />
      <Drawer.Screen name="AddJobs" options={{ title: 'הוספת משימות' }} component={AddJobsScreen} />
      <Drawer.Screen name="JobExecution" options={{ title: 'ביצוע משימות' }} component={JobExecutionScreen} />
      <Drawer.Screen name="WorkTemplates" options={{ title: 'תבניות עבודה' }} component={WorkTemplatesScreen} />
      <Drawer.Screen name="WorkSchedule" options={{ title: 'קווי עבודה' }} component={WorkScheduleScreen} />
      <Drawer.Screen name="DailySchedule" options={{ title: 'לוז יומי' }} component={DailyScheduleScreen} />
      <Drawer.Screen name="Support" options={{ title: 'שירות לקוחות' }} component={SupportScreen} />
      <Drawer.Screen name="Reports" options={{ title: 'דוחות' }} component={ReportsScreen} />
      <Drawer.Screen name="DeviceInstallation" options={{ title: 'התקנת מכשירים' }} component={DeviceInstallationScreen} />
      <Drawer.Screen name="InstallationJobs" options={{ title: 'משימות מיוחדות' }} component={InstallationJobsScreen} />
      <Drawer.Screen name="DevicesAndScents" options={{ title: 'מכשירים וניחוחות' }} component={DevicesAndScentsScreen} />
    </Drawer.Navigator>
  );
}

