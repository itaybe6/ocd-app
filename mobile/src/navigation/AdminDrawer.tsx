import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  LogOut,
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

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
type Item = { key: keyof AdminDrawerParamList; label: string; icon: LucideIcon; badge?: 'supportNew' };
type Section = { title: string; items: Item[] };

function DrawerNavItem({
  label,
  Icon,
  active,
  badgeCount,
  onPress,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badgeCount?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.item,
        active && styles.itemActive,
        pressed && !active && styles.itemPressed,
      ]}
    >
      <View style={styles.itemLeft}>
        {!!badgeCount && badgeCount > 0 ? <Badge count={badgeCount} /> : null}
      </View>

      <View style={styles.itemCenter}>
        <Text numberOfLines={1} style={[styles.itemLabel, active && styles.itemLabelActive]}>
          {label}
        </Text>
      </View>

      <View style={styles.itemRight}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <Icon size={18} color={active ? colors.primary : colors.muted} />
        </View>
      </View>
    </Pressable>
  );
}

function AdminDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
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

  const sections: Section[] = useMemo(
    () => [
      {
        title: 'משימות',
        items: [
          { key: 'Jobs', label: 'משימות ריח', icon: ClipboardList },
          { key: 'InstallationJobs', label: 'משימות מיוחדות', icon: Wrench },
          { key: 'AddJobs', label: 'הוספת משימות', icon: PlusCircle },
          { key: 'JobExecution', label: 'ביצוע משימות', icon: PlayCircle },
        ],
      },
      {
        title: 'ניהול',
        items: [
          { key: 'Dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
          { key: 'DailySchedule', label: 'לוז יומי', icon: CalendarDays },
          { key: 'WorkSchedule', label: 'קווי עבודה', icon: CalendarDays },
          { key: 'Users', label: 'משתמשים', icon: UsersIcon },
          { key: 'DevicesAndScents', label: 'מכשירים וניחוחות', icon: Package },
          { key: 'DeviceInstallation', label: 'התקנת מכשירים', icon: Wrench },
          { key: 'WorkTemplates', label: 'תבניות עבודה', icon: Settings },
        ],
      },
      {
        title: 'תמיכה ודוחות',
        items: [
          { key: 'Support', label: 'שירות לקוחות', icon: Headset, badge: 'supportNew' },
          { key: 'Reports', label: 'דוחות', icon: FileBarChart2 },
        ],
      },
    ],
    []
  );

  const activeKey = props.state.routeNames[props.state.index] as keyof AdminDrawerParamList;
  const initials = (user?.name || 'Admin').trim().slice(0, 1).toUpperCase();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: 12 + insets.top, paddingBottom: 18 + insets.bottom },
      ]}
      style={styles.scroll}
    >
      <View style={styles.header}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerMeta}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                מערכת ניהול
              </Text>
              <Text numberOfLines={1} style={styles.headerSubtitle}>
                {user?.name ? user.name : 'Admin'}
                {user?.phone ? ` · ${user.phone}` : ''}
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sections}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((it) => (
                <DrawerNavItem
                  key={String(it.key)}
                  label={it.label}
                  Icon={it.icon}
                  active={activeKey === it.key}
                  badgeCount={it.badge === 'supportNew' ? supportNewCount : undefined}
                  onPress={() => props.navigation.navigate(it.key as any)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
        >
          <View style={styles.logoutRow}>
            <Text style={styles.logoutText}>התנתקות</Text>
            <View style={styles.logoutIcon}>
              <LogOut size={18} color={colors.danger} />
            </View>
          </View>
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
        drawerStyle: { backgroundColor: colors.bg, width: 320 },
        overlayColor: 'rgba(15, 23, 42, 0.35)',
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

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  scrollContent: {},

  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerCard: {
    backgroundColor: colors.elevated,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMeta: { flex: 1, paddingRight: 12 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { color: colors.muted, marginTop: 2, textAlign: 'right', fontWeight: '700', fontSize: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#2563EB1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563EB2A',
  },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 16 },

  sections: { paddingHorizontal: 16 },
  section: { marginTop: 10 },
  sectionTitle: { color: colors.muted, fontWeight: '900', fontSize: 12, textAlign: 'right', marginBottom: 8 },
  sectionCard: {
    backgroundColor: colors.elevated,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginVertical: 3,
  },
  itemActive: { backgroundColor: '#2563EB12' },
  itemPressed: { backgroundColor: '#0F172A08' },
  itemLeft: { width: 46, alignItems: 'flex-start' },
  itemCenter: { flex: 1, paddingHorizontal: 8, justifyContent: 'center' },
  itemRight: { width: 42, alignItems: 'flex-end', justifyContent: 'center' },
  itemLabel: {
    color: colors.text,
    textAlign: 'right',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    transform: [{ translateY: 2 }],
  },
  itemLabelActive: { color: colors.primary },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A08',
  },
  iconWrapActive: { backgroundColor: '#2563EB1A' },

  footer: { paddingHorizontal: 16, marginTop: 12 },
  logout: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#DC262633',
    backgroundColor: colors.elevated,
  },
  logoutPressed: { backgroundColor: '#DC26260A' },
  logoutRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '900',
    textAlign: 'right',
    includeFontPadding: false,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    transform: [{ translateY: 1 }],
  },
  logoutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#DC26260F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

