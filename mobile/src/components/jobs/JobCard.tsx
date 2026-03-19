import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

export type JobCardStatus = 'pending' | 'completed';

const ui = {
  surface: '#FAF9FE',
  surfaceContainerHigh: '#E9E7ED',
  outlineVariant: '#C1C6D7',
  outline: '#717786',
  primary: '#0058BC',
} as const;

function statusMeta(status: JobCardStatus) {
  return status === 'completed'
    ? { label: 'הושלם', bg: 'rgba(34,197,94,0.12)', fg: '#166534', border: 'rgba(34,197,94,0.22)' }
    : { label: 'ממתין', bg: 'rgba(249,115,22,0.12)', fg: '#9A3412', border: 'rgba(249,115,22,0.22)' };
}

export function JobCardAction({
  label,
  onPress,
  disabled,
  children,
  variant = 'neutral',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'neutral' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          borderRadius: 999,
          backgroundColor: variant === 'danger' ? 'rgba(239,68,68,0.10)' : 'rgba(15,23,42,0.04)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function JobChip({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(15,23,42,0.04)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: muted ? ui.outline : '#414755', fontWeight: '900', fontSize: 11, textAlign: 'right' }}>{text}</Text>
    </View>
  );
}

export function JobCard({
  title,
  status,
  primaryText,
  description,
  onPress,
  actions,
  chips,
  faded,
  style,
}: {
  title: string;
  status?: JobCardStatus;
  primaryText?: string;
  description?: string | null;
  onPress?: () => void;
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  faded?: boolean;
  style?: ViewStyle;
}) {
  const shadow: ViewStyle = {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  };

  const header = (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <Text
        style={{ color: colors.text, fontWeight: '900', fontSize: 16, textAlign: 'right', flex: 1 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {status ? (
        <View
          style={{
            backgroundColor: statusMeta(status).bg,
            borderColor: statusMeta(status).border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: statusMeta(status).fg, fontWeight: '900', fontSize: 11 }}>{statusMeta(status).label}</Text>
        </View>
      ) : null}
    </View>
  );

  const middle = (
    <View style={{ gap: 6 }}>
      {!!primaryText ? (
        <Text style={{ color: ui.primary, fontWeight: '900', textAlign: 'right' }} numberOfLines={1}>
          {primaryText}
        </Text>
      ) : null}
      {!!description ? (
        <Text style={{ color: '#6B7280', textAlign: 'right', lineHeight: 20, fontWeight: '600' }} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        shadow,
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: 'rgba(193,198,215,0.18)',
          opacity: faded ? 0.78 : 1,
        },
        style,
      ]}
    >
      {onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => [{ gap: 10, opacity: pressed ? 0.9 : 1 }]}>
          {header}
          {middle}
        </Pressable>
      ) : (
        <View style={{ gap: 10 }}>
          {header}
          {middle}
        </View>
      )}

      {(actions || chips) ? (
        <>
          <View style={{ height: 1, backgroundColor: ui.surfaceContainerHigh, marginTop: 14, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 10, alignItems: 'center' }}>{actions}</View>
            <View style={{ flexDirection: 'row-reverse', gap: 10, alignItems: 'center' }}>{chips}</View>
          </View>
        </>
      ) : null}
    </View>
  );
}

