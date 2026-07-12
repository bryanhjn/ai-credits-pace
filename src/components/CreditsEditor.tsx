import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Portal, Modal, Card, Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors } from '../theme';

// 包装 Paper TextInput，通过 selection 状态保存光标位置
// 解决 Android 受控 TextInput 在退格时光标乱跳的问题
function NumericTextInput({ value, onChangeText, ...rest }: React.ComponentProps<typeof TextInput>) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
      selection={selection ?? undefined}
    />
  );
}

interface Props {
  visible: boolean;
  totalCredits: number;
  usedCredits: number;
  monthTitle: string;
  onSave: (total: number, used: number) => void;
  onClose: () => void;
}

// Paper Modal 关闭动画时长 DEFAULT_DURATION = 220
const ANIM_DURATION = 220;
const SCALE_HIDDEN = 0.95;

export default function CreditsEditor({
  visible,
  totalCredits,
  usedCredits,
  monthTitle,
  onSave,
  onClose,
}: Props) {
  const [totalStr, setTotalStr] = useState(String(totalCredits));
  const [usedStr, setUsedStr] = useState(String(usedCredits));
  const scaleAnim = useRef(new Animated.Value(SCALE_HIDDEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTotalStr(String(totalCredits));
      setUsedStr(String(usedCredits));
    }
  }, [visible, totalCredits, usedCredits]);

  // 打开/关闭动画：缩放 + 淡入淡出（shadow* 不依赖 elevation，故可随 opacity 淡出）
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 170,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: SCALE_HIDDEN,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleSave = () => {
    const total = parseFloat(totalStr) || 0;
    const used = parseFloat(usedStr) || 0;
    onSave(total, used);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modal}>
        <Animated.View
          style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}
        >
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <View style={styles.header}>
              <MaterialCommunityIcons
                name="robot"
                size={22}
                color={themeColors.primary}
              />
              <Text variant="titleMedium" style={styles.title}>
                编辑 {monthTitle} Credits
              </Text>
            </View>

            <NumericTextInput
              label="AI Credits 总额"
              value={totalStr}
              onChangeText={setTotalStr}
              mode="flat"
              keyboardType="numeric"
              style={styles.input}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="credit-card-outline" color={themeColors.textSecondary} />}
            />
            <NumericTextInput
              label="已用 AI Credits"
              value={usedStr}
              onChangeText={setUsedStr}
              mode="flat"
              keyboardType="numeric"
              style={styles.input}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="chart-line" color={themeColors.textSecondary} />}
            />

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.cancelBtn}
                textColor={themeColors.textSecondary}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.saveBtn}
                buttonColor={themeColors.primary}
                textColor="#FFFFFF"
              >
                保存
              </Button>
            </View>
          </Card.Content>
        </Card>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    backgroundColor: themeColors.surface,
    // 不使用 elevation，避免 Android 将阴影渲染在父视图上导致关闭时残影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontWeight: '700',
    color: themeColors.textPrimary,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    borderColor: themeColors.divider,
    borderRadius: 10,
  },
  saveBtn: {
    borderRadius: 10,
    minWidth: 80,
  },
});