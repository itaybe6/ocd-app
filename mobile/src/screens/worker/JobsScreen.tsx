import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { uploadCompressedImage, getPublicUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { useLoading } from '../../state/LoadingContext';
import { pickImageFromLibrary } from '../../lib/media';

type Kind = 'regular' | 'installation' | 'special';
type Status = 'pending' | 'completed';

type Unified = {
  kind: Kind;
  id: string;
  date: string;
  status: Status;
  order_number?: number | null;
};

type JobServicePoint = { id: string; job_id: string; service_point_id: string; image_url?: string | null };
type InstallationDevice = { id: string; installation_job_id: string; device_name?: string | null; image_url?: string | null };
type SpecialJob = { id: string; image_url?: string | null };

type ExecRegularPoint = JobServicePoint & { localUri?: string | null; uploading?: boolean };
type ExecInstDevice = InstallationDevice & { localUri?: string | null; uploading?: boolean };
type ExecSpecial = SpecialJob & { localUri?: string | null; uploading?: boolean };

export function WorkerJobsScreen() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [items, setItems] = useState<Unified[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Unified | null>(null);
  const [regularImages, setRegularImages] = useState<string[]>([]);
  const [instDevices, setInstDevices] = useState<ExecInstDevice[]>([]);
  const [special, setSpecial] = useState<ExecSpecial | null>(null);
  const [execRegularPoints, setExecRegularPoints] = useState<ExecRegularPoint[]>([]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter && it.kind !== kindFilter) return false;
      if (statusFilter && it.status !== statusFilter) return false;
      if (!qq) return true;
      return it.id.toLowerCase().includes(qq) || String(it.order_number ?? '').includes(qq);
    });
  }, [items, q, kindFilter, statusFilter]);

  const fetchAll = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [regRes, instRes, specRes] = await Promise.all([
        supabase.from('jobs').select('id, date, status, order_number').eq('worker_id', user.id),
        supabase.from('installation_jobs').select('id, date, status, order_number').eq('worker_id', user.id),
        supabase.from('special_jobs').select('id, date, status, order_number').eq('worker_id', user.id),
      ]);
      if (regRes.error) throw regRes.error;
      if (instRes.error) throw instRes.error;
      if (specRes.error) throw specRes.error;
      const regs = (regRes.data ?? []).map((r: any) => ({ kind: 'regular', ...r }) as Unified);
      const insts = (instRes.data ?? []).map((r: any) => ({ kind: 'installation', ...r }) as Unified);
      const specs = (specRes.data ?? []).map((r: any) => ({ kind: 'special', ...r }) as Unified);
      setItems([...regs, ...insts, ...specs].sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const open = async (it: Unified) => {
    setSelected(it);
    setRegularImages([]);
    setInstDevices([]);
    setSpecial(null);
    setExecRegularPoints([]);
    try {
      if (it.kind === 'regular') {
        const { data, error } = await supabase.from('job_service_points').select('id, job_id, service_point_id, image_url').eq('job_id', it.id);
        if (error) throw error;
        const urls = ((data ?? []) as JobServicePoint[]).map((r) => r.image_url).filter(Boolean).map((p) => getPublicUrl(p!));
        setRegularImages(urls);
        setExecRegularPoints(((data ?? []) as JobServicePoint[]).map((r) => ({ ...r })));
      }
      if (it.kind === 'installation') {
        const { data, error } = await supabase.from('installation_devices').select('id, installation_job_id, device_name, image_url').eq('installation_job_id', it.id);
        if (error) throw error;
        setInstDevices(((data ?? []) as InstallationDevice[]).map((d) => ({ ...d })));
      }
      if (it.kind === 'special') {
        const { data, error } = await supabase.from('special_jobs').select('id, image_url').eq('id', it.id).single();
        if (error) throw error;
        setSpecial(data as any);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פרטים נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const pick = pickImageFromLibrary;

  const complete = async () => {
    if (!selected) return;
    try {
      setIsLoading(true);
      if (selected.kind === 'regular') {
        const { error } = await supabase.from('jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      } else if (selected.kind === 'special') {
        const { error } = await supabase.from('special_jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('installation_jobs').update({ status: 'completed' }).eq('id', selected.id);
        if (error) throw error;
      }
      setItems((prev) => prev.map((x) => (x.id === selected.id && x.kind === selected.kind ? { ...x, status: 'completed' } : x)));
      Toast.show({ type: 'success', text1: 'הושלם' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'סיום נכשל', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const uploadSpecialImage = async () => {
    if (!selected || selected.kind !== 'special') return;
    const uri = await pick();
    if (!uri) return;
    try {
      setIsLoading(true);
      const storagePath = `${selected.id}/special-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: uri, path: storagePath });
      const { error } = await supabase.from('special_jobs').update({ image_url: storagePath }).eq('id', selected.id);
      if (error) throw error;
      setSpecial({ id: selected.id, image_url: storagePath, localUri: null, uploading: false });
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const uploadRegularPoint = async (p: ExecRegularPoint) => {
    if (!selected || selected.kind !== 'regular') return;
    if (!p.localUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setExecRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: true } : x)));
      const storagePath = `${selected.id}/${p.service_point_id}-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: p.localUri, path: storagePath });
      const { error } = await supabase.from('job_service_points').update({ image_url: storagePath }).eq('id', p.id);
      if (error) throw error;
      setExecRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      setRegularImages((prev) => Array.from(new Set([...prev, getPublicUrl(storagePath)])));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setExecRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  const uploadInstallationDevice = async (d: ExecInstDevice) => {
    if (!selected || selected.kind !== 'installation') return;
    if (!d.localUri) return Toast.show({ type: 'error', text1: 'בחר תמונה קודם' });
    try {
      setInstDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: true } : x)));
      const storagePath = `${selected.id}/${d.id}-${Date.now()}.jpg`;
      await uploadCompressedImage({ localUri: d.localUri, path: storagePath });
      const { error } = await supabase.from('installation_devices').update({ image_url: storagePath }).eq('id', d.id);
      if (error) throw error;
      setInstDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, image_url: storagePath, uploading: false } : x)));
      Toast.show({ type: 'success', text1: 'הועלה' });
    } catch (e: any) {
      setInstDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: false } : x)));
      Toast.show({ type: 'error', text1: 'העלאה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchAll} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>היסטוריית משימות</Text>
        </View>
        <Input label="חיפוש (id / מספר הזמנה)" value={q} onChangeText={setQ} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
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
          <View style={{ flex: 1 }}>
            <SelectSheet
              label="סטטוס"
              value={statusFilter}
              placeholder="הכל"
              options={[
                { value: '', label: 'הכל' },
                { value: 'pending', label: 'pending' },
                { value: 'completed', label: 'completed' },
              ]}
              onChange={(v) => setStatusFilter((v || '') as any)}
            />
          </View>
        </View>
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
                {item.kind} • #{item.order_number ?? '—'} • {item.status}
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
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונות</Text>
                {regularImages.length ? (
                  <View style={{ gap: 10 }}>
                    {regularImages.map((u) => (
                      <Card key={u}>
                        <Image source={{ uri: u }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונות.</Text>
                )}

                {selected.status === 'pending' ? (
                  <>
                    <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>ביצוע (העלאת תמונות)</Text>
                    <View style={{ gap: 10 }}>
                      {execRegularPoints.map((p) => (
                        <Card key={p.id}>
                          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>
                            נקודה: {p.service_point_id.slice(0, 6)}
                          </Text>
                          {p.image_url ? (
                            <Image source={{ uri: getPublicUrl(p.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }} />
                          ) : p.localUri ? (
                            <Image source={{ uri: p.localUri }} style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }} />
                          ) : null}
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="בחר תמונה"
                                variant="secondary"
                                onPress={async () => {
                                  const uri = await pick();
                                  if (!uri) return;
                                  setExecRegularPoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, localUri: uri } : x)));
                                }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button title={p.uploading ? 'מעלה…' : 'העלה'} disabled={p.uploading} onPress={() => uploadRegularPoint(p)} />
                            </View>
                          </View>
                        </Card>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            ) : null}

            {selected.kind === 'installation' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>מכשירים</Text>
                {instDevices.length ? (
                  <View style={{ gap: 10 }}>
                    {instDevices.map((d) => (
                      <Card key={d.id}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{d.device_name ?? 'Device'}</Text>
                        {d.image_url ? (
                          <Image source={{ uri: getPublicUrl(d.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }} />
                        ) : d.localUri ? (
                          <Image source={{ uri: d.localUri }} style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 10 }} />
                        ) : null}

                        {selected.status === 'pending' ? (
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="בחר תמונה"
                                variant="secondary"
                                onPress={async () => {
                                  const uri = await pick();
                                  if (!uri) return;
                                  setInstDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, localUri: uri } : x)));
                                }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button title={d.uploading ? 'מעלה…' : 'העלה'} disabled={d.uploading} onPress={() => uploadInstallationDevice(d)} />
                            </View>
                          </View>
                        ) : null}
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין מכשירים.</Text>
                )}
              </>
            ) : null}

            {selected.kind === 'special' ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>תמונה</Text>
                {special?.image_url ? (
                  <Card>
                    <Image source={{ uri: getPublicUrl(special.image_url) }} style={{ width: '100%', height: 180, borderRadius: 14 }} />
                  </Card>
                ) : (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין תמונה.</Text>
                )}
                {selected.status === 'pending' ? <Button title="העלה/עדכן תמונה" onPress={uploadSpecialImage} /> : null}
              </>
            ) : null}

            {selected.status === 'pending' ? <Button title="בצע סיום (pending→completed)" onPress={complete} /> : null}
            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

