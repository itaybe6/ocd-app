import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { CalendarDays, X } from 'lucide-react-native';
import { format, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../ui/Card';
import { HebrewMonthCalendar } from '../HebrewMonthCalendar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ModalSheet } from '../ModalSheet';
import { SelectSheet } from '../ui/SelectSheet';
import { flushScheduledPushJobs } from '../../lib/pushAdmin';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useLoading } from '../../state/LoadingContext';

const { height: screenHeight } = Dimensions.get('window');

function formatHebrewJobDateLabel(ymd: string): string {
  const [yy, mm, dd] = ymd.slice(0, 10).split('-').map((x) => Number(x));
  if (!yy || !mm || !dd) return ymd;
  const d = new Date(yy, mm - 1, dd);
  return isValid(d) ? format(d, 'EEEE, d MMMM yyyy', { locale: he }) : ymd;
}

type JobKind = 'regular' | 'installation' | 'special';

export type AdminCreateJobSheetUser = {
  id: string;
  name: string;
  role: 'admin' | 'worker' | 'customer';
  avatar_url?: string | null;
};

type ServicePoint = { id: string; device_type: string; scent_type: string; refill_amount: number };
type CreateSelectedPoint = ServicePoint & { selected: boolean; custom_refill_amount: string };
type InstallationDeviceDraft = { device_name: string };
type DeviceCatalogRow = { id: string; name: string; refill_amount: number };

type OneTimeCustomerPayload = { name: string; phone?: string; address?: string };

export const ADMIN_SPECIAL_JOB_TYPES: { value: string; label: string; needsBattery?: boolean }[] = [
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
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(d.getTime())) throw new Error('תאריך/שעה לא תקינים');
  return d.toISOString();
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  initialDateYmd: string;
  users: AdminCreateJobSheetUser[];
};

