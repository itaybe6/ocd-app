import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

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

export type CheckoutScreenProps = {
  checkoutUrl: string;
  onBack: () => void;
  /** Called once when the WebView reaches a thank-you or order URL after payment. */
  onCheckoutComplete?: () => void;
};

export function CheckoutScreen({ checkoutUrl, onBack, onCheckoutComplete }: CheckoutScreenProps) {
  const [pageTitle, setPageTitle] = useState('תשלום מאובטח');
  // We only block the UI with a full-screen spinner for the *first* load.
  // Shopify's checkout fires onLoadStart/onLoadEnd many times as the customer
  // moves through information → shipping → payment, and on slower connections
  // we observed the loader occasionally getting stuck because a later
  // load event never resolved. Keeping the spinner scoped to the initial load
  // means the worst case is a brief blank WebView, never a permanent block.
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const completeRef = useRef(false);
  const initialLoadResolvedRef = useRef(false);

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

  const tryComplete = useCallback(
    (url: string | undefined) => {
      if (!url || !onCheckoutComplete || completeRef.current) return;
      if (!isCheckoutSuccessUrl(url)) return;
      completeRef.current = true;
      onCheckoutComplete();
    },
    [onCheckoutComplete]
  );

  const onNavigationStateChange = useCallback(
    (state: WebViewNavigation) => {
      const trimmedTitle = state?.title?.trim();
      if (trimmedTitle) {
        setPageTitle(trimmedTitle);
        // The first time the WebView actually navigates somewhere with a real
        // title, we know the page is alive — drop the spinner.
        resolveInitialLoad();
      }
      tryComplete(state?.url);
    },
    [resolveInitialLoad, tryComplete]
  );

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setInitialLoading(true);
    initialLoadResolvedRef.current = false;
    completeRef.current = false;
    setWebViewKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 12,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            maxWidth: 44,
            maxHeight: 44,
            borderRadius: 22,
            alignSelf: 'flex-start',
            flexShrink: 0,
            overflow: 'hidden',
            opacity: pressed ? 0.94 : 1,
          })}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F8FAFC',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              alignSelf: 'flex-start',
              flexShrink: 0,
            }}
          >
            <Ionicons name="close-outline" size={22} color="#0F172A" />
          </View>
        </Pressable>

        <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
          <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, ...RTL_TEXT }}>
            SHOPIFY CHECKOUT
          </Text>
          <Text style={{ marginTop: 6, color: '#0F172A', fontSize: 20, fontWeight: '900', ...RTL_TEXT }}>{pageTitle}</Text>
          <Text style={{ marginTop: 4, color: '#64748B', fontSize: 12, ...RTL_TEXT }}>
            התשלום והשילוח מתבצעים ישירות דרך עמוד הקופה המאובטח של Shopify.
          </Text>
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
        {initialLoading && !loadError && (
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

        <WebView
          key={webViewKey}
          source={{ uri: checkoutUrl }}
          injectedJavaScriptBeforeContentLoaded={CHECKOUT_DIRECTION_FIX_SCRIPT}
          injectedJavaScript={CHECKOUT_DIRECTION_FIX_SCRIPT}
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
            const status = e.nativeEvent.statusCode;
            if (status >= 400) {
              resolveInitialLoad();
              setLoadError(`שגיאת שרת (${status}) בטעינת הקופה.`);
            }
          }}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={(req) => {
            tryComplete(req.url);
            return true;
          }}
        />
      </View>
    </SafeAreaView>
  );
}
