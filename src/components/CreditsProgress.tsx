import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors, getCreditsColor } from '../theme';

interface Props {
  used: number;
  total: number;
  percent: number;
  onEdit: () => void;
}

export default function CreditsProgress({ used, total, percent, onEdit }: Props) {
  const ratio = total > 0 ? used / total : 0;
  const progress = Math.min(ratio, 1);
  const color = getCreditsColor(ratio);
  const overBudget = ratio > 1;

  return (
    <Card style={styles.card} mode="elevated">
      <View style={styles.cardInner}>
        {/* 进度填充背景 */}
        <View
          style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]}
        />
        {/* 内容层 */}
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="robot"
              size={22}
              color={color}
            />
            <Text variant="titleMedium" style={styles.title}>AI Credits</Text>
            <View style={styles.headerSpacer} />
            <IconButton
              icon="pencil"
              size={20}
              onPress={onEdit}
              iconColor={themeColors.textSecondary}
              style={styles.editBtn}
              accessibilityLabel="编辑 Credits"
            />
          </View>

          <View style={styles.metrics}>
            <View style={styles.metricMain}>
              <Text style={[styles.usedNum, { color }]}>{formatNum(used)}</Text>
              <Text style={styles.metricLabel}>已使用</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricMain}>
              <Text style={styles.totalNum}>{formatNum(total)}</Text>
              <Text style={styles.metricLabel}>总额度</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricMain}>
              <Text style={[styles.percentNum, { color }]}>{percent}%</Text>
              <Text style={styles.metricLabel}>使用率</Text>
            </View>
          </View>

          {overBudget && (
            <View style={styles.warningBadge}>
              <MaterialCommunityIcons name="alert-circle" size={14} color="#FFFFFF" />
              <Text style={styles.warningText}>
                超预算 {Math.round((ratio - 1) * 100)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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
    opacity: 0.22,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  headerSpacer: {
    flex: 1,
  },
  editBtn: {
    margin: 0,
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
  usedNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  totalNum: {
    fontSize: 28,
    fontWeight: '800',
    color: themeColors.textPrimary,
  },
  percentNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: themeColors.creditsDanger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    marginTop: 10,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});