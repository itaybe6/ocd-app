import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme/colors';

export const OCD_PLUS_HEADLINE = 'OCD+ הדרך החכמה לקנות';

export const OCD_PLUS_SUBTITLE = 'מנוי חודשי ב-69 ₪ בלבד';

export const OCD_PLUS_CHECKLIST_SUMMARY = 'הכל בלי התחייבות. הכל ב-69 ₪.';

export const OCD_PLUS_SUBSCRIBE_BUTTON_LABEL = 'לחצו כאן כדי להצטרף >>';

export const OCD_PLUS_CHECKLIST_ITEMS: {
  /** Bold keyword */
  lead: string;
  /** Lighter continuation (leading space where needed) */
  tail: string;
}[] = [
  { lead: 'הנחה', tail: ' קבועה על כל מוצר' },
  { lead: 'גישה', tail: ' ראשונה להשקות ומבצעים' },
  { lead: 'ביטול', tail: ' בכל רגע, בלי התחייבות' },
  { lead: 'שירות', tail: ' מועדף ומהיר' },
];

type ChecklistProps = {
  dark?: boolean;
};

/** Minimal ✓ + lead/tail hierarchy — no colored icons, no row dividers */
export function OcdPlusChecklist({ dark = false }: ChecklistProps) {
  const leadColor = dark ? '#FFFFFF' : colors.text;
  const tailColor = dark ? 'rgba(255,255,255,0.48)' : colors.muted;
  const checkColor = dark ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.45)';

  return (
    <View style={{ alignSelf: 'stretch', gap: 22 }}>
      {OCD_PLUS_CHECKLIST_ITEMS.map((item) => (
        <View key={item.lead} style={{ alignSelf: 'stretch', width: '100%' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              gap: 10,
              width: '100%',
            }}
          >
            <Text style={{ flexShrink: 1, textAlign: 'right', lineHeight: 22, paddingTop: 1 }}>
              <Text style={{ color: leadColor, fontSize: 15, fontWeight: '800' }}>{item.lead}</Text>
              <Text style={{ color: tailColor, fontSize: 15, fontWeight: '600' }}>{item.tail}</Text>
            </Text>
            <Text style={{ color: checkColor, fontSize: 17, fontWeight: '700', lineHeight: 22, marginTop: 1 }}>✓</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

type SummaryProps = {
  dark?: boolean;
};

export function OcdPlusChecklistSummary({ dark = false }: SummaryProps) {
  return (
    <Text
      style={{
        color: dark ? 'rgba(255,255,255,0.58)' : colors.muted,
        fontSize: 14,
        lineHeight: 22,
        textAlign: dark ? 'center' : 'right',
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 18,
        paddingHorizontal: dark ? 10 : 0,
      }}
    >
      {OCD_PLUS_CHECKLIST_SUMMARY}
    </Text>
  );
}
