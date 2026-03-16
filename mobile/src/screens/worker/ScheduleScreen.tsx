import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { uploadCompressedImage, getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { yyyyMmDd } from '../../lib/time';
import { useAuth } from '../../state/AuthContext';
import { useLoading } from '../../state/LoadingContext';

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

export function WorkerScheduleScreen() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const [date, setDate] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Unified | null>(null);
  const [regularPoints, setRegularPoints] = useState<(JobServicePoint & { sp?: ServicePoint | null; localImageUri?: string | null; uploading?: boolean })[]>([]);
  const [installationDevices, setInstallationDevices] = useState<(InstallationDevice & { localImageUri?: string | null; uploading?: boolean })[]>([]);
  const [special, setSpecial] = useState<(SpecialJob & { localImageUri?: string | null; uploading?: boolean }) | null>(null);

  const filtered = useMemo(() => {
    return items.filter((it) => (kindFilter ? it.kind === kindFilter : true));
  }, [items, kindFilter]);

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
      setItems([...regs, ...insts, ...specs].sort((a, b) => (a.date < b.date ? -1 : 1)));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'אין הרשאה לגלריה' });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
    if (res.canceled) return;
    const uri = res.assets[0]?.uri;
    if (uri) onPicked(uri);
  };

  const uploadRegularPoint = async (p: (typeof regularPoints)[number]) => {
    if (!selected) return;
    if (!p.localImageUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = `${selected.id}/${p.service_point_id}-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: p.localImageUri, path: storagePath });
      const { error } = await supabase.from('job_service_points').update({ image_url: storagePath }).eq('id', p.id);
      if (error) throw error;
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
      const storagePath = `${selected.id}/${d.id}-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: d.localImageUri, path: storagePath });
      const { error } = await supabase.from('installation_devices').update({ image_url: storagePath }).eq('id', d.id);
      if (error) throw error;
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
      const storagePath = `${selected.id}/special-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: special.localImageUri, path: storagePath });
      const { error } = await supabase.from('special_jobs').update({ image_url: storagePath }).eq('id', special.id);
      if (error) throw error;
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
      if (selected.kind === 'regular') {
        const { error } = await supabase.from('jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      } else if (selected.kind === 'installation') {
        const { error } = await supabase.from('installation_jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('special_jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      }
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
    <Screen>
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

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                {item.kind} • #{item.order_number ?? '—'}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{item.date}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'right', marginTop: 16 }}>אין משימות.</Text>}
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              {selected.kind} • #{selected.order_number ?? '—'}
            </Text>

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

