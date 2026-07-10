import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { colors } from '../../theme/colors';
import {
  isCheckoutHttpErrorBlocking,
  MOBILE_SAFARI_UA,
  normalizeCheckoutUrl,
  resolveCheckoutLaunchUrl,
} from '../../lib/checkoutUrl';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

/** Hide only Shopify's top checkout banner (store logo strip). Keep selectors narrow — broad rules blank the page. */
const CHECKOUT_HIDE_SHOPIFY_HEADER_SCRIPT = `
  (function() {
    if (window.__ocdCheckoutHeaderHidden) return;
    window.__ocdCheckoutHeaderHidden = true;

    var styleId = 'ocd-checkout-hide-shopify-header';
    var css =
      '.banner{display:none !important;height:0 !important;min-height:0 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;border:0 !important;}' +
      '.main{padding-top:0 !important;margin-top:0 !important;}';

    function applyHide() {
      if (!document.head) return false;
      var style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      if (style.textContent !== css) {
        style.textContent = css;
      }
      return true;
    }

    function scheduleRetries() {
      var attempts = 0;
      function tick() {
        applyHide();
        attempts += 1;
        if (attempts < 6) {
          setTimeout(tick, attempts < 2 ? 120 : 400);
        }
      }
      tick();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleRetries, { once: true });
    } else {
      scheduleRetries();
    }

    true;
  })();
`;

/**
 * Injected early so price strings stay LTR inside an RTL WebView host.
 *
 * Important implementation notes:
 *  - The previous version of this script wrote text nodes (and called `node.textContent = ...`)
 *    on every MutationObserver tick, which fed back into the same observer and produced
 *    an infinite character-data mutation loop. That loop pegged the WebView's JS thread
 *    on slower devices and left the checkout page blank, so the React Native loader
 *    ("טוען את הקופה המאובטחת...") never went away.
 *  - This version is idempotent: it only mutates a node if the desired value is actually
 *    different from the current value, it tags processed elements with a data attribute,
 *    and it temporarily disconnects the observer while it applies its own changes.
 *  - We also throttle the observer callback with `requestAnimationFrame` so a burst of
 *    mutations from Shopify hydrating the checkout page doesn't trigger N synchronous
 *    re-walks of the DOM.
 */
