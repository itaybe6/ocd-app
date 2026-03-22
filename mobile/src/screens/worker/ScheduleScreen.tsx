import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { svgPathProperties } from 'svg-path-properties';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { JobCard, JobChip } from '../../components/jobs/JobCard';
import { getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { yyyyMmDd } from '../../lib/time';
import { useAuth } from '../../state/AuthContext';
import { useLoading } from '../../state/LoadingContext';
import { pickImageFromLibrary } from '../../lib/media';
import { completeUnifiedJob, uploadInstallationDeviceImage, uploadJobServicePointImage, uploadSpecialJobImage } from '../../lib/execution';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  order_number?: number | null;
  notes?: string | null;
};

type JobServicePoint = { id: string; job_id: string; service_point_id: string; image_url?: string | null; custom_refill_amount?: number | null };
type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };
type InstallationDevice = { id: string; installation_job_id: string; device_name?: string | null; image_url?: string | null };
type SpecialJob = { id: string; battery_type?: 'AA' | 'DC' | null; job_type?: string | null; image_url?: string | null };

const kindLabel = (k: Kind) => (k === 'regular' ? 'רגילה' : k === 'installation' ? 'התקנה' : 'מיוחדת');

const AnimatedPath = Animated.createAnimatedComponent(Path);

