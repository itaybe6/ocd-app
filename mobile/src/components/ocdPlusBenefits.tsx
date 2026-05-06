import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { OcdPlusMark } from './OcdPlusMark';

export const OCD_PLUS_BENEFITS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: React.ReactNode;
  /** Plain text version used when `dark` prop is true */
  bodyPlain: string;
}[] = [
  {
    icon: 'pricetag-outline',
    title: '13% הנחה על המחיר',
    bodyPlain: 'מחיר מועדון OCD+ על מוצרים בחנות — חיסכון אמיתי בכל קנייה.',
    body: (
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: 'right' }}>מחיר מועדון </Text>
        <OcdPlusMark size={16} style={{ marginHorizontal: 2 }} />
        <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: 'right' }}>
          {' על מוצרים בחנות — חיסכון אמיתי בכל קנייה.'}
        </Text>
      </View>
    ),
  },
  {
    icon: 'flash-outline',
    title: 'הטבות לפני כולם',
    bodyPlain: 'מבצעים, השקות וקולקציות מוגבלות — קודם מגיעים למנויים.',
    body: 'מבצעים, השקות וקולקציות מוגבלות — קודם מגיעים למנויים.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'שקט נפשי',
    bodyPlain: 'מנוי שקוף, בלי הפתעות: ביטול או שינוי לפי תנאי השירות שלכם.',
    body: 'מנוי שקוף, בלי הפתעות: ביטול או שינוי לפי תנאי השירות שלכם.',
  },
  {
    icon: 'heart-outline',
    title: 'חוויית לקוח מועדפת',
    bodyPlain: 'תמיכה מהירה ושירות שמבין את הצורך בסדר, בניקיון ובבית.',
    body: 'תמיכה מהירה ושירות שמבין את הצורך בסדר, בניקיון ובבית.',
  },
];

const ICON_BG_LIGHT: Record<string, string> = {
  'pricetag-outline': '#EFF6FF',
  'flash-outline': '#FFFBEB',
  'shield-checkmark-outline': '#F0FDF4',
  'heart-outline': '#FFF1F2',
};

const ICON_BG_DARK: Record<string, string> = {
  'pricetag-outline': 'rgba(37,99,235,0.22)',
  'flash-outline': 'rgba(217,119,6,0.22)',
  'shield-checkmark-outline': 'rgba(22,163,74,0.22)',
  'heart-outline': 'rgba(225,29,72,0.22)',
};

const ICON_COLOR: Record<string, string> = {
  'pricetag-outline': '#60A5FA',
  'flash-outline': '#FBBF24',
  'shield-checkmark-outline': '#34D399',
  'heart-outline': '#FB7185',
};

const ICON_COLOR_LIGHT: Record<string, string> = {
  'pricetag-outline': '#2563EB',
  'flash-outline': '#D97706',
  'shield-checkmark-outline': '#16A34A',
  'heart-outline': '#E11D48',
};

type BenefitRowProps = (typeof OCD_PLUS_BENEFITS)[number] & {
  isLast?: boolean;
  dark?: boolean;
};

export function OcdPlusBenefitRow({ icon, title, body, bodyPlain, isLast, dark = false }: BenefitRowProps) {
  const iconBg = dark ? (ICON_BG_DARK[icon] ?? 'rgba(255,255,255,0.12)') : (ICON_BG_LIGHT[icon] ?? '#EEF2FF');
  const iconColor = dark ? (ICON_COLOR[icon] ?? '#93C5FD') : (ICON_COLOR_LIGHT[icon] ?? colors.primary);
  const titleColor = dark ? '#FFFFFF' : colors.text;
  const bodyColor = dark ? 'rgba(255,255,255,0.60)' : colors.muted;
  const dividerColor = dark ? 'rgba(255,255,255,0.07)' : colors.border;

  const resolvedBody = dark
    ? <Text style={{ color: bodyColor, fontSize: 13.5, lineHeight: 21, textAlign: 'right', marginTop: 3 }}>{bodyPlain}</Text>
    : typeof body === 'string'
      ? <Text style={{ color: bodyColor, fontSize: 13.5, lineHeight: 21, textAlign: 'right', marginTop: 3 }}>{body}</Text>
      : <View style={{ marginTop: 3, alignSelf: 'stretch' }}>{body}</View>;

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: dividerColor,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ color: titleColor, fontSize: 15, fontWeight: '800', textAlign: 'right' }}>{title}</Text>
        {resolvedBody}
      </View>
    </View>
  );
}
