import { radii } from '../theme/radii';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSheet } from './ModalSheet';
import { OcdPlusMark } from './OcdPlusMark';
import { useOcdPlusMembership } from '../state/useOcdPlusMembership';
import { safeNavigate } from '../navigation/navigationRef';
import {
  OCD_PLUS_CHECKLIST_ITEMS,
  OCD_PLUS_CHECKLIST_SUMMARY,
  OCD_PLUS_HEADLINE,
  OCD_PLUS_SUBTITLE,
} from './ocdPlusBenefits';

// Match the store's black navigation, white surfaces and silver OCD+ mark.
const palette = {
  surface: '#FFFFFF',
  ink: '#000000',
  muted: '#6B6B6B',
  border: '#E8E8E8',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  isSubscriber: boolean;
};

function formatBillingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function SheetContent({ children, onClose, isSubscriber }: React.PropsWithChildren<{ onClose: () => void; isSubscriber: boolean }>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: Math.round(height * 0.80) }}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.toolbar}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="סגירת חלון OCD+"
          style={styles.closeButton}
        >
          <X size={20} color={palette.ink} strokeWidth={1.5} />
        </Pressable>
      </View>
      <View style={styles.brand}>
        <View style={styles.brandStage}>
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 320 104"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessible={false}
          >
            <Defs>
              <RadialGradient id="memberSilver" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor="#DADDE1" stopOpacity={0.65} />
                <Stop offset="0.55" stopColor="#ECEEF0" stopOpacity={0.45} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="160" cy="52" rx="132" ry="52" fill="url(#memberSilver)" />
            <Path d="M270 24v40M250 44h40" stroke="#E5E5E5" strokeWidth={5} strokeLinecap="round" />
          </Svg>
          <OcdPlusMark size={86} color={palette.ink} />
        </View>
        <View style={styles.membershipStatus}>
          {isSubscriber ? <Check size={13} color={palette.ink} strokeWidth={1.7} /> : null}
          <Text style={styles.statusText}>{isSubscriber ? 'המנוי שלכם פעיל' : 'מועדון החברים של OCD'}</Text>
        </View>
      </View>
      {children}
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.continueButton}>
        <Text style={styles.continueLabel}>להמשיך בקניות</Text>
      </Pressable>
    </ScrollView>
  );
}

function SheetButton({ label, onPress, busy = false }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      style={styles.actionHitArea}
    >
      {/* Keep the visible surface on a regular View: native styling interop can drop Pressable callback styles. */}
      <View style={[styles.actionButton, busy && styles.actionBusy]}>
        <Text style={styles.actionLabel}>{busy ? 'פותחים את ההצטרפות…' : label}</Text>
        {busy ? <ActivityIndicator size="small" color={palette.surface} /> : <ArrowLeft size={18} color={palette.surface} strokeWidth={1.7} />}
      </View>
    </Pressable>
  );
}

function OcdPlusMemberSheetContent({ onClose }: { onClose: () => void }) {
  const { subscription } = useOcdPlusMembership();
  const nextBillingLabel = useMemo(
    () => formatBillingDate(subscription?.next_billing_at ?? subscription?.current_period_end),
    [subscription?.next_billing_at, subscription?.current_period_end],
  );

  const handleManagePress = useCallback(() => {
    onClose();
    setTimeout(() => {
      safeNavigate('Main', { initialCustomerOcdPlus: true, initialTabRequestId: Date.now() });
    }, 280);
  }, [onClose]);

  return (
    <SheetContent onClose={onClose} isSubscriber>
      <Text style={styles.heading}>טוב שאתם איתנו.</Text>
      <View style={styles.headingRule} />
      <Text style={styles.description}>
        ההנחות הקבועות, ההשקות המוקדמות והשירות המועדף — הכל מחכה לכם בחנות.
      </Text>
      {nextBillingLabel ? (
        <View style={styles.billingRow}>
          <Text style={styles.billingLabel}>{subscription?.cancel_at_period_end ? 'המנוי מסתיים ב־' : 'החיוב הבא'}</Text>
          <Text style={styles.billingDate}>{nextBillingLabel}</Text>
        </View>
      ) : null}
      <SheetButton label="לניהול המנוי" onPress={handleManagePress} />
    </SheetContent>
  );
}

function OcdPlusSubscribeSheetContent({ onClose }: { onClose: () => void }) {
  const { busy, startPurchase } = useOcdPlusMembership();
  const handlePurchase = useCallback(async () => {
    await startPurchase();
    onClose();
  }, [onClose, startPurchase]);

  return (
    <SheetContent onClose={onClose} isSubscriber={false}>
      <Text style={styles.heading}>{OCD_PLUS_HEADLINE}</Text>
      <View style={styles.headingRule} />
      <Text style={styles.price}>{OCD_PLUS_SUBTITLE}</Text>
      <View style={styles.checklist}>
        {OCD_PLUS_CHECKLIST_ITEMS.map((item) => (
          <View key={item.lead} style={styles.checklistRow}>
            <Check size={15} color={palette.ink} strokeWidth={1.5} />
            <Text style={styles.checklistText}><Text style={styles.checklistLead}>{item.lead}</Text>{item.tail}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.summary}>{OCD_PLUS_CHECKLIST_SUMMARY}</Text>
      <SheetButton label="מצטרפים למועדון OCD+" onPress={handlePurchase} busy={busy} />
    </SheetContent>
  );
}

export function OcdPlusSubscribeSheet({ visible, onClose, isSubscriber }: Props) {
  const { height } = useWindowDimensions();
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      containerStyle={{
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
        maxHeight: Math.round(height * 0.92),
        backgroundColor: palette.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
      }}
    >
      {isSubscriber ? <OcdPlusMemberSheetContent onClose={onClose} /> : <OcdPlusSubscribeSheetContent onClose={onClose} />}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 26 },
  toolbar: { alignItems: 'flex-start', height: 36, marginHorizontal: -10 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', paddingTop: 2, marginBottom: 22, gap: 10 },
  brandStage: { width: '100%', height: 104, alignItems: 'center', justifyContent: 'center' },
  membershipStatus: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statusText: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  heading: { color: palette.ink, fontSize: 26, lineHeight: 34, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  headingRule: { width: 26, height: 2, backgroundColor: '#BFC2C6', alignSelf: 'center', marginBottom: 14 },
  description: { color: palette.muted, fontSize: 14, lineHeight: 23, textAlign: 'center', marginBottom: 28, paddingHorizontal: 4 },
  billingRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 17, marginBottom: 24 },
  billingLabel: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'right', flexShrink: 1 },
  billingDate: { color: palette.ink, fontSize: 13, lineHeight: 20, fontWeight: '600', textAlign: 'right' },
  actionHitArea: { alignSelf: 'stretch' },
  actionButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: palette.ink, minHeight: 54, paddingHorizontal: 20, paddingVertical: 16, borderRadius: radii.surface },
  actionBusy: { opacity: 0.65 },
  actionLabel: { color: palette.surface, fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  continueButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingVertical: 12 },
  continueLabel: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  price: { color: palette.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 26 },
  checklist: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 22, gap: 18 },
  checklistRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  checklistText: { flex: 1, color: palette.muted, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  checklistLead: { color: palette.ink, fontWeight: '600' },
  summary: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginVertical: 20 },
});