const CHECKOUT_DIRECTION_FIX_SCRIPT = `
  (function() {
    if (window.__ocdCheckoutDirectionFixInstalled) {
      return;
    }
    window.__ocdCheckoutDirectionFixInstalled = true;

    var styleId = 'ocd-checkout-direction-fix';
    var LRM = '\\u200E';
    var PROCESSED_ATTR = 'data-ocd-direction-fixed';
    var selectors = [
      '[data-checkout-payment-due-target]',
      '[data-checkout-subtotal-price-target]',
      '[data-checkout-total-price-target]',
      '[data-checkout-discount-amount-target]',
      '[data-checkout-shipping-rate-target]',
      '[data-checkout-order-summary-section] .money',
      '.money',
      '.payment-due__price',
      '.payment-due-label__total',
      '.payment-due-label__taxes',
      '.order-summary__emphasis',
      '.order-summary__small-text',
      '.order-summary-toggle__total-recap',
      '.order-summary-toggle__total-recap-final-price',
      '.total-recap',
      '.total-recap__final-price',
      '.product__price',
      '.total-line__price',
      '.reduction-code__text'
    ];
    var paymentDueContainerSelectors = [
      '[data-checkout-payment-due-target]',
      '.payment-due__price',
      '.order-summary-toggle__total-recap',
      '.order-summary-toggle__total-recap-final-price',
      '.total-recap',
      '.total-recap__final-price'
    ];
    var paymentDueValueSelectors = [
      '[data-checkout-payment-due-target]',
      '.payment-due__price',
      '.order-summary-toggle__total-recap-final-price',
      '.total-recap__final-price'
    ];

    function ensureFixStyle() {
      if (!document.head || document.getElementById(styleId)) return;

      var style = document.createElement('style');
      style.id = styleId;
      style.textContent =
        selectors
          .map(function(selector) {
            return selector + ',' + selector + ' *';
          })
          .join(',') +
        '{direction:ltr !important;unicode-bidi:isolate !important;text-align:left !important;}' +
        paymentDueContainerSelectors.join(',') +
        '{display:inline-flex !important;flex-direction:row !important;align-items:baseline !important;justify-content:flex-start !important;gap:4px !important;white-space:nowrap !important;}';
      document.head.appendChild(style);
    }

    function normalizePriceText(text) {
      return String(text || '')
        .replace(/[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]/g, '')
        .replace(/\\s+/g, ' ')
        .trim();
    }

    function fixMirroredAmountTokens(text) {
      return String(text || '').replace(/\\d[\\d.,]*/g, function(token) {
        if (token.indexOf('.') !== -1 && token.indexOf(',') !== -1 && token.indexOf('.') < token.indexOf(',')) {
          return token.split('').reverse().join('');
        }
        return token;
      });
    }

    function parseAmountValue(text) {
      var normalizedText = normalizePriceText(fixMirroredAmountTokens(text));
      var tokens = normalizedText.match(/\\d[\\d.,]*/g);
      if (!tokens || !tokens.length) return null;

      var token = tokens.sort(function(a, b) {
        return b.length - a.length;
      })[0];

      if (token.indexOf(',') !== -1 && token.indexOf('.') !== -1) {
        if (token.lastIndexOf('.') > token.lastIndexOf(',')) {
          token = token.replace(/,/g, '');
        } else {
          token = token.replace(/\\./g, '').replace(',', '.');
        }
      } else if ((token.match(/,/g) || []).length >= 1 && token.indexOf('.') === -1) {
        if (/,[0-9]{2}$/.test(token)) {
          token = token.replace(',', '.');
        } else {
          token = token.replace(/,/g, '');
        }
      }

      var value = Number.parseFloat(token);
      return Number.isFinite(value) ? value : null;
    }

    function formatIlsAmount(value) {
      return '₪ ' + value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function setStyleIfDifferent(node, prop, value) {
      if (node.style[prop] !== value) {
        node.style[prop] = value;
      }
    }

    function setAttrIfDifferent(node, name, value) {
      if (node.getAttribute(name) !== value) {
        node.setAttribute(name, value);
      }
    }

    function normalizePaymentDueValue(node) {
      var amountValue = parseAmountValue(node.textContent);
      if (amountValue == null) return;

      var formattedValue = formatIlsAmount(amountValue);
      if (normalizePriceText(node.textContent) === formattedValue) return;

      node.textContent = formattedValue;
      setStyleIfDifferent(node, 'direction', 'ltr');
      setStyleIfDifferent(node, 'unicodeBidi', 'isolate');
      setStyleIfDifferent(node, 'textAlign', 'left');
      setStyleIfDifferent(node, 'whiteSpace', 'nowrap');
      setAttrIfDifferent(node, 'dir', 'ltr');
    }

    function applyLtrMarks(root) {
      if (!root || !root.childNodes) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var current;
      while ((current = walker.nextNode())) {
        var raw = current.nodeValue;
        if (!raw) continue;
        var normalized = normalizePriceText(fixMirroredAmountTokens(raw));
        if (!/[\\d₪]/.test(normalized)) continue;

        var desired = LRM + normalized + LRM;
        if (raw === desired) continue;
        current.nodeValue = desired;
      }
    }

    function applyPriceDirectionFix() {
      ensureFixStyle();

      var nodes = document.querySelectorAll(selectors.join(','));
      nodes.forEach(function(node) {
        setStyleIfDifferent(node, 'direction', 'ltr');
        setStyleIfDifferent(node, 'unicodeBidi', 'isolate');
        setStyleIfDifferent(node, 'textAlign', 'left');
        setStyleIfDifferent(node, 'display', 'inline-block');
        setAttrIfDifferent(node, 'dir', 'ltr');
        applyLtrMarks(node);
        if (!node.hasAttribute(PROCESSED_ATTR)) {
          node.setAttribute(PROCESSED_ATTR, '1');
        }
      });

      var paymentDueNodes = document.querySelectorAll(paymentDueContainerSelectors.join(','));
      paymentDueNodes.forEach(function(node) {
        setStyleIfDifferent(node, 'display', 'inline-flex');
        setStyleIfDifferent(node, 'flexDirection', 'row');
        setStyleIfDifferent(node, 'alignItems', 'baseline');
        setStyleIfDifferent(node, 'justifyContent', 'flex-start');
        setStyleIfDifferent(node, 'gap', '4px');
        setStyleIfDifferent(node, 'whiteSpace', 'nowrap');
      });

      var paymentDueValueNodes = document.querySelectorAll(paymentDueValueSelectors.join(','));
      paymentDueValueNodes.forEach(function(node) {
        normalizePaymentDueValue(node);
      });
    }

    var observer = null;
    var scheduled = false;
    var applying = false;

    function safeApply() {
      if (applying) return;
      applying = true;
      try {
        if (observer) {
          observer.disconnect();
        }
        applyPriceDirectionFix();
      } catch (e) {
        // Never let our cosmetic fix break the checkout.
      } finally {
        applying = false;
        if (observer && document.documentElement) {
          try {
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              characterData: true
            });
          } catch (_) {}
        }
      }
    }

    function scheduleApply() {
      if (scheduled || applying) return;
      scheduled = true;
      var raf = window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); };
      raf(function() {
        scheduled = false;
        safeApply();
      });
    }

    observer = new MutationObserver(function(mutations) {
      if (applying) return;
      // Skip ticks that are clearly caused by our own characterData writes:
      // if every mutation is on a text node whose parent we already tagged, do nothing.
      var ours = true;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== 'characterData') { ours = false; break; }
        var parent = m.target && m.target.parentElement;
        if (!parent || !parent.hasAttribute(PROCESSED_ATTR)) { ours = false; break; }
      }
      if (ours) return;
      scheduleApply();
    });

    function start() {
      safeApply();
      if (document.documentElement) {
        try {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
          });
        } catch (_) {}
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    true;
  })();
`;

