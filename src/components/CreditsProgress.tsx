import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { themeColors, getCreditsColor, getCreditsDarkColor, withAlpha } from '../theme';
import CardLoading from './CardLoading';
import WaveProgressFill from './WaveProgressFill';

interface Props {
  used: number;
  total: number;
  percent: number;
  workdayPercent: number;
  onEdit: () => void;
  loading?: boolean;
}

export default function CreditsProgress({ used, total, percent, workdayPercent, onEdit, loading }: Props) {
  const ratio = total > 0 ? used / total : 0;
  const progress = Math.min(ratio, 1);
  // 配速差值：Credits 使用率 − 工作日进度，决定卡片颜色
  const paceDiff = percent - workdayPercent;
  const color = getCreditsColor(paceDiff);
  const colorDark = getCreditsDarkColor(paceDiff);
  const overBudget = ratio > 1;

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit();
  };

  return (
    <Card style={styles.card} mode="elevated">
      <View style={styles.cardInner}>
        {/* 进度填充背景 —— 左浅右深动态渐变 + 右侧水波边缘 */}
        <WaveProgressFill
          progress={progress}
          lightColor={color}
          darkColor={colorDark}
          lightAlpha={0.14}
          darkAlpha={0.42}
        />
        {/* 内容层 */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconChip, { backgroundColor: withAlpha(color, 0.12) }]}>
              <MaterialCommunityIcons
                name="robot"
                size={18}
                color={color}
              />
            </View>
            <Text variant="titleMedium" style={styles.title}>AI Credits</Text>
            <View style={styles.headerSpacer} />
            <IconButton
              icon="pencil"
              size={20}
              onPress={handleEdit}
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
            <View style={styles.metricMain}>
              <Text style={styles.totalNum}>{formatNum(total)}</Text>
              <Text style={styles.metricLabel}>总额度</Text>
            </View>
            <View style={styles.metricMain}>
              <Text style={[styles.percentNum, { color }]}>{percent}%</Text>
              <Text style={styles.metricLabel}>使用率</Text>
            </View>
          </View>

          {overBudget && (
            <View style={styles.warningBadge}>
              <MaterialCommunityIcons name="alert-circle" size={13} color="#FFFFFF" />
              <Text style={styles.warningText}>
                超预算 {Math.round((ratio - 1) * 100)}%
              </Text>
            </View>
          )}
        </View>
        <CardLoading loading={!!loading} />
      </View>
    </Card>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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
    marginTop: -4,
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
  headerSpacer: {
    flex: 1,
  },
  editBtn: {
    margin: 0,
    marginRight: -8,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricMain: {
    alignItems: 'center',
    flex: 1,
  },
  usedNum: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
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
  },
  metricLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
    color: themeColors.textMuted,
    marginTop: 4,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: themeColors.creditsDanger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 5,
    marginTop: 14,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
