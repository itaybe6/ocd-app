import { storeAccent } from '../../theme/storeAccent';
import { radii } from '../../theme/radii';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInUp, LinearTransition, ReduceMotion, cancelAnimation, runOnJS,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

export type ToastInput = {
  title: string;
  subtitle?: string;
  autodismiss?: boolean;
  leading?: () => React.ReactNode;
  key?: string;
  duration?: number;
  favorite?: 'added' | 'removed';
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  hideToast: (id?: string) => void;
};

type LegacyToastType = 'success' | 'error' | 'info' | 'warning';

type LegacyToastOptions = {
  type?: LegacyToastType;
  text1?: string;
  text2?: string;
  visibilityTime?: number;
  autoHide?: boolean;
};

type ToastHostApi = {
  showToast: (toast: ToastInput) => string;
  hideToast: (id?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 3200;
const MAX_VISIBLE = 3;

let hostApi: ToastHostApi | null = null;
const pendingToasts: ToastInput[] = [];

function setHostApi(api: ToastHostApi | null) {
  hostApi = api;
  if (!api) return;
  while (pendingToasts.length) {
    const next = pendingToasts.shift();
    if (next) api.showToast(next);
  }
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const closing = useSharedValue(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    'worklet';
    if (closing.value) return;
    closing.value = true;
    offset.value = withTiming(Math.min(offset.value - 80, -100), { duration: 140 });
    opacity.value = withTiming(0, { duration: 140 }, (finished) => {
      if (finished) runOnJS(onDismiss)(toast.id);
    });
  }, [closing, offset, onDismiss, opacity, toast.id]);

  const pauseTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const startTimer = useCallback(() => {
    pauseTimer();
    if (toast.autodismiss === false || closing.value) return;
    timer.current = setTimeout(dismiss, toast.duration ?? AUTO_DISMISS_MS);
  }, [closing, dismiss, pauseTimer, toast.autodismiss, toast.duration]);

  useEffect(() => {
    startTimer();
    return pauseTimer;
  }, [pauseTimer, startTimer]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY(-6)
    .failOffsetX([-24, 24])
    .onBegin(() => { runOnJS(pauseTimer)(); })
    .onStart(() => { if (!closing.value) cancelAnimation(offset); })
    .onUpdate((event) => {
      if (!closing.value) offset.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY < -32 || (event.translationY < -8 && event.velocityY < -450)) dismiss();
    })
    .onFinalize(() => {
      if (!closing.value) {
        offset.value = withSpring(0, { damping: 20, stiffness: 300 });
        runOnJS(startTimer)();
      }
    }), [closing, dismiss, offset, pauseTimer, startTimer]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: opacity.value * Math.max(0.25, 1 + offset.value / 160),
  }));
  const compact = !!toast.favorite;

  return (
    <Animated.View
      entering={FadeInUp.duration(180).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(160).reduceMotion(ReduceMotion.System)}
      style={compact ? styles.compactWrapper : undefined}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, compact && styles.compactCard, motionStyle]}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={[toast.title, toast.subtitle].filter(Boolean).join('. ')}
            accessibilityHint="לחצו לסגירה או החליקו כלפי מעלה"
            accessibilityLiveRegion="polite"
            style={({ pressed }) => [styles.cardPadding, compact && styles.compactPadding, pressed && styles.cardPressed]}
          >
            <View style={[styles.cardInner, compact && styles.compactInner]}>
              {toast.favorite ? (
                <View style={[styles.favoriteIcon, toast.favorite === 'removed' && styles.removedIcon]}>
                  <Heart size={18} strokeWidth={1.8} color={toast.favorite === 'added' ? storeAccent.ink : '#797580'} fill={toast.favorite === 'added' ? storeAccent.ink : 'transparent'} />
                </View>
              ) : null}
              {toast.leading ? <View style={styles.leading}>{toast.leading()}</View> : null}
              <View style={styles.copy}>
                <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>
                  {toast.title}
                </Text>
                {toast.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {toast.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const hideToast = useCallback((id?: string) => {
    setToasts((current) => {
      if (!id) return current.slice(1);
      return current.filter((toast) => toast.id !== id);
    });
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    // A replacement gets a fresh lifetime; a previous exit cannot dismiss it.
    const id = `toast-${Date.now()}-${idRef.current++}`;
    const next: ToastItem = {
      ...toast,
      id,
      autodismiss: toast.autodismiss ?? true,
    };

    setToasts((current) => {
      const withoutSameKey = toast.key ? current.filter((item) => item.key !== toast.key) : current;
      return [next, ...withoutSameKey].slice(0, MAX_VISIBLE);
    });

    return id;
  }, []);

  useEffect(() => {
    setHostApi({ showToast, hideToast });
    return () => setHostApi(null);
  }, [hideToast, showToast]);

  const value = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={hideToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function showToast(toast: ToastInput): string {
  if (hostApi) return hostApi.showToast(toast);
  pendingToasts.push(toast);
  return toast.key ?? `toast-pending-${Date.now()}`;
}

/** Drop-in replacement for `react-native-toast-message` imperative API. */
const Toast = {
  show(options: LegacyToastOptions) {
    showToast({
      title: options.text1?.trim() || 'הודעה',
      subtitle: options.text2?.trim() || undefined,
      autodismiss: options.autoHide ?? true,
      duration: options.visibilityTime,
      // No default icon — only show when explicitly provided via showToast({ leading })
    });
  },
  hide() {
    hostApi?.hideToast();
  },
};

export default Toast;

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  cardPadding: { paddingHorizontal: 24, paddingVertical: 20 },
  compactWrapper: { width: '100%', maxWidth: 360, alignSelf: 'center' },
  compactCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: storeAccent.border,
    shadowColor: storeAccent.onPrimary,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  compactPadding: { paddingHorizontal: 14, paddingVertical: 10 },
  compactInner: { flexDirection: 'row-reverse', gap: 10 },
  compactTitle: { color: storeAccent.onPrimary, fontSize: 14, fontWeight: '600' },
  favoriteIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: storeAccent.soft, alignItems: 'center', justifyContent: 'center' },
  removedIcon: { backgroundColor: '#F4F3F5' },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardPressed: {
    opacity: 0.96,
  },
  leading: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
});
