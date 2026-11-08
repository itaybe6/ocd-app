import { storeAccent } from '../theme/storeAccent';
import { radii } from '../theme/radii';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bestBundleQty, type ProductBundleTier } from '../lib/productBundles';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

type BundleChoice = {
  qty: number;
  label: string;
  price: number;
  variantId: string | null;
};

function formatShekel(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `₪${rounded.toLocaleString('he-IL')}`;
  return `₪${rounded.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProductBundlePicker({
  unitPrice,
  tiers,
  selectedQty,
  onSelect,
}: {
  unitPrice: number;
  tiers: ProductBundleTier[];
  selectedQty: number;
  onSelect: (qty: number) => void;
}) {
  const choices = useMemo<BundleChoice[]>(
    () => [
      { qty: 1, label: 'יחידה', price: unitPrice, variantId: null },
      ...tiers.map((tier) => ({
        qty: tier.qty,
        label: tier.label,
        price: tier.price,
        variantId: tier.variantId,
      })),
    ],
    [tiers, unitPrice],
  );
  const bestQty = bestBundleQty(tiers);

  if (unitPrice <= 0 || tiers.length === 0) return null;

  return (
    <View style={{ paddingTop: 22, paddingHorizontal: 20, gap: 14 }}>
      <Text style={{ color: '#202124', fontSize: 16, fontWeight: '600', ...RTL_TEXT }}>קנו עוד ושלמו פחות</Text>

      <View style={{ gap: 10 }}>
        {choices.map((choice) => {
          const selected = choice.qty === selectedQty;
          const perUnit = choice.price / choice.qty;
          const regularTotal = unitPrice * choice.qty;
          const savings = Math.max(0, regularTotal - choice.price);
          const discountPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;
          const isBest = bestQty === choice.qty && choice.qty > 1;

          return (
            <Pressable
              key={`${choice.qty}-${choice.variantId ?? 'unit'}`}
              onPress={() => onSelect(choice.qty)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              style={{
                position: 'relative',
                borderRadius: radii.surface,
                borderWidth: 1,
                borderColor: selected ? storeAccent.primary : '#E7E8EA',
                backgroundColor: selected ? storeAccent.soft : '#FFFFFF',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              {isBest ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: 16,
                    backgroundColor: storeAccent.primary,
                    borderRadius: radii.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>הכי משתלם</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radii.pill,
                    borderWidth: 1.5,
                    borderColor: selected ? storeAccent.primary : '#D8DADD',
                    backgroundColor: selected ? storeAccent.primary : '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ color: '#202124', fontSize: 15, fontWeight: '600', ...RTL_TEXT }}>{choice.label}</Text>
                    {savings > 0 ? (
                      <View style={{ backgroundColor: storeAccent.soft, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: storeAccent.ink, fontSize: 11.5, fontWeight: '700' }}>
                          חיסכון של {formatShekel(Math.round(savings))}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: '#71717A', fontSize: 12.5, fontWeight: '500', ...RTL_TEXT }}>
                    {discountPercent > 0 ? `${discountPercent}% הנחה` : `${choice.qty} יח' במחיר רגיל`}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={{ color: storeAccent.ink, fontSize: 16, fontWeight: '600' }}>
                    {formatShekel(perUnit)}
                    <Text style={{ color: '#71717A', fontSize: 12, fontWeight: '600' }}> ליח'</Text>
                  </Text>
                  {savings > 0 ? (
                    <Text
                      style={{
                        color: '#71717A',
                        fontSize: 12.5,
                        fontWeight: '600',
                        textDecorationLine: 'line-through',
                      }}
                    >
                      {formatShekel(Math.round(unitPrice))}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
