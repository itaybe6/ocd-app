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
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export type ToastInput = {
  title: string;
  subtitle?: string;
  autodismiss?: boolean;
  leading?: () => React.ReactNode;
  key?: string;
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
  useEffect(() => {
    if (toast.autodismiss === false) return;
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.autodismiss, toast.id]);

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={styles.card}
    >
      <Pressable onPress={() => onDismiss(toast.id)} style={({ pressed }) => pressed && styles.cardPressed}>
        <View style={styles.cardInner}>
          {toast.leading ? <View style={styles.leading}>{toast.leading()}</View> : null}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={2}>
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
    const id = toast.key ?? `toast-${Date.now()}-${idRef.current++}`;
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
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
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
