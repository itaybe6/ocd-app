import React, { useRef } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { Avatar } from '../ui/Avatar';
import { yyyyMmDd } from '../../lib/time';

export type AdminStyleJobRowKind = 'regular' | 'installation' | 'special';

/** Chips + action buttons — same tokens as admin Jobs list */
export const JOB_ROW_CHIP: ViewStyle = {
  borderRadius: 20,
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderWidth: 1,
  backgroundColor: 'rgba(30,58,138,0.07)',
  borderColor: 'rgba(30,58,138,0.15)',
};

export const JOB_ROW_CHIP_TEXT = {
  fontSize: 10,
  fontWeight: '700' as const,
  color: '#1E3A8A',
};

export const JOB_ROW_ACTION_BTN: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 11,
  borderWidth: 1.5,
  borderColor: 'rgba(30,58,138,0.16)',
  backgroundColor: 'rgba(30,58,138,0.07)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export function adminJobKindLabel(kind: AdminStyleJobRowKind) {
  return kind === 'installation' ? 'התקנה' : kind === 'special' ? 'מיוחדת' : 'ריח';
}

type MeasureRect = { x: number; y: number; width: number; height: number };

export function AdminStyleJobRow({
  kind,
  status,
  date,
  avatarUri,
  topRightLabel,
  titleLine,
  notes,
  onPress,
  onPressInCapture,
  footer,
  showFooter = true,
}: {
  kind: AdminStyleJobRowKind;
  status: 'pending' | 'completed';
  date: string;
  avatarUri?: string | null;
  topRightLabel: string;
  titleLine?: string | null;
  notes?: string | null;
  onPress?: () => void;
  /** For origin animations (e.g. admin details modal) */
  onPressInCapture?: (rect: MeasureRect) => void;
  footer?: React.ReactNode;
  /** When false, omits the bottom strip (e.g. static preview) */
  showFooter?: boolean;
}) {
  const isCompleted = status === 'completed';
  const kindLabel = adminJobKindLabel(kind);
  const dateChip = yyyyMmDd(date);
  const measureRef = useRef<View>(null);

  const capture = () => {
    if (!onPressInCapture) return;
    measureRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onPressInCapture({ x, y, width, height });
    });
  };

  const handlePressIn = onPressInCapture ? () => capture() : undefined;

  const shadowWrap: ViewStyle[] = [
    { borderRadius: 20 },
    Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
      default: {},
    }),
    isCompleted ? { opacity: 0.68 } : {},
  ];

  const cardInner = (
    <View style={shadowWrap}>
      <View
        ref={measureRef}
        collapsable={false}
        style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7, flex: 1, marginLeft: 8 }}>
              <Avatar size={24} uri={avatarUri ?? null} name={topRightLabel} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#8E8E93', flex: 1, textAlign: 'right' }} numberOfLines={1}>
                {topRightLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={JOB_ROW_CHIP}>
                <Text style={JOB_ROW_CHIP_TEXT}>{dateChip}</Text>
              </View>
              <View style={JOB_ROW_CHIP}>
                <Text style={JOB_ROW_CHIP_TEXT}>{kindLabel}</Text>
              </View>
              <View style={[JOB_ROW_CHIP, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isCompleted ? '#34C759' : '#FF9500' }} />
                <Text style={JOB_ROW_CHIP_TEXT}>{isCompleted ? 'הושלם' : 'ממתין'}</Text>
              </View>
            </View>
          </View>

          {!!titleLine?.trim() && (
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', textAlign: 'right', lineHeight: 22 }} numberOfLines={1}>
              {titleLine}
            </Text>
          )}

          {!!notes?.trim() && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#64748B',
                textAlign: 'right',
                marginTop: 5,
                lineHeight: 17,
              }}
              numberOfLines={1}
            >
              {notes}
            </Text>
          )}
        </View>

        {showFooter ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 15,
              paddingVertical: 11,
              borderTopWidth: 1,
              borderTopColor: '#F2F2F7',
            }}
          >
            {footer}
            <View style={{ flex: 1 }} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPressIn={handlePressIn} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
        {cardInner}
      </Pressable>
    );
  }

  return <View>{cardInner}</View>;
}
