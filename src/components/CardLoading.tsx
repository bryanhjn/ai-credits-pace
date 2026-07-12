import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { themeColors } from '../theme';

interface Props {
  loading: boolean;
}

// 卡片内 Loading 覆盖层，毛玻璃质感 + 渐入渐出。父容器需 position: relative
export default function CardLoading({ loading }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 1 : 0,
      duration: 200,
      easing: loading ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [loading, fadeAnim]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents={loading ? 'auto' : 'none'}
    >
      <BlurView
        intensity={25}
        tint="light"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <ActivityIndicator size="small" color={themeColors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    zIndex: 10,
  },
});
