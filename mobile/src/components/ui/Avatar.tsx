import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

function initialsFromName(name?: string | null): string {
  const safe = (name ?? '').trim();
  if (!safe) return '';
  const parts = safe.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 28,
  style,
  imageStyle,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  const initials = useMemo(() => initialsFromName(name), [name]);

  useEffect(() => {
    // If the URI changes (e.g. new upload), allow retry.
    setFailed(false);
  }, [uri]);

  const outer: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  return (
    <View style={[outer, style]} accessibilityLabel={name ? `avatar ${name}` : 'avatar'}>
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: Math.max(11, Math.round(size * 0.38)) }}>
          {initials || '•'}
        </Text>
      )}
    </View>
  );
}

