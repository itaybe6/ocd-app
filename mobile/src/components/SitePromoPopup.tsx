import { radii } from '../theme/radii';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSiteHomeExperience } from '../hooks/useSiteHomeExperience';
import {
  dismissSitePopup,
  isPopupActive,
  isSitePopupDismissed,
  type SiteLinkTarget,
  type SitePopup,
} from '../lib/siteHomeContent';

export function SitePromoPopup({
  onOpenTarget,
}: {
  onOpenTarget: (target: SiteLinkTarget, title?: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const { data } = useSiteHomeExperience();
  const [sessionTick, setSessionTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const presentedId = React.useRef<string | null>(null);

  const popup = useMemo(() => {
    const list = data?.popups ?? [];
    return list.find((item) => isPopupActive(item) && !isSitePopupDismissed(item.dismissKey)) ?? null;
  }, [data?.popups, sessionTick]);

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!popup) {
      setOpen(false);
      return;
    }
    if (!focused) {
      setOpen(false);
      return;
    }
    if (presentedId.current === popup.id) return;
    setRatio(null);
    const timer = setTimeout(() => {
      presentedId.current = popup.id;
      setOpen(true);
    }, popup.delayMs);
    return () => clearTimeout(timer);
  }, [focused, popup]);

  const close = (current: SitePopup) => {
    dismissSitePopup(current.dismissKey);
    setOpen(false);
    setSessionTick((value) => value + 1);
  };

  if (!popup) return null;

  const maxWidth = Math.min(width * 0.92, 460);
  const maxHeight = height * 0.88;
  const imageWidth = ratio ? Math.min(maxWidth, maxHeight * ratio) : maxWidth;
  const imageHeight = ratio ? imageWidth / ratio : maxHeight * 0.72;

  return (
    <Modal visible={open && focused} transparent animationType="fade" onRequestClose={() => close(popup)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ width: imageWidth, maxHeight, borderRadius: radii.surface, overflow: 'hidden' }}>
          <Pressable
            onPress={() => {
              const target = popup.target;
              close(popup);
              if (target) onOpenTarget(target, popup.alt);
            }}
            accessibilityRole="button"
            accessibilityLabel={popup.alt || 'מבצע'}
          >
            <Image
              source={{ uri: popup.imageUrl }}
              resizeMode="contain"
              onLoad={(event) => {
                const source = event.nativeEvent.source;
                if (source.width > 0 && source.height > 0) setRatio(source.width / source.height);
              }}
              style={{ width: imageWidth, height: imageHeight, borderRadius: radii.surface }}
            />
          </Pressable>
          <Pressable
            onPress={() => close(popup)}
            accessibilityRole="button"
            accessibilityLabel="סגירה"
            hitSlop={10}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 36,
              height: 36,
              borderRadius: radii.pill,
              backgroundColor: 'rgba(255,255,255,0.95)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color="#111111" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
