import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ModalSheet } from '../../components/ModalSheet';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { timeSlots, toDate, yyyyMmDd } from '../../lib/time';

type JobKind = 'regular' | 'installation' | 'special';
type JobStatus = 'pending' | 'completed';

type UserLite = { id: string; name: string; role: 'admin' | 'worker' | 'customer' };
type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };

type OneTimeCustomerPayload = { name: string; phone?: string; address?: string };

type SelectedPoint = {
  id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  selected: boolean;
  custom_refill_amount: string; // empty => none
};

type InstallationDeviceDraft = { device_name: string };

const SPECIAL_JOB_TYPES: { value: string; label: string; needsBattery?: boolean }[] = [
  { value: 'batteries', label: 'החלפת סוללות', needsBattery: true },
  { value: 'device_issue', label: 'תקלה במכשיר' },
  { value: 'customer_request', label: 'בקשת לקוח' },
  { value: 'other', label: 'אחר' },
];

const BATTERY_TYPES = [
  { value: 'AA', label: 'AA' },
  { value: 'DC', label: 'DC' },
];

function combineDateTimeToIso(dateYmd: string, timeHm: string): string {
  // local time -> ISO (UTC)
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
  return d.toISOString();
}

export function AddJobsScreen() {
  const { setIsLoading } = useLoading();
  const navigation = useNavigation<any>();

  const [kind, setKind] = useState<JobKind>('regular');
  const [status, setStatus] = useState<JobStatus>('pending');

  const [dateYmd, setDateYmd] = useState('');
  const [timeHm, setTimeHm] = useState('09:00');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [workerId, setWorkerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [useOneTimeCustomer, setUseOneTimeCustomer] = useState(false);
  const [oneTimeCustomer, setOneTimeCustomer] = useState<OneTimeCustomerPayload>({ name: '', phone: '', address: '' });

  const [notes, setNotes] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const [users, setUsers] = useState<UserLite[]>([]);
  const [servicePoints, setServicePoints] = useState<SelectedPoint[]>([]);

  const [specialJobType, setSpecialJobType] = useState<string>(SPECIAL_JOB_TYPES[0].value);
  const [batteryType, setBatteryType] = useState<string>('AA');

  const [installationDevices, setInstallationDevices] = useState<InstallationDeviceDraft[]>([{ device_name: '' }]);

  const workerOptions = useMemo(
    () => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name })),
    [users]
  );
  const customerOptions = useMemo(
    () => users.filter((u) => u.role === 'customer').map((u) => ({ value: u.id, label: u.name })),
    [users]
  );

  const specialTypeMeta = useMemo(() => SPECIAL_JOB_TYPES.find((t) => t.value === specialJobType), [specialJobType]);

  const timeOptions = useMemo(() => timeSlots({ startHm: '08:00', endHm: '20:00', stepMinutes: 30 }).map((t) => ({ value: t, label: t })), []);
  const dateOptions = useMemo(() => {
    const base = new Date();
    const list: { value: string; label: string }[] = [];
    for (let i = 0; i <= 180; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const ymd = yyyyMmDd(d);
      list.push({ value: ymd, label: ymd });
    }
    return list;
  }, []);
  const dateValue = useMemo(() => {
    if (!dateYmd) return new Date();
    const d = toDate(dateYmd);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [dateYmd]);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('id, name, role').order('name', { ascending: true });
    if (!error) setUsers((data ?? []) as UserLite[]);
  }, []);

  const fetchServicePoints = async (custId: string) => {
    const { data, error } = await supabase
      .from('service_points')
      .select('id, device_type, scent_type, refill_amount')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as ServicePoint[];
    setServicePoints(
      list.map((sp) => ({
        ...sp,
        selected: true,
        custom_refill_amount: '',
      }))
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  useEffect(() => {
    if (!customerId || useOneTimeCustomer || kind !== 'regular') {
      setServicePoints([]);
      return;
    }
    fetchServicePoints(customerId).catch((e: any) => {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
      setServicePoints([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, useOneTimeCustomer, kind]);

  const validateCommon = () => {
    if (!dateYmd.trim()) throw new Error('חסר תאריך (yyyy-MM-dd)');
    if (!timeHm.trim()) throw new Error('חסרה שעה (HH:mm)');
    if (!workerId) throw new Error('חסר עובד');
    if (kind !== 'special') {
      if (useOneTimeCustomer) {
        if (!oneTimeCustomer.name.trim()) throw new Error('חסר שם לקוח חד-פעמי');
      } else {
        if (!customerId) throw new Error('חסר לקוח');
      }
    }
  };

  const createOneTimeCustomerIfNeeded = async (): Promise<string | null> => {
    if (kind === 'special') return null;
    if (!useOneTimeCustomer) return null;
    const payload = {
      name: oneTimeCustomer.name.trim(),
      phone: oneTimeCustomer.phone?.trim() || null,
      address: oneTimeCustomer.address?.trim() || null,
    };
    const { data, error } = await supabase.from('one_time_customers').insert(payload).select('id').single();
    if (error) throw error;
    return (data as any).id as string;
  };

  const submit = async () => {
    try {
      validateCommon();
      setIsLoading(true);

      const dateIso = combineDateTimeToIso(dateYmd.trim(), timeHm.trim());
      const oneTimeId = await createOneTimeCustomerIfNeeded();

      const common = {
        worker_id: workerId,
        date: dateIso,
        status,
        notes: notes.trim() || null,
        order_number: orderNumber ? Number(orderNumber) : null,
      };
      const customerFields =
        kind === 'special'
          ? {}
          : {
              customer_id: useOneTimeCustomer ? null : customerId,
              one_time_customer_id: useOneTimeCustomer ? oneTimeId : null,
            };

      if (kind === 'regular') {
        const selected = servicePoints.filter((p) => p.selected);
        if (!selected.length) throw new Error('בחר לפחות נקודת שירות אחת');

        const { data: job, error: jobErr } = await supabase.from('jobs').insert({ ...common, ...customerFields }).select('id').single();
        if (jobErr) throw jobErr;
        const jobId = (job as any).id as string;

        const jspRows = selected.map((p) => {
          const custom = p.custom_refill_amount ? Number(p.custom_refill_amount) : null;
          const differs = custom != null && custom !== p.refill_amount;
          return {
            job_id: jobId,
            service_point_id: p.id,
            custom_refill_amount: differs ? custom : null,
          };
        });

        const { error: jspErr } = await supabase.from('job_service_points').insert(jspRows);
        if (jspErr) throw jspErr;

        Toast.show({ type: 'success', text1: 'נוצרה משימה רגילה' });
      }

      if (kind === 'installation') {
        const { data: inst, error: instErr } = await supabase.from('installation_jobs').insert({ ...common, ...customerFields }).select('id').single();
        if (instErr) throw instErr;
        const instId = (inst as any).id as string;

        const devices = installationDevices.map((d) => d.device_name.trim()).filter(Boolean);
        if (!devices.length) throw new Error('הוסף לפחות מכשיר אחד');
        const rows = devices.map((name) => ({ installation_job_id: instId, device_name: name }));
        const { error: devErr } = await supabase.from('installation_devices').insert(rows);
        if (devErr) throw devErr;

        Toast.show({ type: 'success', text1: 'נוצרה משימת התקנה' });
      }

      if (kind === 'special') {
        const meta = specialTypeMeta;
        const payload: any = {
          ...common,
          job_type: specialJobType,
          battery_type: meta?.needsBattery ? batteryType : null,
        };
        const { error } = await supabase.from('special_jobs').insert(payload);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'נוצרה משימה מיוחדת' });
      }

      // reset minimal fields
      setNotes('');
      setOrderNumber('');

      // UX: go back to Jobs list after create
      navigation.navigate('Jobs');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'יצירה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title="צור" fullWidth={false} onPress={submit} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>הוספת משימות</Text>
        </View>

        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>בסיס</Text>
          <View style={{ gap: 10 }}>
            <SelectSheet
              label="סוג משימה"
              value={kind}
              options={[
                { value: 'regular', label: 'regular (ריח)' },
                { value: 'installation', label: 'installation' },
                { value: 'special', label: 'special' },
              ]}
              onChange={(v) => setKind(v as JobKind)}
            />
            <SelectSheet
              label="סטטוס"
              value={status}
              options={[
                { value: 'pending', label: 'pending' },
                { value: 'completed', label: 'completed' },
              ]}
              onChange={(v) => setStatus(v as JobStatus)}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                {Platform.OS === 'web' ? (
                  <SelectSheet
                    label="תאריך"
                    value={dateYmd}
                    placeholder="בחר תאריך…"
                    options={dateOptions}
                    onChange={setDateYmd}
                  />
                ) : (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>תאריך</Text>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'android') {
                          DateTimePickerAndroid.open({
                            value: dateValue,
                            mode: 'date',
                            is24Hour: true,
                            onChange: (_event, selectedDate) => {
                              if (!selectedDate) return;
                              setDateYmd(yyyyMmDd(selectedDate));
                            },
                          });
                          return;
                        }
                        setDatePickerOpen(true);
                      }}
                      style={{
                        backgroundColor: colors.elevated,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <CalendarDays size={18} color={colors.muted} />
                      <Text style={{ color: dateYmd ? colors.text : colors.muted, fontWeight: '800', flex: 1, textAlign: 'right' }}>
                        {dateYmd ? dateYmd : 'בחר תאריך…'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <SelectSheet
                  label="שעה"
                  value={timeHm}
                  placeholder="בחר שעה…"
                  options={timeOptions}
                  onChange={setTimeHm}
                />
              </View>
            </View>

            <SelectSheet
              label="עובד"
              value={workerId}
              placeholder="בחר עובד…"
              options={workerOptions}
              onChange={setWorkerId}
            />

            <Pressable
              onPress={() => setUseOneTimeCustomer((p) => !p)}
              disabled={kind === 'special'}
              style={{
                backgroundColor: kind === 'special' ? colors.border : useOneTimeCustomer ? colors.primary : colors.elevated,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'right' }}>
                {kind === 'special' ? 'לקוח חד-פעמי: לא רלוונטי ל-special' : useOneTimeCustomer ? 'לקוח חד-פעמי: פעיל' : 'לקוח חד-פעמי: כבוי'}
              </Text>
            </Pressable>

            {kind === 'special' ? null : useOneTimeCustomer ? (
              <View style={{ gap: 10 }}>
                <Input label="שם" value={oneTimeCustomer.name} onChangeText={(v) => setOneTimeCustomer((p) => ({ ...p, name: v }))} />
                <Input
                  label="טלפון"
                  value={oneTimeCustomer.phone ?? ''}
                  onChangeText={(v) => setOneTimeCustomer((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />
                <Input label="כתובת" value={oneTimeCustomer.address ?? ''} onChangeText={(v) => setOneTimeCustomer((p) => ({ ...p, address: v }))} />
              </View>
            ) : (
              <SelectSheet
                label="לקוח"
                value={customerId}
                placeholder="בחר לקוח…"
                options={customerOptions}
                onChange={setCustomerId}
              />
            )}

            <Input label="מספר הזמנה (אופציונלי)" value={orderNumber} onChangeText={setOrderNumber} keyboardType="numeric" />
            <Input label="הערות (אופציונלי)" value={notes} onChangeText={setNotes} />
          </View>
        </Card>

        {kind === 'regular' ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>נקודות שירות</Text>
            {!customerId && !useOneTimeCustomer ? (
              <Text style={{ color: colors.muted, textAlign: 'right' }}>בחר לקוח כדי לטעון נקודות שירות.</Text>
            ) : useOneTimeCustomer ? (
              <Text style={{ color: colors.muted, textAlign: 'right' }}>לקוח חד-פעמי לא כולל נקודות שירות קבועות.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {servicePoints.map((p) => (
                  <View key={p.id} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Pressable
                      onPress={() => setServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, selected: !x.selected } : x)))}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ color: p.selected ? colors.success : colors.muted, fontWeight: '900' }}>
                        {p.selected ? 'נבחר' : 'לא נבחר'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{p.device_type}</Text>
                        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>
                          ניחוח: {p.scent_type} • ברירת מחדל: {p.refill_amount}
                        </Text>
                      </View>
                    </Pressable>
                    {p.selected ? (
                      <Input
                        label="כמות מילוי מותאמת (אופציונלי)"
                        value={p.custom_refill_amount}
                        onChangeText={(v) =>
                          setServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, custom_refill_amount: v } : x)))
                        }
                        keyboardType="numeric"
                        placeholder={String(p.refill_amount)}
                      />
                    ) : null}
                  </View>
                ))}
                {!servicePoints.length ? (
                  <Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות ללקוח.</Text>
                ) : null}
              </View>
            )}
          </Card>
        ) : null}

        {kind === 'installation' ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>מכשירים להתקנה</Text>
            <View style={{ gap: 10 }}>
              {installationDevices.map((d, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label={`מכשיר #${idx + 1}`}
                      value={d.device_name}
                      onChangeText={(v) =>
                        setInstallationDevices((prev) => prev.map((x, i) => (i === idx ? { ...x, device_name: v } : x)))
                      }
                      placeholder="Device name"
                    />
                  </View>
                  <Pressable
                    onPress={() => setInstallationDevices((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={installationDevices.length <= 1}
                    style={{
                      backgroundColor: installationDevices.length <= 1 ? colors.border : colors.danger,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900' }}>מחק</Text>
                  </Pressable>
                </View>
              ))}
              <Button
                title="הוסף מכשיר"
                variant="secondary"
                onPress={() => setInstallationDevices((prev) => [...prev, { device_name: '' }])}
              />
            </View>
          </Card>
        ) : null}

        {kind === 'special' ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>משימה מיוחדת</Text>
            <View style={{ gap: 10 }}>
              <SelectSheet
                label="סוג מיוחד"
                value={specialJobType}
                options={SPECIAL_JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                onChange={setSpecialJobType}
              />
              {specialTypeMeta?.needsBattery ? (
                <SelectSheet label="סוג סוללה" value={batteryType} options={BATTERY_TYPES} onChange={setBatteryType} />
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <ModalSheet visible={datePickerOpen} onClose={() => setDatePickerOpen(false)}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button title="סגור" variant="secondary" fullWidth={false} onPress={() => setDatePickerOpen(false)} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>בחירת תאריך</Text>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10 }}>
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="inline"
              themeVariant="light"
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                setDateYmd(yyyyMmDd(selectedDate));
              }}
            />
          </View>

          {!!dateYmd && (
            <Button
              title="אישור"
              onPress={() => {
                setDatePickerOpen(false);
              }}
            />
          )}
        </View>
      </ModalSheet>
    </Screen>
  );
}

