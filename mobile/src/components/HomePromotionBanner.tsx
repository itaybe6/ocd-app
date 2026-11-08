import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { safeNavigate } from '../navigation/navigationRef';

// Dedicated three-bottle product, not three units at the single-bottle price.
export const VITRO_TRIO_HANDLE = 'מארז-3-ויטרו-750-מל-רק-ב-99-שח';

export function HomePromotionBanner() {
  return <Pressable
    onPress={() => safeNavigate('Product', { handle: VITRO_TRIO_HANDLE })}
    accessibilityRole="button"
    accessibilityLabel="מבצע: 3 ויטרו פלוס, 750 מ״ל לכל בקבוק, ב־99 שקלים. לקניית המארז"
    style={styles.banner}
  >
    <View style={styles.artwork} pointerEvents="none">
      <Image source={require('../../assets/vitro-trio-editorial-v2.jpg')} resizeMode="cover" style={styles.image} accessible={false} />
    </View>
    <View style={styles.copy} pointerEvents="none">
      <Text style={styles.eyebrow}>שלישייה במחיר מיוחד</Text>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>3 ויטרו פלוס</Text>
      <Text style={styles.size}>750 מ״ל לכל בקבוק</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>99</Text><Text style={styles.currency}>₪</Text>
      </View>
      <View style={styles.action}><Text style={styles.actionText}>לקניית המארז</Text><ArrowLeft size={15} strokeWidth={1.7} color="#252525" /></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  banner: { alignSelf: 'center', width: '100%', maxWidth: 560, aspectRatio: 2, minHeight: 184, direction: 'ltr', flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#FFFFFF', overflow: 'hidden', marginBottom: 2 },
  artwork: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  image: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  copy: { width: '46%', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18, paddingLeft: 2, paddingVertical: 14 },
  eyebrow: { fontSize: 10, lineHeight: 16, color: '#777777', textAlign: 'right', writingDirection: 'rtl' },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: '#171717', textAlign: 'right', writingDirection: 'rtl', width: '100%', marginTop: 1 },
  size: { fontSize: 11, lineHeight: 17, color: '#777777', textAlign: 'right', writingDirection: 'rtl' },
  priceRow: { direction: 'ltr', flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  price: { color: '#171717', fontSize: 39, lineHeight: 45, fontWeight: '800' },
  currency: { color: '#171717', fontSize: 19, fontWeight: '500' },
  action: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: '#D4D4D4', paddingVertical: 5 },
  actionText: { color: '#252525', fontSize: 11, lineHeight: 17, fontWeight: '600', writingDirection: 'rtl' },
});
