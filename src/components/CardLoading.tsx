import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ActivityIndicator } from 'react-native';
import { themeColors } from '../theme';

interface Props {
  loading: boolean;
}

// 卡片内 Loading 覆盖层，带渐入渐出动画。父容器需 position: relative
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
      <ActivityIndicator size="small" color={themeColors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    zIndex: 10,
  },
});