export function AdminCreateJobSheet({ visible, onClose, onCreated, initialDateYmd, users }: Props) {
  const insets = useSafeAreaInsets();
  const { setIsLoading } = useLoading();

  const [createKind, setCreateKind] = useState<JobKind>('regular');
  const [createDateYmd, setCreateDateYmd] = useState('');
  const [createDatePickerOpen, setCreateDatePickerOpen] = useState(false);

  const [createWorkerId, setCreateWorkerId] = useState('');
  const [createCustomerId, setCreateCustomerId] = useState('');
  const [createUseOneTimeCustomer, setCreateUseOneTimeCustomer] = useState(false);
  const [createOneTimeCustomer, setCreateOneTimeCustomer] = useState<OneTimeCustomerPayload>({ name: '', phone: '', address: '' });

  const [createNotes, setCreateNotes] = useState('');

  const [createServicePoints, setCreateServicePoints] = useState<CreateSelectedPoint[]>([]);

  const [createSpecialJobType, setCreateSpecialJobType] = useState<string>(ADMIN_SPECIAL_JOB_TYPES[0].value);
  const [createBatteryType, setCreateBatteryType] = useState<string>('AA');
  const [createInstallationDevices, setCreateInstallationDevices] = useState<InstallationDeviceDraft[]>([{ device_name: '' }]);
  const [installationCatalogDevices, setInstallationCatalogDevices] = useState<DeviceCatalogRow[]>([]);
  const [installationCatalogLoading, setInstallationCatalogLoading] = useState(false);

  useEffect(() => {
    if (visible) setCreateDateYmd(initialDateYmd);
  }, [visible, initialDateYmd]);

  const createWorkerOptions = useMemo(
    () => users.filter((u) => u.role === 'worker').map((u) => ({ value: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
    [users],
  );
  const createCustomerOptions = useMemo(
    () => users.filter((u) => u.role === 'customer').map((u) => ({ value: u.id, label: u.name, avatarUrl: u.avatar_url ?? null })),
    [users],
  );

  const createSpecialTypeMeta = useMemo(
    () => ADMIN_SPECIAL_JOB_TYPES.find((t) => t.value === createSpecialJobType) ?? null,
    [createSpecialJobType],
  );

  const fetchCreateServicePoints = useCallback(async (custId: string) => {
    const { data, error } = await supabase
      .from('service_points')
      .select('id, device_type, scent_type, refill_amount')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = (data ?? []) as ServicePoint[];
    setCreateServicePoints(
      list.map((sp) => ({
        ...sp,
        selected: true,
        custom_refill_amount: '',
      })),
    );
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!createCustomerId || createUseOneTimeCustomer || createKind !== 'regular') {
      setCreateServicePoints([]);
      return;
    }
    fetchCreateServicePoints(createCustomerId).catch((e: any) => {
      Toast.show({ type: 'error', text1: 'טעינת נקודות שירות נכשלה', text2: e?.message ?? 'Unknown error' });
      setCreateServicePoints([]);
    });
  }, [createCustomerId, createUseOneTimeCustomer, createKind, visible, fetchCreateServicePoints]);

  useEffect(() => {
    if (!visible || createKind !== 'installation') return;
    let cancelled = false;
    (async () => {
      try {
        setInstallationCatalogLoading(true);
        const { data, error } = await supabase.from('devices').select('id, name, refill_amount').order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setInstallationCatalogDevices((data ?? []) as DeviceCatalogRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setInstallationCatalogDevices([]);
          Toast.show({ type: 'error', text1: 'טעינת מכשירים נכשלה', text2: e?.message ?? 'Unknown error' });
        }
      } finally {
        if (!cancelled) setInstallationCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, createKind]);

  const installationDeviceSelectOptions = useMemo(
    () =>
      installationCatalogDevices.map((d) => ({
        value: d.name,
        label: `${d.name} · מילוי ${d.refill_amount}`,
      })),
    [installationCatalogDevices],
  );

  const resetCreateFormMinimal = () => {
    setCreateNotes('');
    setCreateInstallationDevices([{ device_name: '' }]);
  };

  const validateCreateCommon = () => {
    if (!createDateYmd.trim()) throw new Error('חסר תאריך (yyyy-MM-dd)');
    if (!createWorkerId) throw new Error('חסר עובד');
    if (createKind === 'special') {
      if (createUseOneTimeCustomer && !createOneTimeCustomer.name.trim()) {
        throw new Error('חסר שם לקוח חד-פעמי');
      }
      return;
    }
    if (createUseOneTimeCustomer) {
      if (!createOneTimeCustomer.name.trim()) throw new Error('חסר שם לקוח חד-פעמי');
    } else {
      if (!createCustomerId) throw new Error('חסר לקוח');
    }
  };

  const createOneTimeCustomerIfNeeded = async (): Promise<string | null> => {
    if (!createUseOneTimeCustomer) return null;
    const payload = {
      name: createOneTimeCustomer.name.trim(),
      phone: createOneTimeCustomer.phone?.trim() || null,
      address: createOneTimeCustomer.address?.trim() || null,
    };
    const { data, error } = await supabase.from('one_time_customers').insert(payload).select('id').single();
    if (error) throw error;
    return (data as any).id as string;
  };

  const submitCreate = async () => {
    try {
      validateCreateCommon();
      setIsLoading(true);
      if (__DEV__) console.log('[AdminCreateJob] submitCreate start', { kind: createKind, dateYmd: createDateYmd.trim() });

      const dateIso = combineDateTimeToIso(createDateYmd.trim(), '09:00');
      const oneTimeId = await createOneTimeCustomerIfNeeded();

      const omitOrderNotesForOneTime = createKind !== 'special' && createUseOneTimeCustomer;

      const common: any = {
        worker_id: createWorkerId,
        date: dateIso,
        status: 'pending' as const,
        notes: omitOrderNotesForOneTime ? null : createNotes.trim() || null,
        order_number: null,
      };

      const customerFields = {
        customer_id: createUseOneTimeCustomer ? null : createCustomerId || null,
        one_time_customer_id: createUseOneTimeCustomer ? oneTimeId : null,
      };

      if (createKind === 'regular') {
        const selected = createServicePoints.filter((p) => p.selected);
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

        Toast.show({ type: 'success', text1: 'נוצרה משימת ריח' });
      }

      if (createKind === 'installation') {
        const deviceNames = createInstallationDevices.map((d) => d.device_name.trim()).filter(Boolean);
        if (!deviceNames.length) throw new Error('בחר לפחות מכשיר אחד מהרשימה');
        const jobDeviceType = deviceNames[0];

        const installationJobPayload = {
          ...common,
          ...customerFields,
          device_type: jobDeviceType,
        };
        if (__DEV__) console.log('[AdminCreateJob] installation_jobs.insert payload', installationJobPayload);

        const { data: inst, error: instErr } = await supabase
          .from('installation_jobs')
          .insert(installationJobPayload)
          .select('id')
          .single();

        if (instErr) {
          console.error('[AdminCreateJob] installation_jobs insert failed', {
            message: instErr.message,
            code: instErr.code,
            details: instErr.details,
            hint: instErr.hint,
          });
          throw instErr;
        }
        const instId = (inst as any).id as string;
        if (__DEV__) console.log('[AdminCreateJob] installation_jobs created id', instId);

        /** DB columns: `installation_job_id`, `device_type`, `image_url` — no `device_name`. */
        const rows = deviceNames.map((name) => ({
          installation_job_id: instId,
          device_type: name,
        }));
        if (__DEV__) console.log('[AdminCreateJob] installation_devices.insert rows', rows);

        const { error: devErr } = await supabase.from('installation_devices').insert(rows).select('id');
        if (devErr) {
          console.error('[AdminCreateJob] installation_devices insert failed', {
            message: devErr.message,
            code: devErr.code,
            details: devErr.details,
            hint: devErr.hint,
            rows,
          });
          throw devErr;
        }

        Toast.show({ type: 'success', text1: 'נוצרה משימת התקנה' });
      }

      if (createKind === 'special') {
        const meta = createSpecialTypeMeta;
        const payload: any = {
          ...common,
          ...customerFields,
          job_type: createSpecialJobType,
          battery_type: meta?.needsBattery ? createBatteryType : null,
        };
        const { error } = await supabase.from('special_jobs').insert(payload);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'נוצרה משימה מיוחדת' });
      }

      resetCreateFormMinimal();
      onClose();
      await onCreated();
      try {
        await flushScheduledPushJobs();
      } catch {
        /* queued in DB */
      }
    } catch (e: any) {
      console.error('[AdminCreateJob] submitCreate failed', {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
      }, e);
      Toast.show({ type: 'error', text1: 'יצירה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setCreateDatePickerOpen(false);
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={handleClose}
      containerStyle={{
        paddingTop: 4,
        paddingBottom: 0,
        paddingHorizontal: 14,
        maxHeight: screenHeight * 0.92,
      }}
    >
      <KeyboardAvoidingView
        style={{ height: Math.min(screenHeight * 0.86, screenHeight - insets.top - 8) }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 6,
            paddingBottom: 10,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="סגור" hitSlop={14} onPress={handleClose}>
            {({ pressed }) => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={22} color={colors.text} strokeWidth={2.5} />
              </View>
            )}
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right', flex: 1 }} numberOfLines={1}>
            הוספת משימה
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
        >
          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>בסיס</Text>
            <View style={{ gap: 10 }}>
              <SelectSheet
                label="סוג משימה"
                value={createKind}
                options={[
                  { value: 'regular', label: 'ריח' },
                  { value: 'installation', label: 'התקנה' },
                  { value: 'special', label: 'מיוחדת' },
                ]}
                onChange={(v) => setCreateKind(v as JobKind)}
              />

              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>תאריך (שעה: 09:00)</Text>
                  <Pressable
                    onPress={() => setCreateDatePickerOpen((o) => !o)}
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
                    <Text
                      style={{ color: createDateYmd ? colors.text : colors.muted, fontWeight: '800', flex: 1, textAlign: 'right' }}
                      numberOfLines={2}
                    >
                      {createDateYmd ? formatHebrewJobDateLabel(createDateYmd) : 'בחר תאריך…'}
                    </Text>
                  </Pressable>
                </View>
                {createDatePickerOpen ? (
                  <View style={{ width: '100%', alignSelf: 'stretch', gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'right', lineHeight: 18 }}>
                      לוח מלא · לחיצה על יום לבחירה · החלקה לצדדים לחודש אחר
                    </Text>
                    <HebrewMonthCalendar
                      selected={createDateYmd}
                      onSelect={(ymd) => {
                        setCreateDateYmd(ymd);
                        setCreateDatePickerOpen(false);
                      }}
                    />
                  </View>
                ) : null}
              </View>

              <SelectSheet
                label="עובד"
                value={createWorkerId}
                placeholder="בחר עובד…"
                options={createWorkerOptions}
                onChange={setCreateWorkerId}
              />

              <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, textAlign: 'right', fontSize: 12, fontWeight: '700' }}>
                    לקוח{createKind === 'special' ? ' (אופציונלי)' : ''}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      backgroundColor: colors.elevated,
                      borderRadius: 14,
                      padding: 4,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 4,
                    }}
                  >
                    <Pressable onPress={() => setCreateUseOneTimeCustomer(false)} style={{ flex: 1 }}>
                      {({ pressed }) => (
                        <View
                          style={{
                            borderRadius: 11,
                            paddingVertical: 11,
                            paddingHorizontal: 8,
                            backgroundColor: !createUseOneTimeCustomer ? colors.card : 'transparent',
                            borderWidth: !createUseOneTimeCustomer ? 1.5 : 0,
                            borderColor: !createUseOneTimeCustomer ? colors.primary : 'transparent',
                            opacity: pressed ? 0.88 : 1,
                            ...(Platform.OS === 'ios' && !createUseOneTimeCustomer
                              ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
                              : {}),
                            ...(!createUseOneTimeCustomer && Platform.OS === 'android' ? { elevation: 1 } : {}),
                          }}
                        >
                          <Text
                            style={{
                              textAlign: 'center',
                              fontWeight: '900',
                              fontSize: 14,
                              color: !createUseOneTimeCustomer ? colors.primary : colors.muted,
                            }}
                            numberOfLines={1}
                          >
                            לקוח קיים
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    <Pressable onPress={() => setCreateUseOneTimeCustomer(true)} style={{ flex: 1 }}>
                      {({ pressed }) => (
                        <View
                          style={{
                            borderRadius: 11,
                            paddingVertical: 11,
                            paddingHorizontal: 8,
                            backgroundColor: createUseOneTimeCustomer ? colors.card : 'transparent',
                            borderWidth: createUseOneTimeCustomer ? 1.5 : 0,
                            borderColor: createUseOneTimeCustomer ? colors.primary : 'transparent',
                            opacity: pressed ? 0.88 : 1,
                            ...(Platform.OS === 'ios' && createUseOneTimeCustomer
                              ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
                              : {}),
                            ...(createUseOneTimeCustomer && Platform.OS === 'android' ? { elevation: 1 } : {}),
                          }}
                        >
                          <Text
                            style={{
                              textAlign: 'center',
                              fontWeight: '900',
                              fontSize: 14,
                              color: createUseOneTimeCustomer ? colors.primary : colors.muted,
                            }}
                            numberOfLines={1}
                          >
                            לקוח חד־פעמי
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>

              {createUseOneTimeCustomer ? (
                <View style={{ gap: 10 }}>
                  <Input label="שם" value={createOneTimeCustomer.name} onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, name: v }))} />
                  <Input
                    label="טלפון"
                    value={createOneTimeCustomer.phone ?? ''}
                    onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, phone: v }))}
                    keyboardType="phone-pad"
                  />
                  <Input
                    label="כתובת"
                    value={createOneTimeCustomer.address ?? ''}
                    onChangeText={(v) => setCreateOneTimeCustomer((p) => ({ ...p, address: v }))}
                  />
                </View>
              ) : (
                <SelectSheet
                  value={createCustomerId}
                  placeholder="בחר לקוח מהמערכת…"
                  options={createCustomerOptions}
                  onChange={setCreateCustomerId}
                  searchable
                  searchPlaceholder="חיפוש לקוח…"
                />
              )}

              {createKind !== 'special' && createUseOneTimeCustomer ? null : (
                <Input
                  label="הערות (אופציונלי)"
                  value={createNotes}
                  onChangeText={setCreateNotes}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled
                  style={{ minHeight: 100, maxHeight: 200, paddingTop: 12, paddingBottom: 12 }}
                />
              )}
            </View>
          </Card>

          {createKind === 'regular' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>נקודות שירות</Text>
              {!createCustomerId && !createUseOneTimeCustomer ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>בחר לקוח כדי לטעון נקודות שירות.</Text>
              ) : createUseOneTimeCustomer ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>לקוח חד-פעמי לא כולל נקודות שירות קבועות.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {createServicePoints.map((p) => (
                    <View key={p.id} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Pressable
                        onPress={() => setCreateServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, selected: !x.selected } : x)))}
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
                          onChangeText={(v) => setCreateServicePoints((prev) => prev.map((x) => (x.id === p.id ? { ...x, custom_refill_amount: v } : x)))}
                          keyboardType="numeric"
                          placeholder={String(p.refill_amount)}
                        />
                      ) : null}
                    </View>
                  ))}
                  {!createServicePoints.length ? (
                    <Text style={{ color: colors.muted, textAlign: 'right' }}>אין נקודות שירות ללקוח.</Text>
                  ) : null}
                </View>
              )}
            </Card>
          ) : null}

          {createKind === 'installation' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>מכשירים להתקנה</Text>
              {installationCatalogLoading ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>טוען רשימת מכשירים…</Text>
              ) : !installationDeviceSelectOptions.length ? (
                <Text style={{ color: colors.muted, textAlign: 'right' }}>
                  אין מכשירים במערכת. הוסיפו מכשירים תחת מכשירים וניחוחות בתפריט האדמין לפני יצירת משימת התקנה.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {createInstallationDevices.map((d, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                      <View style={{ flex: 1 }}>
                        <SelectSheet
                          label={`מכשיר #${idx + 1}`}
                          value={d.device_name || undefined}
                          placeholder="בחר מכשיר מהרשימה…"
                          options={installationDeviceSelectOptions}
                          searchable
                          searchPlaceholder="חיפוש מכשיר…"
                          onChange={(v) => setCreateInstallationDevices((prev) => prev.map((x, i) => (i === idx ? { ...x, device_name: v } : x)))}
                        />
                      </View>
                      <Pressable
                        onPress={() => setCreateInstallationDevices((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={createInstallationDevices.length <= 1}
                        style={{
                          backgroundColor: createInstallationDevices.length <= 1 ? colors.border : colors.danger,
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
                    onPress={() => setCreateInstallationDevices((prev) => [...prev, { device_name: '' }])}
                  />
                </View>
              )}
            </Card>
          ) : null}

          {createKind === 'special' ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 10 }}>משימה מיוחדת</Text>
              <View style={{ gap: 10 }}>
                <SelectSheet
                  label="סוג מיוחד"
                  value={createSpecialJobType}
                  options={ADMIN_SPECIAL_JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  onChange={setCreateSpecialJobType}
                />
                {createSpecialTypeMeta?.needsBattery ? (
                  <SelectSheet label="סוג סוללה" value={createBatteryType} options={BATTERY_TYPES} onChange={setCreateBatteryType} />
                ) : null}
              </View>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 14) + 6,
            backgroundColor: colors.card,
          }}
        >
          <Button title="צור" onPress={submitCreate} />
        </View>
      </KeyboardAvoidingView>
    </ModalSheet>
  );
}
