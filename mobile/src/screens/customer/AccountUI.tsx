import { radii } from '../../theme/radii';
import React from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import type { CustomerOrderRow } from '../../types/database';

export const accountColors = {
  bg: '#FFFFFF', ink: '#111111', muted: '#737373', line: '#E8E8E8',
  silver: '#F5F5F5', red: '#B83B3B',
};

type IconName = keyof typeof Ionicons.glyphMap;

export function AccountHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.header, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={ui.headerBar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="חזרה לעמוד הקודם"
          style={({ pressed }) => [ui.backButton, pressed && ui.backButtonPressed]}
        >
          <Ionicons name="arrow-forward" size={21} color={accountColors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function AccountIntro({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <View style={ui.intro}>
      {eyebrow ? <Text style={ui.eyebrow}>{eyebrow}</Text> : null}
      <Text style={ui.title}>{title}</Text>
      {subtitle ? <Text style={ui.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function AccountSection({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={ui.section}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={ui.sectionAction}>
          <Text style={ui.sectionActionText}>{action}</Text>
          <Ionicons name="arrow-back" size={14} color={accountColors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AccountRow({ icon, title, subtitle, value, onPress }: {
  icon: IconName; title: string; subtitle?: string; value?: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={ui.row}>
      <View style={ui.rowIcon}><Ionicons name={icon} size={21} color={accountColors.ink} /></View>
      <View style={ui.rowCopy}>
        <Text style={ui.rowTitle}>{title}</Text>
        {subtitle ? <Text style={ui.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value != null ? <Text style={ui.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-back" size={16} color={accountColors.muted} />
    </Pressable>
  );
}

export function AccountButton({ label, onPress, busy = false, disabled = false }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} style={ui.buttonHit}>
      <View style={[ui.button, (disabled || busy) && ui.disabled]}>
        <Text style={ui.buttonText}>{label}</Text>
        {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="arrow-back" size={18} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}

export function AccountEmpty({ icon, title, description, action, onPress }: {
  icon: IconName; title: string; description: string; action?: string; onPress?: () => void;
}) {
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIllustration}>
        <View style={ui.emptyLine} />
        <Ionicons name={icon} size={38} color="#96999D" />
        <View style={ui.emptyLine} />
      </View>
      <Text style={ui.emptyTitle}>{title}</Text>
      <Text style={ui.emptyText}>{description}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={ui.emptyAction}>
          <Text style={ui.emptyActionText}>{action}</Text>
          <Ionicons name="arrow-back" size={15} color={accountColors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AccountLoading({ label }: { label: string }) {
  return <View style={ui.loading}><ActivityIndicator color={accountColors.ink} /><Text style={ui.emptyText}>{label}</Text></View>;
}

export function AccountMembershipMark() {
  return (
    <View style={ui.memberMark}>
      <Svg width="100%" height="100%" viewBox="0 0 320 112" style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Defs><RadialGradient id="accountSilver" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#DADDE1" stopOpacity={0.65} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient></Defs>
        <Ellipse cx="160" cy="56" rx="132" ry="56" fill="url(#accountSilver)" />
        <Path d="M270 30v32M254 46h32" stroke="#E5E5E5" strokeWidth={4} strokeLinecap="round" />
      </Svg>
      <OcdPlusMark size={88} />
    </View>
  );
}

export function AccountOrderRow({ order, onPress }: { order: CustomerOrderRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`פרטי הזמנה ${order.order_number}`} style={ui.order}>
      <View style={ui.orderTop}>
        <Text style={ui.orderNumber}>הזמנה #{order.order_number}</Text>
        <Text style={[ui.orderStatus, order.status === 'cancelled' && { color: accountColors.red }]}>{getOrderStatusLabel(order.status)}</Text>
      </View>
      <Text style={ui.orderDate}>{formatOrderDate(order.created_at)} · {order.item_count} פריטים</Text>
      <View style={ui.orderBottom}>
        <Text style={ui.orderPrice}>{formatOrderPrice(order.total_amount, order.currency_code)}</Text>
        <View style={ui.orderLink}><Text style={ui.orderLinkText}>פרטי ההזמנה</Text><Ionicons name="arrow-back" size={16} color={accountColors.ink} /></View>
      </View>
    </Pressable>
  );
}

const ui = StyleSheet.create({
  header: { backgroundColor: accountColors.bg },
  headerBar: { flexDirection: 'row-reverse', alignItems: 'center', paddingTop: 8, paddingHorizontal: 24 },
  backButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: accountColors.silver, alignItems: 'center', justifyContent: 'center' },
  backButtonPressed: { backgroundColor: '#E8E8E8' },
  intro: { paddingTop: 28, paddingBottom: 24, gap: 7 },
  eyebrow: { fontSize: 13, lineHeight: 20, color: accountColors.muted, textAlign: 'right' },
  title: { fontSize: 30, lineHeight: 39, color: accountColors.ink, fontWeight: '800', textAlign: 'right' },
  subtitle: { fontSize: 14, lineHeight: 23, color: accountColors.muted, textAlign: 'right' },
  section: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 26, paddingBottom: 6 },
  sectionTitle: { flexShrink: 1, fontSize: 18, lineHeight: 26, color: accountColors.ink, fontWeight: '700', textAlign: 'right' },
  sectionAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 44 },
  sectionActionText: { fontSize: 12, color: accountColors.muted },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 15, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: accountColors.line },
  rowIcon: { width: 40, height: 40, borderRadius: radii.compact, backgroundColor: '#F5F6F7', borderWidth: 1, borderColor: '#ECEDEF', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 5 },
  rowTitle: { fontSize: 16, lineHeight: 23, color: accountColors.ink, fontWeight: '600', textAlign: 'right' },
  rowSubtitle: { fontSize: 12, lineHeight: 19, color: accountColors.muted, textAlign: 'right' },
  rowValue: { fontSize: 16, color: accountColors.muted, fontVariant: ['tabular-nums'] },
  buttonHit: { alignSelf: 'stretch' },
  button: { backgroundColor: '#000000', borderRadius: radii.surface, minHeight: 54, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  empty: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 30, gap: 10 },
  emptyIllustration: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 8 },
  emptyLine: { width: 30, height: 1, backgroundColor: '#DFE1E3' },
  emptyTitle: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: accountColors.ink, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 22, color: accountColors.muted, textAlign: 'center' },
  emptyAction: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  emptyActionText: { fontSize: 13, fontWeight: '600', color: accountColors.ink, textDecorationLine: 'underline' },
  loading: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  memberMark: { height: 112, width: '100%', alignItems: 'center', justifyContent: 'center' },
  order: { paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: accountColors.line, gap: 9 },
  orderTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  orderNumber: { fontSize: 17, lineHeight: 24, color: accountColors.ink, fontWeight: '700', textAlign: 'right' },
  orderStatus: { color: accountColors.muted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  orderDate: { fontSize: 12, lineHeight: 20, color: accountColors.muted, textAlign: 'right' },
  orderBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 6 },
  orderPrice: { color: accountColors.ink, fontSize: 20, fontWeight: '600', writingDirection: 'ltr' },
  orderLink: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  orderLinkText: { fontSize: 12, color: accountColors.ink },
});
