import React from 'react';
import { StyleSheet, View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors, withAlpha } from '../theme';

// iOS 26 液态玻璃风格图标按钮 —— 半透明磨砂 + 顶部高光折射 + 柔和投影
interface Props {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size?: number;
  color?: string;
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE = 38;

export default function GlassIconButton({
  name,
  size = 18,
  color,
  active = false,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const iconColor = color ?? (active ? themeColors.primary : themeColors.textPrimary);
  const glassBg = active
    ? withAlpha(themeColors.primary, 0.20)
    : 'rgba(255, 255, 255, 0.55)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
    >
      <BlurView
        intensity={active ? 40 : 30}
        tint="light"
        style={[styles.glass, { backgroundColor: glassBg }]}
      >
        {/* 顶部高光 —— 模拟光线折射的液态玻璃质感 */}
        <View style={styles.highlight} pointerEvents="none" />
        <MaterialCommunityIcons name={name} size={size} color={iconColor} />
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: SIZE / 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  glass: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.88,
  },
});
