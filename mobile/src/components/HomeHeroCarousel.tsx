import { radii } from '../theme/radii';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSiteHomeExperience } from '../hooks/useSiteHomeExperience';
import type { HomeHeroSlide, SiteLinkTarget } from '../lib/siteHomeContent';

const FALLBACK_VIDEO = require('../../assets/brands/video/newvid2.mp4');
const FALLBACK_WIDTH = 834;
const FALLBACK_HEIGHT = 1112;

function RemoteHeroVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (video) => {
    video.loop = true;
    video.muted = true;
    video.play();
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

function HeroSlideFrame({
  slide,
  active,
  onPress,
}: {
  slide: HomeHeroSlide;
  active: boolean;
  onPress: (slide: HomeHeroSlide) => void;
}) {
  const opacity = React.useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents={active ? 'auto' : 'none'}>
      {slide.kind === 'video' ? (
        <RemoteHeroVideo uri={slide.url} active={active} />
      ) : (
        <Image source={{ uri: slide.url }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={slide.alt} />
      )}
      {slide.target ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={slide.ctaLabel || slide.alt || 'באנר'}
          onPress={() => onPress(slide)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {active && slide.ctaLabel ? (
        <View pointerEvents="none" style={styles.ctaWrap}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{slide.ctaLabel}</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function HomeHeroCarousel({
  screenWidth,
  onOpenTarget,
}: {
  screenWidth: number;
  onOpenTarget: (target: SiteLinkTarget, title?: string) => void;
}) {
  const { data, isLoading, isError } = useSiteHomeExperience();
  const slides = data?.slides ?? [];
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const signature = slides.map((slide) => `${slide.url}:${slide.durationMs}:${slide.ctaLabel ?? ''}`).join('|');

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  useEffect(() => {
    if (!focused || slides.length < 2) return;
    const current = slides[index] ?? slides[0];
    if (!current) return;
    const timer = setTimeout(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, current.durationMs);
    return () => clearTimeout(timer);
  }, [focused, index, signature, slides]);

  const active = slides[index] ?? slides[0];
  const width = active?.width || 1248;
  const height = active?.height || 1664;
  const frameHeight = Math.round(screenWidth * (height / width));

  if (!slides.length) {
    if (isLoading) {
      return (
        <View style={{ width: screenWidth, height: Math.round(screenWidth * (1664 / 1248)), backgroundColor: '#F6F3EE', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#111111" />
        </View>
      );
    }
    if (isError) {
      return <FallbackHeroVideo screenWidth={screenWidth} />;
    }
    return null;
  }

  return (
    <View style={{ width: screenWidth, height: frameHeight, backgroundColor: '#F6F3EE', overflow: 'hidden' }}>
      {slides.map((slide, slideIndex) => (
        <HeroSlideFrame
          key={slide.id}
          slide={slide}
          active={focused && slideIndex === index}
          onPress={(pressed) => {
            if (pressed.target) onOpenTarget(pressed.target, pressed.alt);
          }}
        />
      ))}
    </View>
  );
}

function FallbackHeroVideo({ screenWidth }: { screenWidth: number }) {
  const height = Math.round(screenWidth * (FALLBACK_HEIGHT / FALLBACK_WIDTH));
  const player = useVideoPlayer(FALLBACK_VIDEO, (video) => {
    video.loop = true;
    video.muted = true;
    video.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: screenWidth, height }}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

const styles = StyleSheet.create({
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: 'center',
  },
  cta: {
    minWidth: 176,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(27,27,27,0.82)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
