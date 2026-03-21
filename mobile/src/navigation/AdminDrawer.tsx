import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClipboardList,
  LayoutDashboard,
  Users as UsersIcon,
  CalendarDays,
  FileBarChart2,
  Headset,
  Settings,
  Package,
  Store,
  LogOut,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/AuthContext';
import { Badge } from '../components/ui/Badge';
import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { SupportScreen } from '../screens/admin/SupportScreen';
import { UsersScreen } from '../screens/admin/UsersScreen';
import { JobsScreen } from '../screens/admin/JobsScreen';
import { WorkTemplatesScreen } from '../screens/admin/WorkTemplatesScreen';
import { WorkScheduleScreen } from '../screens/admin/WorkScheduleScreen';
import { DailyScheduleScreen } from '../screens/admin/DailyScheduleScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { DevicesAndScentsScreen } from '../screens/admin/DevicesAndScentsScreen';
import { StoreManagementScreen } from '../screens/admin/StoreManagementScreen';

export type AdminDrawerParamList = {
  Dashboard: undefined;
  Users: undefined;
  Jobs: undefined;
  WorkTemplates: undefined;
  WorkSchedule: undefined;
  DailySchedule: undefined;
  Support: undefined;
  Reports: undefined;
  DevicesAndScents: undefined;
  StoreManagement: undefined;
};

/* ─── Design tokens (light premium theme) ─── */
const D = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHigh: '#F8FAFF',
  border: '#E5E7EB',
  borderFaint: '#E5E7EB80',
  text: '#0F172A',
  textSoft: '#0F172A',
  muted: '#64748B',
  primary: '#2563EB',
  primarySoft: '#2563EB12',
  primaryBorder: '#2563EB2A',
  accent: '#7C3AED',
  accentSoft: '#7C3AED12',
  danger: '#DC2626',
  dangerSoft: '#DC26260A',
  dangerBorder: '#DC262633',
  white: '#FFFFFF',
} as const;

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Item = { key: keyof AdminDrawerParamList; label: string; icon: LucideIcon; badge?: 'supportNew' };
type Section = { title: string; items: Item[] };

/* ─── Single navigation row ─── */
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
      {/* Active side indicator strip */}
      {active && <View style={styles.activeStrip} />}

      {/* Icon + Label in same row (forced alignment) */}
      <View style={styles.itemRow}>
        <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
          <Icon size={17} color={active ? D.primary : D.muted} strokeWidth={active ? 2.2 : 1.8} />
        </View>
        <View style={styles.itemLabelWrap}>
          <Text numberOfLines={1} style={[styles.itemLabel, active && styles.itemLabelActive]}>
            {label}
          </Text>
        </View>
      </View>

      {/* Badge */}
      {!!badgeCount && badgeCount > 0 && <Badge count={badgeCount} />}
    </Pressable>
  );
}

