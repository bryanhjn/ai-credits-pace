import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors, withAlpha } from '../theme';
import CardLoading from './CardLoading';
import WaveProgressFill from './WaveProgressFill';

interface Props {
  passed: number;
  total: number;
  percent: number;
  monthTitle: string;
  loading?: boolean;
}

export default function WorkdayProgress({ passed, total, percent, monthTitle, loading }: Props) {
  const progress = total > 0 ? passed / total : 0;

  return (
    <Card style={styles.card} mode="elevated">
      <View style={styles.cardInner}>
        {/* 进度填充背景 —— 左浅右深渐变 + 右侧水波边缘 */}
        <WaveProgressFill
          progress={progress}
          lightColor={themeColors.primaryLight}
          darkColor={themeColors.primaryDark}
          lightAlpha={0.12}
          darkAlpha={0.38}
        />
        {/* 内容层 */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconChip, { backgroundColor: withAlpha(themeColors.primary, 0.12) }]}>
              <MaterialCommunityIcons
                name="calendar-check"
                size={22}
                color={themeColors.primary}
              />
            </View>
            <Text variant="titleMedium" style={styles.title}>工作日</Text>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metricMain}>
              <Text style={styles.passedNum}>{passed}</Text>
              <Text style={styles.metricLabel}>已度过</Text>
            </View>
            <View style={styles.metricMain}>
              <Text style={styles.totalNum}>{total}</Text>
              <Text style={styles.metricLabel}>总工作日</Text>
            </View>
            <View style={styles.metricMain}>
              <Text style={styles.percentNum}>{percent}%</Text>
              <Text style={styles.metricLabel}>进度</Text>
            </View>
          </View>
        </View>
        <CardLoading loading={!!loading} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.hairline,
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  cardInner: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.1,
    color: themeColors.textPrimary,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricMain: {
    alignItems: 'center',
    flex: 1,
  },
  passedNum: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: themeColors.primary,
  },
  totalNum: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: themeColors.textPrimary,
  },
  percentNum: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: themeColors.primary,
  },
  metricLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
    color: themeColors.textMuted,
    marginTop: 4,
  },
});
