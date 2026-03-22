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
    function applyPriceDirectionFix() {
      var selectors = [
        '[data-checkout-payment-due-target]',
        '[data-checkout-subtotal-price-target]',
        '[data-checkout-total-price-target]',
        '[data-checkout-discount-amount-target]',
        '[data-checkout-shipping-rate-target]',
        '[data-checkout-order-summary-section] .money',
        '.money',
        '.payment-due__price',
        '.order-summary__emphasis',
        '.order-summary__small-text',
        '.product__price',
        '.total-line__price',
        '.reduction-code__text'
      ];

      var nodes = document.querySelectorAll(selectors.join(','));
      nodes.forEach(function(node) {
        node.style.direction = 'ltr';
        node.style.unicodeBidi = 'embed';
        node.style.textAlign = 'left';
        node.style.display = 'inline-block';
        node.setAttribute('dir', 'ltr');
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