/**
 * Detects Shopify post-purchase / order status URLs so the app can leave the WebView.
 * Paths vary slightly by checkout version; we match common segments.
 */
function isCheckoutSuccessUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/thank_you') ||
    lower.includes('/orders/') ||
    /* Some themes / locales use a hyphenated thank-you path */
    lower.includes('/thank-you')
  );
}

/** Best-effort parse when the thank-you URL/query exposes a numeric order name. */
function extractOrderNumberFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    for (const key of ['order_number', 'order_name', 'order', 'name'] as const) {
      const raw = parsed.searchParams.get(key)?.trim();
      if (!raw) continue;
      const match = raw.match(/(\d{3,})/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // ignore malformed URLs
  }
  const pathMatch = url.match(/\/orders\/(\d{3,})\b/i);
  return pathMatch?.[1];
}

/**
 * Scrapes the Shopify thank-you / order-status DOM for a human order number (#1234).
 * Posts `{ type: 'ocdCheckoutSuccess', orderNumber }` back to React Native.
 */
const CHECKOUT_ORDER_NUMBER_SCRIPT = `
  (function() {
    function findOrderNumber() {
      var selectors = [
        '[data-order-id]',
        '.os-order-number',
        '[class*="order-number"]',
        '[class*="OrderNumber"]',
        '[data-testid*="order"]'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (!el) continue;
        var t = (el.getAttribute('data-order-id') || el.textContent || '').trim();
        var m = t.match(/#?\\s*(\\d{3,})/);
        if (m) return m[1];
      }
      var body = (document.body && document.body.innerText) || '';
      var patterns = [
        /#\\s*(\\d{3,})/,
        /Order\\s+#?(\\d{3,})/i,
        /הזמנה\\s+#?(\\d{3,})/,
        /מספר הזמנה[:\\s]+#?(\\d{3,})/
      ];
      for (var j = 0; j < patterns.length; j++) {
        var match = body.match(patterns[j]);
        if (match) return match[1];
      }
      return null;
    }
    var n = findOrderNumber();
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ocdCheckoutSuccess',
        orderNumber: n
      }));
    }
    true;
  })();
`;

export type CheckoutCompleteInfo = {
  orderNumber?: string;
};

export type CheckoutScreenProps = {
  checkoutUrl: string;
  onBack: () => void;
  /** Called once when the WebView reaches a thank-you or order URL after payment. */
  onCheckoutComplete?: (info?: CheckoutCompleteInfo) => void;
};

