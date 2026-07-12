import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  progress: number; // 0..1
  lightColor: string; // hex
  darkColor: string; // hex
  lightAlpha: number;
  darkAlpha: number;
}

// 波浪参数
const AMPLITUDE = 4; // 水平振幅 px
const WAVELENGTH = 150; // 垂直波长 px
const SAMPLE_STEP = 2; // 采样步长 px（越小越平滑）
const ANGULAR_SPEED = (2 * Math.PI) / 7; // 相位推进速度 rad/s（约 2.5s 一个周期）

export default function WaveProgressFill({ progress, lightColor, darkColor, lightAlpha, darkAlpha }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // 进度 > 0 时持续推动相位，让右边缘水波沿垂直方向流动
  useEffect(() => {
    if (size.width === 0 || progress <= 0) return;
    const loop = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = (t - startRef.current) / 1000;
      setPhase(elapsed * ANGULAR_SPEED);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, [size.width, progress]);

  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const progressWidth = clampedProgress * size.width;

  const path = useMemo(() => {
    const { width, height } = size;
    if (width === 0 || height === 0) return '';
    const pw = clampedProgress * width;
    // 顶边到波浪起点
    let d = `M 0 0 L ${pw.toFixed(2)} 0`;
    // 沿右侧边生成正弦波（向下），加入时间相位使其流动
    for (let y = 0; y <= height; y += SAMPLE_STEP) {
      const x = pw + AMPLITUDE * Math.sin((2 * Math.PI * y) / WAVELENGTH + phase);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    // 底边回到左下角并闭合
    d += ` L 0 ${height.toFixed(2)} Z`;
    return d;
  }, [size, clampedProgress, phase]);

  return (
    <View
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient
              id="waveGrad"
              x1="0"
              y1="0"
              x2={progressWidth || 1}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={lightColor} stopOpacity={lightAlpha} />
              <Stop offset="1" stopColor={darkColor} stopOpacity={darkAlpha} />
            </LinearGradient>
          </Defs>
          <Path d={path} fill="url(#waveGrad)" />
        </Svg>
      )}
    </View>
  );
}
