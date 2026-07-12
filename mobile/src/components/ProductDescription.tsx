import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCollapsedProductDescriptionBlocks,
  parseProductDescription,
  shouldCollapseProductDescription,
  type ProductDescriptionBlock,
} from '../lib/productDescription';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const FADE_HEIGHT = 72;

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type ProductDescriptionProps = {
  description: string;
  descriptionHtml?: string | null;
  emptyMessage?: string;
  textStyle?: TextStyle;
  toggleColor?: string;
  /** צבע הרקע שאליו הגרדיאנט נמוג — צריך להתאים לרקע העמוד */
  fadeColor?: string;
};

function DescriptionBlocks({
  blocks,
  textStyle,
}: {
  blocks: ProductDescriptionBlock[];
  textStyle: TextStyle;
}) {
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((block, index) => {
        if (block.type === 'bullet') {
          return (
            <View key={`bullet-${index}`} style={{ gap: 8 }}>
              {block.items.map((item, itemIndex) => (
                <View
                  key={`bullet-${index}-${itemIndex}`}
                  style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 }}
                >
                  <Text style={{ color: '#C18D39', fontSize: 16, lineHeight: 24, fontWeight: '800' }}>•</Text>
                  <Text style={{ flex: 1, ...textStyle }}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={`paragraph-${index}`} style={textStyle}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

export function ProductDescription({
  description,
  descriptionHtml,
  emptyMessage,
  textStyle,
  toggleColor = '#0F172A',
  fadeColor = '#FFFFFF',
}: ProductDescriptionProps) {
  const blocks = useMemo(
    () => parseProductDescription(description, descriptionHtml, emptyMessage),
    [description, descriptionHtml, emptyMessage],
  );
  const canCollapse = useMemo(() => shouldCollapseProductDescription(blocks), [blocks]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [description, descriptionHtml]);

  const visibleBlocks = expanded || !canCollapse ? blocks : getCollapsedProductDescriptionBlocks(blocks);

  const mergedTextStyle: TextStyle = {
    color: '#475569',
    lineHeight: 26,
    fontSize: 14.5,
    ...RTL_TEXT,
    ...textStyle,
  };

  const showFade = canCollapse && !expanded;
  const fadeColors = useMemo(
    () => [withAlpha(fadeColor, 0), withAlpha(fadeColor, 0.55), withAlpha(fadeColor, 0.92), fadeColor],
    [fadeColor],
  );

  return (
    <View>
      <View style={styles.contentWrap}>
        <DescriptionBlocks blocks={visibleBlocks} textStyle={mergedTextStyle} />

        {showFade ? (
          <LinearGradient
            pointerEvents="none"
            colors={fadeColors}
            locations={[0, 0.35, 0.72, 1]}
            style={styles.fadeOverlay}
          />
        ) : null}
      </View>

      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'הצג פחות' : 'קרא עוד'}
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: 'flex-end',
            marginTop: showFade ? -6 : 8,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text
            style={{
              color: toggleColor,
              fontSize: 14,
              fontWeight: '800',
              lineHeight: 20,
              textAlign: 'right',
              writingDirection: 'rtl',
            }}
          >
            {expanded ? 'הצג פחות ▲' : 'קרא עוד ▼'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    position: 'relative',
  },
  fadeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
});
