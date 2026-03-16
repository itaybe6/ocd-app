import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { CalendarDays, ClipboardList, PlayCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { WorkerScheduleScreen } from '../screens/worker/ScheduleScreen';
import { WorkerJobsScreen } from '../screens/worker/JobsScreen';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { yyyyMmDd } from '../lib/time';

export type WorkerDrawerParamList = {
  Schedule: undefined;
  Jobs: undefined;
};

const Drawer = createDrawerNavigator<WorkerDrawerParamList>();

function WorkerDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, user } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);

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
            label={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                {it.key === 'Schedule' ? <Badge count={badgeCount} /> : <View />}
                <Text style={{ color: colors.text, textAlign: 'right', fontWeight: '700', flex: 1 }}>{it.label}</Text>
              </View>
            )}
            icon={() => it.icon}
            onPress={() => props.navigation.navigate(it.key as any)}
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