export function CheckoutScreen({ checkoutUrl, onBack, onCheckoutComplete }: CheckoutScreenProps) {
  const insets = useSafeAreaInsets();
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const completeRef = useRef(false);
  const pendingSuccessUrlRef = useRef<string | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView>(null);
  const initialLoadResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const prepareLaunchUrl = async () => {
      setLaunchUrl(null);
      setLoadError(null);
      setInitialLoading(true);
      initialLoadResolvedRef.current = false;

      try {
        const resolved = await resolveCheckoutLaunchUrl(checkoutUrl);
        if (!cancelled) setLaunchUrl(resolved);
      } catch {
        if (!cancelled) setLaunchUrl(normalizeCheckoutUrl(checkoutUrl));
      }
    };

    void prepareLaunchUrl();

    return () => {
      cancelled = true;
    };
  }, [checkoutUrl, webViewKey]);

  const resolveInitialLoad = useCallback(() => {
    if (initialLoadResolvedRef.current) return;
    initialLoadResolvedRef.current = true;
    setInitialLoading(false);
  }, []);

  // Safety net: never let the loader sit on top of the WebView for more
  // than 15 seconds. If Shopify is genuinely down we'll surface the
  // underlying WebView (which will show its own error UI) instead of an
  // infinite spinner with no way out except the close button.
  useEffect(() => {
    if (!initialLoading) return;
    const timer = setTimeout(() => {
      resolveInitialLoad();
    }, 15000);
    return () => clearTimeout(timer);
  }, [initialLoading, resolveInitialLoad, webViewKey]);

  const finishCheckout = useCallback(
    (orderNumber?: string) => {
      if (!onCheckoutComplete || completeRef.current) return;
      completeRef.current = true;
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
      const fromUrl = pendingSuccessUrlRef.current
        ? extractOrderNumberFromUrl(pendingSuccessUrlRef.current)
        : undefined;
      onCheckoutComplete({ orderNumber: orderNumber || fromUrl });
    },
    [onCheckoutComplete]
  );

  const tryComplete = useCallback(
    (url: string | undefined) => {
      if (!url || !onCheckoutComplete || completeRef.current) return;
      if (!isCheckoutSuccessUrl(url)) return;
      if (pendingSuccessUrlRef.current === url) return;
      pendingSuccessUrlRef.current = url;

      // Give the thank-you page a moment to render, then scrape the order number.
      const scrape = () => {
        webViewRef.current?.injectJavaScript(CHECKOUT_ORDER_NUMBER_SCRIPT);
      };
      setTimeout(scrape, 350);
      setTimeout(scrape, 900);

      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = setTimeout(() => {
        finishCheckout(extractOrderNumberFromUrl(url));
      }, 1600);
    },
    [finishCheckout, onCheckoutComplete]
  );

  useEffect(
    () => () => {
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    },
    []
  );

  const onNavigationStateChange = useCallback(
    (state: WebViewNavigation) => {
      const trimmedTitle = state?.title?.trim();
      if (trimmedTitle) {
        resolveInitialLoad();
      }
      tryComplete(state?.url);
    },
    [resolveInitialLoad, tryComplete]
  );

  const onWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          orderNumber?: string | null;
        };
        if (data?.type !== 'ocdCheckoutSuccess') return;
        finishCheckout(data.orderNumber ?? undefined);
      } catch {
        // ignore non-JSON messages from the page
      }
    },
    [finishCheckout]
  );

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setInitialLoading(true);
    initialLoadResolvedRef.current = false;
    completeRef.current = false;
    pendingSuccessUrlRef.current = null;
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
    setWebViewKey((k) => k + 1);
  }, []);

  const showWebViewLoader = initialLoading && !loadError && !!launchUrl;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: '#000000', paddingTop: insets.top }}>
        <View style={{ paddingVertical: 7, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            משלוחים חינם בהזמנות מעל 299₪
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F0',
        }}
      >
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 6,
          }}
        >
          <View style={{ width: 44, alignItems: 'center' }}>
            <Pressable
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="סגירת קופה"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Ionicons name="close-outline" size={22} color="#111827" />
            </Pressable>
          </View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../../assets/logopng/OCDLOGO-04.png')}
              style={{ width: 115, height: 42 }}
              resizeMode="contain"
            />
          </View>

          <View style={{ width: 44, height: 40 }} />
        </View>
      </View>

      {!!loadError && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: '#FEF2F2',
            borderBottomWidth: 1,
            borderBottomColor: '#FECACA',
            gap: 10,
          }}
        >
          <Text style={{ color: '#991B1B', fontWeight: '800', ...RTL_TEXT }}>{loadError}</Text>
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: '#0F172A',
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>נסה שוב</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {(showWebViewLoader || !launchUrl) && !loadError && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F8FAFC',
              zIndex: 1,
              gap: 12,
            }}
            pointerEvents="none"
          >
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={{ color: '#475569', fontWeight: '800', ...RTL_TEXT }}>טוען את הקופה המאובטחת...</Text>
          </View>
        )}

        {launchUrl ? (
          <WebView
            ref={webViewRef}
            key={webViewKey}
            style={{ flex: 1, backgroundColor: '#FFFFFF' }}
            source={{ uri: launchUrl }}
            userAgent={MOBILE_SAFARI_UA}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            injectedJavaScriptBeforeContentLoaded={CHECKOUT_DIRECTION_FIX_SCRIPT}
            injectedJavaScript={`${CHECKOUT_DIRECTION_FIX_SCRIPT}\n${CHECKOUT_HIDE_SHOPIFY_HEADER_SCRIPT}`}
            onLoadStart={() => {
              setLoadError(null);
            }}
            onLoadEnd={resolveInitialLoad}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 0.6) {
                resolveInitialLoad();
              }
            }}
            onError={() => {
              resolveInitialLoad();
              setLoadError('לא הצלחנו לטעון את עמוד התשלום. בדוק את החיבור לאינטרנט ונסה שוב.');
            }}
            onHttpError={(e) => {
              const { statusCode, url } = e.nativeEvent;
              if (!isCheckoutHttpErrorBlocking(statusCode, url)) return;
              resolveInitialLoad();
              setLoadError(`שגיאת שרת (${statusCode}) בטעינת הקופה.`);
            }}
            onMessage={onWebViewMessage}
            onNavigationStateChange={onNavigationStateChange}
            onShouldStartLoadWithRequest={(req) => {
              tryComplete(req.url);
              return true;
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
