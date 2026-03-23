import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const CHECKOUT_DIRECTION_FIX_SCRIPT = `
  (function() {
    var styleId = 'ocd-checkout-direction-fix';
    var LRM = '\\u200E';
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
      if (document.getElementById(styleId)) return;

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

    function normalizePaymentDueValue(node) {
      var amountValue = parseAmountValue(node.textContent);
      if (amountValue == null) return;

      var formattedValue = formatIlsAmount(amountValue);
      if (normalizePriceText(node.textContent) === formattedValue) return;

      node.textContent = formattedValue;
      node.style.direction = 'ltr';
      node.style.unicodeBidi = 'isolate';
      node.style.textAlign = 'left';
      node.style.whiteSpace = 'nowrap';
      node.setAttribute('dir', 'ltr');
    }

    function applyLtrMarks(root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var current;
      while ((current = walker.nextNode())) {
        var normalized = normalizePriceText(fixMirroredAmountTokens(current.nodeValue));
        if (!/[\\d₪]/.test(normalized)) continue;
        current.nodeValue = LRM + normalized + LRM;
      }
    }

    function applyPriceDirectionFix() {
      ensureFixStyle();

      var nodes = document.querySelectorAll(selectors.join(','));
      nodes.forEach(function(node) {
        node.style.direction = 'ltr';
        node.style.unicodeBidi = 'isolate';
        node.style.textAlign = 'left';
        node.style.display = 'inline-block';
        node.setAttribute('dir', 'ltr');
        applyLtrMarks(node);
      });

      var paymentDueNodes = document.querySelectorAll(paymentDueContainerSelectors.join(','));
      paymentDueNodes.forEach(function(node) {
        node.style.display = 'inline-flex';
        node.style.flexDirection = 'row';
        node.style.alignItems = 'baseline';
        node.style.justifyContent = 'flex-start';
        node.style.gap = '4px';
        node.style.whiteSpace = 'nowrap';
      });

      var paymentDueValueNodes = document.querySelectorAll(paymentDueValueSelectors.join(','));
      paymentDueValueNodes.forEach(function(node) {
        normalizePaymentDueValue(node);
      });
    }

    applyPriceDirectionFix();

    var observer = new MutationObserver(function() {
      applyPriceDirectionFix();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    true;
  })();
`;

export function StoreCheckoutScreen({
  checkoutUrl,
  onBack,
}: {
  checkoutUrl: string;
  onBack: () => void;
}) {
  const [pageTitle, setPageTitle] = useState('תשלום מאובטח');
  const [loading, setLoading] = useState(true);

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
          <Text style={{ marginTop: 6, color: '#0F172A', fontSize: 20, fontWeight: '900', ...RTL_TEXT }}>
            {pageTitle}
          </Text>
          <Text style={{ marginTop: 4, color: '#64748B', fontSize: 12, ...RTL_TEXT }}>
            התשלום והשילוח מתבצעים ישירות דרך עמוד הקופה המאובטח של Shopify.
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {loading && (
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
          >
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={{ color: '#475569', fontWeight: '800', ...RTL_TEXT }}>טוען את הקופה המאובטחת...</Text>
          </View>
        )}

        <WebView
          source={{ uri: checkoutUrl }}
          startInLoadingState
          injectedJavaScriptBeforeContentLoaded={CHECKOUT_DIRECTION_FIX_SCRIPT}
          injectedJavaScript={CHECKOUT_DIRECTION_FIX_SCRIPT}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(state) => {
            if (state.title?.trim()) {
              setPageTitle(state.title.trim());
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}
