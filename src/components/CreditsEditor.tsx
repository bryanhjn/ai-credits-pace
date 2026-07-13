import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Keyboard, Dimensions } from 'react-native';
import { Portal, Modal, Card, Text, TextInput, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors } from '../theme';
import type { CloudFunctionConfig } from '../types';

// 受控 TextInput 包装：通过 selection 状态保存光标位置
// 根因：Android 上受控 TextInput 在 value 回写时原生 EditText 会重置光标
// 适用于弹窗内所有受控输入框（数字、用户名、PAT 等）
function StableTextInput({ value, onChangeText, ...rest }: React.ComponentProps<typeof TextInput>) {
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
  cloudFunctionConfig: CloudFunctionConfig | null;
  onSave: (total: number, used: number, config: CloudFunctionConfig | null) => void;
  onClose: () => void;
}

// Paper Modal 关闭动画时长 DEFAULT_DURATION = 220
const ANIM_DURATION = 220;
const SCALE_HIDDEN = 0.95;

export default function CreditsEditor({
  visible,
  totalCredits,
  usedCredits,
  cloudFunctionConfig,
  onSave,
  onClose,
}: Props) {
  const [totalStr, setTotalStr] = useState(String(totalCredits));
  const [usedStr, setUsedStr] = useState(String(usedCredits));
  const [cfEndpoint, setCfEndpoint] = useState('');
  const [cfSecret, setCfSecret] = useState('');
  const scaleAnim = useRef(new Animated.Value(SCALE_HIDDEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // 键盘弹出时，根据卡片实际遮挡量上移，避免输入框被键盘挡住
  const shiftAnim = useRef(new Animated.Value(0)).current;
  const cardWrapRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      setTotalStr(String(totalCredits));
      setUsedStr(String(usedCredits));
      setCfEndpoint(cloudFunctionConfig?.endpoint ?? '');
      setCfSecret(cloudFunctionConfig?.secret ?? '');
    } else {
      // 关闭时复位上移量，避免下次打开残留偏移
      shiftAnim.setValue(0);
    }
  }, [visible, totalCredits, usedCredits, cloudFunctionConfig, shiftAnim]);

  // 监听键盘事件：测量卡片底边与键盘顶边，仅上移被遮挡的部分
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbHeight = e.endCoordinates.height;
      cardWrapRef.current?.measureInWindow((_x, y, _w, h) => {
        const cardBottom = y + h;
        const screenH = Dimensions.get('window').height;
        const kbTop = screenH - kbHeight;
        // +16 缓冲，确保输入框完整可见
        const shift = Math.max(0, cardBottom - kbTop + 16);
        Animated.timing(shiftAnim, {
          toValue: -shift,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(shiftAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [shiftAnim]);

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

  // 输入校验
  const totalNum = parseFloat(totalStr);
  const usedNum = parseFloat(usedStr);
  const totalInvalid = !totalStr.trim() || isNaN(totalNum) || totalNum <= 0;
  const usedInvalid = !usedStr.trim() || isNaN(usedNum) || usedNum < 0;
  const usedOverTotal = !totalInvalid && !usedInvalid && usedNum > totalNum;
  const canSave = !totalInvalid && !usedInvalid;

  const handleSave = () => {
    if (!canSave) return;
    const config =
      cfEndpoint.trim() && cfSecret.trim()
        ? { endpoint: cfEndpoint.trim(), secret: cfSecret.trim() }
        : null;
    onSave(totalNum, usedNum, config);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modal}>
        <Animated.View
          ref={cardWrapRef}
          style={{
            transform: [
              { translateY: shiftAnim },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          }}
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
                编辑AI Credits
              </Text>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.flex1}>
                <StableTextInput
                  label="已用"
                  value={usedStr}
                  onChangeText={setUsedStr}
                  mode="flat"
                  keyboardType="numeric"
                  style={styles.input}
                  underlineColor={themeColors.divider}
                  activeUnderlineColor={themeColors.primary}
                  error={usedInvalid}
                  left={<TextInput.Icon icon="chart-line" color={themeColors.textSecondary} />}
                />
                {usedInvalid && (
                  <Text style={styles.fieldError}>不能小于 0</Text>
                )}
              </View>
              <View style={styles.flex1}>
                <StableTextInput
                  label="总额"
                  value={totalStr}
                  onChangeText={setTotalStr}
                  mode="flat"
                  keyboardType="numeric"
                  style={styles.input}
                  underlineColor={themeColors.divider}
                  activeUnderlineColor={themeColors.primary}
                  error={totalInvalid}
                  left={<TextInput.Icon icon="credit-card-outline" color={themeColors.textSecondary} />}
                />
                {totalInvalid && (
                  <Text style={styles.fieldError}>需大于 0</Text>
                )}
              </View>
            </View>
            {usedOverTotal && (
              <Text style={styles.fieldWarning}>已用额度超过总额度</Text>
            )}

            <Divider style={styles.divider} />

            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="cloud-outline"
                size={20}
                color={themeColors.primary}
              />
              <Text variant="titleSmall" style={styles.sectionTitle}>
                云函数自动获取
              </Text>
            </View>

            <StableTextInput
              label="云函数 URL"
              value={cfEndpoint}
              onChangeText={setCfEndpoint}
              mode="flat"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={3}
              style={styles.cfInput}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="cloud-outline" color={themeColors.textSecondary} />}
            />
            <StableTextInput
              label="API 密钥"
              value={cfSecret}
              onChangeText={setCfSecret}
              mode="flat"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.cfSecretInput}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="key" color={themeColors.textSecondary} />}
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
                disabled={!canSave}
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
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
  },
  input: {
    backgroundColor: 'transparent',
  },
  cfInput: {
    backgroundColor: 'transparent',
    fontSize: 13,
    // 显式高度，确保 3 行完整显示（numberOfLines 在部分机型上不生效）
    height: 96,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  cfSecretInput: {
    backgroundColor: 'transparent',
    fontSize: 13,
    marginBottom: 12,
  },
  fieldError: {
    color: themeColors.creditsDanger,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
    marginLeft: 4,
  },
  fieldWarning: {
    color: themeColors.creditsWarning,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
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
  divider: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: themeColors.textPrimary,
  },
});