/* ─── Section group ─── */
function SectionGroup({ section, activeKey, supportNewCount, navigate }: {
  section: Section;
  activeKey: string;
  supportNewCount: number;
  navigate: (key: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <View style={styles.sectionDash} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
      <View style={styles.sectionCard}>
        {section.items.map((it) => (
          <DrawerNavItem
            key={String(it.key)}
            label={it.label}
            Icon={it.icon}
            active={activeKey === it.key}
            badgeCount={it.badge === 'supportNew' ? supportNewCount : undefined}
            onPress={() => navigate(it.key as string)}
          />
        ))}
      </View>
    </View>
  );
}

/* ─── Drawer content ─── */
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
          { key: 'Jobs', label: 'משימות', icon: ClipboardList },
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
          { key: 'WorkTemplates', label: 'תבניות עבודה', icon: Settings },
          { key: 'StoreManagement', label: 'ניהול חנות', icon: Store },
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
  const name = user?.name ?? 'Admin';
  const initials = name.trim().slice(0, 1).toUpperCase();
  const phone = user?.phone ?? '';

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Decorative glow circles */}
        <View style={styles.glowCircle1} />
        <View style={styles.glowCircle2} />

        <View style={styles.headerContent}>
          {/* App brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>מערכת ניהול</Text>
          </View>

          {/* User card */}
          <View style={styles.userCard}>
            <View style={styles.userMeta}>
              <Text numberOfLines={1} style={styles.userName}>{name}</Text>
              {!!phone && <Text numberOfLines={1} style={styles.userPhone}>{phone}</Text>}
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>מנהל</Text>
              </View>
            </View>
            {/* Avatar */}
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Navigation sections ── */}
      <View style={styles.nav}>
        {sections.map((section) => (
          <SectionGroup
            key={section.title}
            section={section}
            activeKey={String(activeKey)}
            supportNewCount={supportNewCount}
            navigate={(key) => props.navigation.navigate(key as any)}
          />
        ))}
      </View>

      {/* ── Footer / Logout ── */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
        >
          <View style={styles.logoutRow}>
            <View style={styles.logoutIconWrap}>
              <LogOut size={17} color={D.danger} strokeWidth={2} />
            </View>
            <View style={styles.logoutTextWrap}>
              <Text style={styles.logoutText}>התנתקות</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

/* ─── Drawer navigator ─── */
export function AdminDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <AdminDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0F172A',
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: '#F6F7FB' },
        drawerPosition: 'right',
        drawerType: 'front',
        drawerStyle: { backgroundColor: D.bg, width: 310 },
        overlayColor: 'rgba(15, 23, 42, 0.35)',
      }}
    >
      <Drawer.Screen name="Dashboard" options={{ title: 'לוח בקרה' }} component={DashboardScreen} />
      <Drawer.Screen name="Users" options={{ title: 'משתמשים' }} component={UsersScreen} />
      <Drawer.Screen name="Jobs" options={{ title: 'משימות' }} component={JobsScreen} />
      <Drawer.Screen name="WorkTemplates" options={{ title: 'תבניות עבודה' }} component={WorkTemplatesScreen} />
      <Drawer.Screen name="WorkSchedule" options={{ title: 'קווי עבודה' }} component={WorkScheduleScreen} />
      <Drawer.Screen name="DailySchedule" options={{ title: 'לוז יומי' }} component={DailyScheduleScreen} />
      <Drawer.Screen name="Support" options={{ title: 'שירות לקוחות' }} component={SupportScreen} />
      <Drawer.Screen name="Reports" options={{ title: 'דוחות' }} component={ReportsScreen} />
      <Drawer.Screen name="DevicesAndScents" options={{ title: 'מכשירים וניחוחות' }} component={DevicesAndScentsScreen} />
      <Drawer.Screen name="StoreManagement" options={{ title: 'ניהול חנות' }} component={StoreManagementScreen} />
    </Drawer.Navigator>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  scroll: { backgroundColor: D.bg },
  scrollContent: {},

  /* Header */
  header: {
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 24,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
    shadowColor: D.primary,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  glowCircle1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: D.primary,
    opacity: 0.08,
    top: -60,
    right: -40,
  },
  glowCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: D.accent,
    opacity: 0.06,
    bottom: -30,
    left: -20,
  },
  headerContent: { padding: 18 },
  brandRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.primary,
    shadowColor: D.primary,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  brandText: {
    color: D.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  userCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  userMeta: { flex: 1, alignItems: 'flex-end' },
  userName: {
    color: D.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  userPhone: {
    color: D.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 3,
  },
  rolePill: {
    marginTop: 8,
    backgroundColor: D.primarySoft,
    borderWidth: 1,
    borderColor: D.primaryBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-end',
  },
  roleText: {
    color: D.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  avatarOuter: {
    padding: 2,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: D.primaryBorder,
    backgroundColor: D.primarySoft,
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: D.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: D.primary,
    fontSize: 20,
    fontWeight: '900',
  },

  /* Navigation */
  nav: { paddingHorizontal: 14, gap: 6 },
  section: { marginTop: 14 },
  sectionLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionDash: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: D.border,
  },
  sectionTitle: {
    color: D.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: D.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: D.text,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  /* Item */
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 14,
    marginHorizontal: 0,
    borderRadius: 12,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  itemActive: { backgroundColor: D.primarySoft },
  itemPressed: { backgroundColor: '#0F172A06' },
  activeStrip: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: D.primary,
    shadowColor: D.primary,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  itemDivider: { height: 0 },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: D.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  iconBubbleActive: {
    backgroundColor: D.primarySoft,
    borderColor: D.primaryBorder,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemLabelWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  itemLabel: {
    color: D.textSoft,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  itemLabelActive: {
    color: D.text,
    fontWeight: '800',
  },

  /* Footer */
  footer: { paddingHorizontal: 14, marginTop: 18 },
  footerDivider: {
    height: 1,
    backgroundColor: D.border,
    marginBottom: 14,
  },
  logoutBtn: {
    backgroundColor: D.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: D.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 16,
    shadowColor: D.danger,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  logoutBtnPressed: { backgroundColor: D.dangerSoft },
  logoutRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 38,
    gap: 12,
  },
  logoutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: D.dangerSoft,
    borderWidth: 1,
    borderColor: D.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  logoutText: {
    color: D.danger,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'right',
  },
});