type AnimatedDonutProps = {
  width?: number;
  height?: number;
  radius?: number;
  strokeColor?: string;
  strokeInactiveColor?: string;
  strokeWidth?: number;
  current?: number;
  max?: number;
  duration?: number;
  delay?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function AnimatedDonut({
  width = 100,
  height = 144,
  radius = 100 * 0.4,
  strokeColor = '#80D15A',
  strokeInactiveColor = '#353C51',
  strokeWidth = 12,
  current = 0,
  max = 1,
  duration = 500,
  delay = 500,
  children,
  style,
}: AnimatedDonutProps) {
  const safeMax = max <= 0 ? 1 : max;
  const safeCurrent = Math.max(0, Math.min(current, safeMax));

  const d = `
    M ${width / 2} 0
    H ${width - radius}
    C ${width} 0, ${width} ${radius}, ${width} ${radius}
    V ${height - radius}
    C ${width} ${height}, ${width - radius} ${height}, ${width - radius} ${height}
    H ${radius}
    C 0 ${height}, 0 ${height - radius}, 0 ${height - radius}
    V ${radius}
    C 0 0, ${radius} 0, ${radius} 0
    H ${width / 2}
  `;

  const wRatio = strokeWidth ? 1 - strokeWidth / width : 1;
  const hRatio = strokeWidth ? 1 - strokeWidth / height : 1;

  const properties = new svgPathProperties(d);
  const length = properties.getTotalLength();
  const animatedValue = useSharedValue(length);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(length - (safeCurrent * length) / safeMax, { duration })
    );
  }, [delay, duration, length, safeCurrent, safeMax]);

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: animatedValue.value,
    };
  });

  return (
    <View style={[style, { width, height }]}>
      <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <Path
          originX={width / 2}
          originY={height / 2}
          scaleX={wRatio}
          scaleY={hRatio}
          strokeWidth={strokeWidth}
          d={d}
          fill="transparent"
          stroke={strokeInactiveColor}
          strokeLinejoin="miter"
          strokeMiterlimit={0}
        />
        <AnimatedPath
          originX={width / 2}
          originY={height / 2}
          scaleX={wRatio}
          scaleY={hRatio}
          strokeWidth={strokeWidth}
          d={d}
          fill="transparent"
          stroke={strokeColor}
          strokeDasharray={length}
          strokeLinejoin="miter"
          strokeMiterlimit={0}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      <View
        style={{
          top: strokeWidth,
          left: strokeWidth,
          right: strokeWidth,
          bottom: strokeWidth,
          position: 'absolute',
          borderRadius: radius - strokeWidth * 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function WorkerScheduleScreen() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const [date, setDate] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);
  const [daySummary, setDaySummary] = useState<{
    scent: { key: string; amount: number }[];
    equipmentCount: number;
    batteries: { key: string; count: number }[];
  }>({ scent: [], equipmentCount: 0, batteries: [] });

  const [selected, setSelected] = useState<Unified | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]>([]);
  const [installationDevices, setInstallationDevices] = useState<(InstallationDevice & { localImageUri?: string | null; uploading?: boolean })[]>([]);
  const [special, setSpecial] = useState<(SpecialJob & { localImageUri?: string | null; uploading?: boolean }) | null>(null);

  const filtered = useMemo(() => {
    return items.filter((it) => (kindFilter ? it.kind === kindFilter : true));
  }, [items, kindFilter]);

  const oilTotals = useMemo(() => {
    const totalMl = daySummary.scent.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const liters = totalMl / 1000;
    const maxLiters = Math.max(20, Math.ceil(liters / 5) * 5 || 20);
    return { totalMl, liters, maxLiters };
  }, [daySummary.scent]);

  const fetchForDay = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const day = date.trim() || yyyyMmDd(new Date());

      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const [regRes, instRes, specRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, date, status, order_number, notes')
          .eq('worker_id', user.id)
          .eq('status', 'pending')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('installation_jobs')
          .select('id, date, status, order_number, notes')
          .eq('worker_id', user.id)
          .eq('status', 'pending')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('special_jobs')
          .select('id, date, status, order_number, notes')
          .eq('worker_id', user.id)
          .eq('status', 'pending')
          .gte('date', start)
          .lte('date', end),
      ]);

      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;

      const regs = (regRes.data ?? []).map((r: any) => ({ kind: 'regular', ...r }) as Unified);
      const insts = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const specs = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);
      const all = [...regs, ...insts, ...specs].sort((a, b) => (a.date < b.date ? -1 : 1));
      setItems(all);

      // Daily summaries across ALL jobs for the day
      const regularIds = regs.map((r) => r.id);
      const installationIds = insts.map((r) => r.id);
      const specialIds = specs.map((r) => r.id);

      const safe = async <T,>(p: PromiseLike<{ data: T | null; error: any }>, fallback: T) => {
        const res = await p;
        if (res?.error) return fallback;
        return (res.data ?? fallback) as T;
      };

      // Scent summary
      let scentRows: { service_point_id: string; custom_refill_amount?: number | null }[] = [];
      if (regularIds.length) {
        scentRows = await safe(
          supabase
            .from('job_service_points')
            .select('service_point_id, custom_refill_amount')
            .in('job_id', regularIds),
          []
        );
      }
      const spIds = Array.from(new Set(scentRows.map((r) => r.service_point_id)));
      const spData = spIds.length
        ? await safe(
            supabase.from('service_points').select('id, scent_type, refill_amount').in('id', spIds),
            []
          )
        : [];
      const spMap = new Map((spData as any[]).map((sp) => [sp.id as string, sp]));
      const scentMap = new Map<string, number>();
      for (const r of scentRows) {
        const sp = spMap.get(r.service_point_id);
        const scent = String(sp?.scent_type ?? 'unknown');
        const amt = Number(r.custom_refill_amount ?? sp?.refill_amount ?? 0);
        scentMap.set(scent, (scentMap.get(scent) ?? 0) + amt);
      }

      // Equipment summary
      const instDevices = installationIds.length
        ? await safe(
            supabase.from('installation_devices').select('id').in('installation_job_id', installationIds),
            []
          )
        : [];

      // Batteries summary
      const specRows = specialIds.length
        ? await safe(
            supabase.from('special_jobs').select('id, job_type, battery_type').in('id', specialIds),
            []
          )
        : [];
      const batteryMap = new Map<string, number>();
      for (const r of specRows as any[]) {
        if (!r?.battery_type) continue;
        const key = String(r.battery_type);
        batteryMap.set(key, (batteryMap.get(key) ?? 0) + 1);
      }

      setDaySummary({
        scent: Array.from(scentMap.entries())
          .map(([key, amount]) => ({ key, amount }))
          .sort((a, b) => b.amount - a.amount),
        equipmentCount: (instDevices as any[]).length,
        batteries: Array.from(batteryMap.entries()).map(([key, count]) => ({ key, count })),
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchForDay();
    }, [user?.id, date])
  );

  const open = async (it: Unified) => {
    setSelected(it);
    setRegularPoints([]);
    setInstallationDevices([]);
    setSpecial(null);

    try {
      if (it.kind === 'regular') {
        const { data: jsp, error } = await supabase
          .from('job_service_points')
          .select('id, job_id, service_point_id, image_url, custom_refill_amount')
          .eq('job_id', it.id);
        if (error) throw error;
        const rows = (jsp ?? []) as JobServicePoint[];
        const spIds = rows.map((r) => r.service_point_id);
        let spMap = new Map<string, ServicePoint>();
        if (spIds.length) {
          const { data: sps, error: spErr } = await supabase
            .from('service_points')
            .select('id, device_type, scent_type, refill_amount')
            .in('id', spIds);
          if (spErr) throw spErr;
          spMap = new Map(((sps ?? []) as ServicePoint[]).map((sp) => [sp.id, sp]));
        }
        setRegularPoints(rows.map((r) => ({ ...r, sp: spMap.get(r.service_point_id) ?? null })));
      }

      if (it.kind === 'installation') {
        const { data, error } = await supabase
          .from('installation_devices')
          .select('id, installation_job_id, device_name, image_url')
          .eq('installation_job_id', it.id);
        if (error) throw error;
        setInstallationDevices((data ?? []) as any);
      }

      if (it.kind === 'special') {
        const { data, error } = await supabase
          .from('special_jobs')
          .select('id, battery_type, job_type, image_url')
          .eq('id', it.id)
          .single();
        if (error) throw error;
        setSpecial(data as any);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פרטים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const pick = async (onPicked: (uri: string) => void) => {
    const uri = await pickImageFromLibrary();
    if (uri) onPicked(uri);
  };

  const uploadRegularPoint = async (p: (typeof regularPoints)[number]) => {
    if (!selected) return;
    if (!p.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadJobServicePointImage({
        jobId: selected.id,
        jobServicePointId: p.id,
        servicePointId: p.service_point_id,
        localUri: p.localImageUri,
      });
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const uploadInstallationDevice = async (d: (typeof installationDevices)[number]) => {
    if (!selected) return;
    if (!d.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: true } : x)));
      const storagePath = await uploadInstallationDeviceImage({
        installationJobId: selected.id,
        installationDeviceId: d.id,
        localUri: d.localImageUri,
      });
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const uploadSpecial = async () => {
    if (!selected || !special) return;
    if (!special.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setSpecial((p) => (p ? { ...p, uploading: true } : p));
      const storagePath = await uploadSpecialJobImage({ specialJobId: special.id, localUri: special.localImageUri });
      setSpecial((p) => (p ? { ...p, image_url: storagePath, uploading: false } : p));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setSpecial((p) => (p ? { ...p, uploading: false } : p));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const complete = async () => {
    if (!selected) return;
    try {
      setIsLoading(true);
      await completeUnifiedJob(selected.kind, selected.id);
      setItems((prev) => prev.filter((x) => x.id !== selected.id));
      Toast.show({ type: 'success', text1: 'הושלם' });
      setSelected(null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const summaries = useMemo(() => {
    const scent = new Map<string, number>();
    for (const p of regularPoints) {
      const st = p.sp?.scent_type ?? 'unknown';
      const amt = p.custom_refill_amount ?? p.sp?.refill_amount ?? 0;
      scent.set(st, (scent.get(st) ?? 0) + Number(amt));
    }
    const battery = new Map<string, number>();
    if (special?.battery_type) battery.set(special.battery_type, 1);
    return {
      scent: Array.from(scent.entries()).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v),
      equipmentCount: installationDevices.length,
      batteries: Array.from(battery.entries()).map(([k, v]) => ({ k, v })),
    };
  }, [regularPoints, installationDevices.length, special?.battery_type]);

  return (
    <Screen backgroundColor="#FAF9FE">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchForDay} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>לוז יומי</Text>
        </View>
        <Input label="תאריך (yyyy-MM-dd) אופציונלי" value={date} onChangeText={setDate} placeholder={yyyyMmDd(new Date())} />
        <SelectSheet
          label="סוג"
          value={kindFilter}
          placeholder="הכל"
          options={[
            { value: '', label: 'הכל' },
            { value: 'regular', label: 'regular' },
            { value: 'installation', label: 'installation' },
            { value: 'special', label: 'special' },
          ]}
          onChange={(v) => setKindFilter((v || '') as any)}
        />
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <View style={styles.oilCard}>
          <View style={styles.oilHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.oilTitle}>שמן להיום</Text>
              <Text style={styles.oilSubtitle}>
                לפי סך המילויים בעבודות של היום • {items.length} משימות
              </Text>
            </View>
            <AnimatedDonut
              current={Number(oilTotals.liters.toFixed(2))}
              max={oilTotals.maxLiters}
              strokeColor="#4985E0"
              strokeInactiveColor="rgba(255,255,255,0.12)"
              strokeWidth={6}
              width={78}
              height={108}
              radius={78 * 0.4}
              delay={350}
              duration={550}
            >
              <View style={styles.oilDonutInner}>
                <Text style={styles.oilDonutValue}>{oilTotals.liters.toFixed(1)}</Text>
                <View style={styles.oilDivider} />
                <Text style={styles.oilDonutMax}>{oilTotals.maxLiters}L</Text>
              </View>
            </AnimatedDonut>
          </View>

          <View style={styles.oilMetaRow}>
            <View style={styles.oilMetaPill}>
              <Text style={styles.oilMetaLabel}>סה״כ</Text>
              <Text style={styles.oilMetaValue}>{Math.round(oilTotals.totalMl)} מ״ל</Text>
            </View>
            <View style={styles.oilMetaPill}>
              <Text style={styles.oilMetaLabel}>התקנות</Text>
              <Text style={styles.oilMetaValue}>{daySummary.equipmentCount} ציוד</Text>
            </View>
            <View style={styles.oilMetaPill}>
              <Text style={styles.oilMetaLabel}>סוללות</Text>
              <Text style={styles.oilMetaValue}>{daySummary.batteries.map((b) => `${b.key}:${b.count}`).join(' • ') || '—'}</Text>
            </View>
          </View>

          {daySummary.scent.length ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={styles.oilBreakdownTitle}>פירוט לפי ניחוח</Text>
              <View style={{ gap: 4 }}>
                {daySummary.scent.slice(0, 5).map((s) => (
                  <View key={s.key} style={styles.oilBreakdownRow}>
                    <Text style={styles.oilBreakdownValue}>{Math.round(s.amount)} מ״ל</Text>
                    <Text style={styles.oilBreakdownKey}>{s.key}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <JobCard
            title={`#${item.order_number ?? '—'} - ${kindLabel(item.kind)}`}
            status={item.status}
            description={item.notes ?? null}
            onPress={() => open(item)}
            chips={
              <>
                <JobChip text={kindLabel(item.kind)} />
                <JobChip text={yyyyMmDd(item.date)} muted />
              </>
            }
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 12 }}>
            <JobCard
              title={`#${selected.order_number ?? '—'} - ${kindLabel(selected.kind)}`}
              status={selected.status}
              description={selected.notes ?? null}
              chips={
                <>
                  <JobChip text={kindLabel(selected.kind)} />
                  <JobChip text={yyyyMmDd(selected.date)} muted />
                </>
              }
            />

            {selected.kind === 'regular' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>נקודות שירות</Text>
                <View style={{ gap: 10 }}>
                  {regularPoints.map((p) => {
                    const current = p.image_url ? getPublicUrl(p.image_url) : null;
                    return (
                      <Card key={p.id}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                          {p.sp?.device_type ?? p.service_point_id}
                        </Text>
                        <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                          ניחוח: {p.sp?.scent_type ?? '-'} • מילוי: {p.custom_refill_amount ?? p.sp?.refill_amount ?? '-'}
                        </Text>
                        <View style={{ marginTop: 10, gap: 10 }}>
                          {p.localImageUri ? (
                            <Image source={{ uri: p.localImageUri }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                          ) : current ? (
                            <Image source={{ uri: current }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                          ) : null}
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Button title="בחר תמונה" variant="secondary" onPress={() => pick((uri) => setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, localImageUri: uri } : x))))} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button title={p.uploading ? 'מעלה…' : 'העלה'} disabled={p.uploading} onPress={() => uploadRegularPoint(p)} />
                            </View>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </>
            ) : null}

            {selected.kind === 'installation' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>מכשירים</Text>
                <View style={{ gap: 10 }}>
                  {installationDevices.map((d) => {
                    const current = d.image_url ? getPublicUrl(d.image_url) : null;
                    return (
                      <Card key={d.id}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                          {d.device_name ?? 'Device'}
                        </Text>
                        <View style={{ marginTop: 10, gap: 10 }}>
                          {d.localImageUri ? (
                            <Image source={{ uri: d.localImageUri }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                          ) : current ? (
                            <Image source={{ uri: current }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                          ) : null}
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Button title="בחר תמונה" variant="secondary" onPress={() => pick((uri) => setInstallationDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, localImageUri: uri } : x))))} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button title={d.uploading ? 'מעלה…' : 'העלה'} disabled={d.uploading} onPress={() => uploadInstallationDevice(d)} />
                            </View>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </>
            ) : null}

            {selected.kind === 'special' && special ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>משימה מיוחדת</Text>
                <Card>
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{special.job_type ?? 'special'}</Text>
                  {special.battery_type ? <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>סוללה: {special.battery_type}</Text> : null}
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {special.localImageUri ? (
                      <Image source={{ uri: special.localImageUri }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                    ) : special.image_url ? (
                      <Image source={{ uri: getPublicUrl(special.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button title="בחר תמונה" variant="secondary" onPress={() => pick((uri) => setSpecial((p) => (p ? { ...p, localImageUri: uri } : p)))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title={special.uploading ? 'מעלה…' : 'העלה'} disabled={special.uploading} onPress={uploadSpecial} />
                      </View>
                    </View>
                  </View>
                </Card>
              </>
            ) : null}

            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>סיכומים</Text>
              <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
                ציוד להתקנה: {summaries.equipmentCount}{'\n'}
                סוללות: {summaries.batteries.map((b) => `${b.k}:${b.v}`).join(', ') || '—'}
              </Text>
              {summaries.scent.length ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  {summaries.scent.map((s) => (
                    <Text key={s.k} style={{ color: colors.muted, textAlign: 'right' }}>
                      {s.k}: {s.v}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>

            <Button title="סיים משימה" onPress={complete} />
            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  oilCard: {
    backgroundColor: '#232839',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  oilHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  oilTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  oilSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    textAlign: 'right',
    lineHeight: 18,
  },
  oilDonutInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  oilDonutValue: {
    color: '#4985E0',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  oilDivider: {
    height: 2,
    width: '58%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-14deg' }],
  },
  oilDonutMax: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  oilMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  oilMetaPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  oilMetaLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  oilMetaValue: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  oilBreakdownTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '900',
    textAlign: 'right',
  },
  oilBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  oilBreakdownKey: {
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '800',
    textAlign: 'right',
  },
  oilBreakdownValue: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '900',
    textAlign: 'left',
  },
});
