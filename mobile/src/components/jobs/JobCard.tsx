import React, { useRef } from 'react';
import { Pressable, Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import type { OriginRect } from '../OriginWindow';

export type JobCardStatus = 'pending' | 'completed';
export type JobCardKind = 'regular' | 'installation' | 'special';

const ui = {
  surface: '#FAF9FE',
  surfaceContainerHigh: '#E9E7ED',
  outlineVariant: '#C1C6D7',
  outline: '#717786',
  primary: '#0058BC',
} as const;

function statusMeta(status: JobCardStatus) {
  return status === 'completed'
    ? { label: 'הושלם', bg: 'rgba(34,197,94,0.11)', fg: '#166534', border: 'rgba(34,197,94,0.28)' }
    : { label: 'ממתין', bg: 'rgba(249,115,22,0.10)', fg: '#9A3412', border: 'rgba(249,115,22,0.28)' };
}

function kindAccentColor(kind?: JobCardKind): string {
  if (kind === 'installation') return '#7C3AED';
  if (kind === 'special') return '#EA580C';
  return '#0058BC';
}

export function JobCardAction({
  label,
  onPress,
  onPressIn,
  onOriginRect,
  disabled,
  children,
  variant = 'neutral',
}: {
  label: string;
  onPress: () => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  onOriginRect?: (rect: { x: number; y: number; width: number; height: number; borderRadius: number }) => void;
  disabled?: boolean;
  variant?: 'neutral' | 'danger';
  children: React.ReactNode;
}) {
  // ref must be on the inner View (not Pressable) for measureInWindow to work reliably
  const innerRef = useRef<View>(null);

  const captureOriginRect = () => {
    if (!onOriginRect) return;
    innerRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onOriginRect({ x, y, width, height, borderRadius: 13 });
      }
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={(e) => {
        captureOriginRect();
        onPressIn?.(e);
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.28 : pressed ? 0.55 : 1 }]}
    >
      <View
        ref={innerRef}
        collapsable={false}
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: variant === 'danger' ? 'rgba(239,68,68,0.09)' : 'rgba(15,23,42,0.05)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

export function JobChip({
  text,
  muted,
  accent,
}: {
  text: string;
  muted?: boolean;
  accent?: 'blue' | 'purple' | 'orange' | 'neutral';
}) {
  const accentMap = {
    blue:   { bg: 'rgba(0,88,188,0.09)',   fg: '#0058BC', border: 'rgba(0,88,188,0.22)' },
    purple: { bg: 'rgba(124,58,237,0.09)', fg: '#6D28D9', border: 'rgba(124,58,237,0.22)' },
    orange: { bg: 'rgba(234,88,12,0.09)',  fg: '#C2410C', border: 'rgba(234,88,12,0.22)' },
    neutral:{ bg: 'rgba(15,23,42,0.05)',   fg: '#475569', border: 'rgba(15,23,42,0.10)' },
  };
  const c = accent ? accentMap[accent] : null;

  return (
    <View
      style={{
        backgroundColor: c ? c.bg : muted ? 'rgba(0,0,0,0.05)' : 'rgba(0,88,188,0.08)',
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: c ? c.border : 'rgba(0,0,0,0.06)',
      }}
    >
      <Text
        style={{
          color: c ? c.fg : muted ? '#717786' : ui.primary,
          fontWeight: '700',
          fontSize: 11,
          textAlign: 'right',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function JobCard({
  title,
  status,
  primaryText,
  primaryNode,
  description,
  onPress,
  onOriginRect,
  actions,
  chips,
  faded,
  kind,
  style,
}: {
  title: string;
  status?: JobCardStatus;
  primaryText?: string;
  primaryNode?: React.ReactNode;
  description?: string | null;
  onPress?: () => void;
  onOriginRect?: (rect: OriginRect) => void;
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  faded?: boolean;
  kind?: JobCardKind;
  style?: ViewStyle;
}) {
  const hasTitle = !!title?.trim();
  const outerRef = useRef<View>(null);

  const captureOriginRect = () => {
    if (!onOriginRect) return;
    outerRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onOriginRect({ x, y, width, height, borderRadius: 20 });
      }
    });
  };

  const shadow: ViewStyle = {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  };

  const accentColor = kindAccentColor(kind);

  const inner = (
    <View>
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: hasTitle ? 'space-between' : 'flex-start',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        {hasTitle ? (
          <Text
            style={{
              color: colors.text,
              fontWeight: '800',
              fontSize: 15,
              textAlign: 'right',
              flex: 1,
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {status ? (
          <View
            style={{
              backgroundColor: statusMeta(status).bg,
              borderColor: statusMeta(status).border,
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: statusMeta(status).fg, fontWeight: '700', fontSize: 11 }}>
              {statusMeta(status).label}
            </Text>
          </View>
        ) : null}
      </View>

      {(!!primaryNode || !!primaryText || !!description) && (
        <View style={{ gap: 4, marginTop: 8 }}>
          {!!primaryNode
            ? primaryNode
            : !!primaryText && (
                <Text
                  style={{ color: accentColor, fontWeight: '700', fontSize: 13, textAlign: 'right' }}
                  numberOfLines={1}
                >
                  {primaryText}
                </Text>
              )}
          {!!description && (
            <Text
              style={{
                color: '#6B7280',
                fontSize: 13,
                lineHeight: 18,
                textAlign: 'right',
                fontWeight: '500',
              }}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View
      ref={outerRef}
      collapsable={false}
      style={[
        shadow,
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.06)',
          opacity: faded ? 0.72 : 1,
        },
        style,
      ]}
    >
      <View style={{ padding: 16 }}>
        {onPress ? (
          <Pressable
            onPress={onPress}
            onPressIn={captureOriginRect}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            {inner}
          </Pressable>
        ) : (
          inner
        )}

        {(actions || chips) ? (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(0,0,0,0.06)',
                marginTop: 14,
                marginBottom: 12,
              }}
            />
            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', gap: 14, alignItems: 'center' }}>
                {actions}
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 6, alignItems: 'center' }}>
                {chips}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
