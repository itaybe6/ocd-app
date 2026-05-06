import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CalendarDays, ClipboardList, LogOut } from 'lucide-react-native';
import { useAuth } from '../state/AuthContext';
import { AdminHeader } from '../components/AdminHeader';
import { WorkerScheduleScreen } from '../screens/worker/ScheduleScreen';
import { WorkerJobsScreen } from '../screens/worker/JobsScreen';
import { WorkerNotificationsScreen } from '../screens/worker/WorkerNotificationsScreen';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { yyyyMmDd } from '../lib/time';

export type WorkerDrawerParamList = {
  Schedule: undefined;
  Notifications: undefined;
  Jobs: undefined;
};

/* ─── Same design tokens as AdminDrawer ─── */
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

const Drawer = createDrawerNavigator<WorkerDrawerParamList>();

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Item = { key: keyof WorkerDrawerParamList; label: string; icon: LucideIcon; showBadge?: boolean };

function WorkerDrawerNavItem({
  label,
  Icon,
  active,
  onPress,
  badgeCount,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onPress: () => void;
  badgeCount?: number;
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
      {active && <View style={styles.activeStrip} />}
      <View style={styles.itemRow}>
        <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
          <Icon size={17} color={active ? D.primary : D.muted} strokeWidth={active ? 2.2 : 1.8} />
        </View>
        <View style={styles.itemLabelWrap}>
          <View style={styles.itemLabelRow}>
            <Text numberOfLines={1} style={[styles.itemLabel, active && styles.itemLabelActive]}>
              {label}
            </Text>
            {typeof badgeCount === 'number' && badgeCount > 0 ? <Badge count={badgeCount} /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function WorkerDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [badgeCount, setBadgeCount] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const refresh = async () => {
      const day = yyyyMmDd(new Date());
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const [inst, spec] = await Promise.all([
        supabase
          .from('installation_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', user.id)
          .eq('status', 'pending')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('special_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', user.id)
          .eq('status', 'pending')
          .gte('date', start)
          .lte('date', end),
      ]);

      if (!alive) return;
      const c = (inst.count ?? 0) + (spec.count ?? 0);
      setBadgeCount(c);
    };

    refresh();
    const channel = supabase
      .channel('worker_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installation_jobs' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_jobs' }, refresh)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const refreshNotif = async () => {
      const { count } = await supabase
        .from('worker_job_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (!alive) return;
      setNotifUnread(count ?? 0);
    };
    refreshNotif();
    const ch = supabase
      .channel('worker_notif_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_job_notifications' }, refreshNotif)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const navItems: Item[] = useMemo(
    () => [
      { key: 'Schedule', label: 'לוז יומי', icon: CalendarDays, showBadge: true },
      { key: 'Notifications', label: 'הודעות', icon: Bell, showBadge: true },
      { key: 'Jobs', label: 'היסטוריית משימות', icon: ClipboardList },
    ],
    []
  );

  const activeKey = props.state.routeNames[props.state.index] as keyof WorkerDrawerParamList;
  const name = user?.name ?? 'עובד';
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
      <View style={styles.header}>
        <View style={styles.glowCircle1} />
        <View style={styles.glowCircle2} />

        <View style={styles.headerContent}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>מערכת עובד</Text>
          </View>

          <View style={styles.userCard}>
            <View style={styles.userMeta}>
              <Text numberOfLines={1} style={styles.userName}>
                {name}
              </Text>
              {!!phone && (
                <Text numberOfLines={1} style={styles.userPhone}>
                  {phone}
                </Text>
              )}
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>עובד</Text>
              </View>
            </View>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.nav}>
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            {navItems.map((it) => (
              <WorkerDrawerNavItem
                key={String(it.key)}
                label={it.label}
                Icon={it.icon}
                active={activeKey === it.key}
                badgeCount={
                  it.showBadge
                    ? it.key === 'Schedule'
                      ? badgeCount
                      : it.key === 'Notifications'
                        ? notifUnread
                        : undefined
                    : undefined
                }
                onPress={() => props.navigation.navigate(it.key as any)}
              />
            ))}
          </View>
        </View>
      </View>

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

export function WorkerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <WorkerDrawerContent {...p} />}
      screenOptions={{
        header: ({ navigation }) => (
          <AdminHeader
            nameFallback="עובד"
            onMenuPress={() => (navigation as any).openDrawer()}
          />
        ),
        sceneStyle: { backgroundColor: '#F6F7FB' },
        drawerPosition: 'right',
        drawerType: 'front',
        drawerStyle: { backgroundColor: D.bg, width: 310 },
        overlayColor: 'rgba(15, 23, 42, 0.35)',
      }}
    >
      <Drawer.Screen
        name="Schedule"
        options={{ title: 'לוז יומי', drawerIcon: () => <CalendarDays size={18} color={D.text} /> }}
        component={WorkerScheduleScreen}
      />
      <Drawer.Screen
        name="Notifications"
        options={{ title: 'הודעות', drawerIcon: () => <Bell size={18} color={D.text} /> }}
        component={WorkerNotificationsScreen}
      />
      <Drawer.Screen
        name="Jobs"
        options={{ title: 'היסטוריית משימות', drawerIcon: () => <ClipboardList size={18} color={D.text} /> }}
        component={WorkerJobsScreen}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: D.bg },
  scrollContent: {},

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

  nav: { paddingHorizontal: 14, gap: 6 },
  section: { marginTop: 14 },
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
  itemLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemLabel: {
    color: D.textSoft,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  itemLabelActive: {
    color: D.text,
    fontWeight: '800',
  },

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
