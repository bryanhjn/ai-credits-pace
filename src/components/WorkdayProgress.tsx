import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors } from '../theme';

interface Props {
  passed: number;
  total: number;
  percent: number;
  monthTitle: string;
}

export default function WorkdayProgress({ passed, total, percent, monthTitle }: Props) {
  const progress = total > 0 ? passed / total : 0;

  return (
    <Card style={styles.card} mode="elevated">
      <View style={styles.cardInner}>
        {/* 进度填充背景 */}
        <View
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
        {/* 内容层 */}
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={22}
              color={themeColors.primary}
            />
            <Text variant="titleMedium" style={styles.title}>工作日</Text>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metricMain}>
              <Text style={styles.passedNum}>{passed}</Text>
              <Text style={styles.metricLabel}>已度过</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricMain}>
              <Text style={styles.totalNum}>{total}</Text>
              <Text style={styles.metricLabel}>总工作日</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricMain}>
              <Text style={styles.percentNum}>{percent}%</Text>
              <Text style={styles.metricLabel}>进度</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: themeColors.surface,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardInner: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: themeColors.primary,
    opacity: 0.22,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: themeColors.textPrimary,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricMain: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: themeColors.divider,
  },
  passedNum: {
    fontSize: 28,
    fontWeight: '800',
    color: themeColors.primary,
  },
  totalNum: {
    fontSize: 28,
    fontWeight: '800',
    color: themeColors.textPrimary,
  },
  percentNum: {
    fontSize: 28,
    fontWeight: '800',
    color: themeColors.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
});