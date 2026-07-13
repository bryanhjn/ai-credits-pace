import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Portal, Modal, Card, Text, TextInput, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors } from '../theme';
import type { CopilotConfig } from '../types';

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
  monthTitle: string;
  copilotConfig: CopilotConfig | null;
  onSave: (total: number, used: number, config: CopilotConfig | null) => void;
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
  copilotConfig,
  onSave,
  onClose,
}: Props) {
  const [totalStr, setTotalStr] = useState(String(totalCredits));
  const [usedStr, setUsedStr] = useState(String(usedCredits));
  const [githubUser, setGithubUser] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [helpVisible, setHelpVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(SCALE_HIDDEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTotalStr(String(totalCredits));
      setUsedStr(String(usedCredits));
      setGithubUser(copilotConfig?.username ?? '');
      setGithubToken(copilotConfig?.token ?? '');
    }
  }, [visible, totalCredits, usedCredits, copilotConfig]);

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
  const tokenFormatHint = githubToken.trim() !== '' && !githubToken.trim().startsWith('github_pat_');
  const canSave = !totalInvalid && !usedInvalid;

  const handleSave = () => {
    if (!canSave) return;
    const config =
      githubUser.trim() && githubToken.trim()
        ? { username: githubUser.trim(), token: githubToken.trim() }
        : null;
    onSave(totalNum, usedNum, config);
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

            <StableTextInput
              label="AI Credits 总额"
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
              <Text style={styles.fieldError}>请输入大于 0 的数字</Text>
            )}
            <StableTextInput
              label="已用 AI Credits"
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
            {usedOverTotal && (
              <Text style={styles.fieldWarning}>已用额度超过总额度</Text>
            )}

            <Divider style={styles.divider} />

            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="github"
                size={20}
                color={themeColors.primary}
              />
              <Text variant="titleSmall" style={styles.sectionTitle}>
                GitHub Copilot 自动获取
              </Text>
            </View>

            <StableTextInput
              label="GitHub 用户名"
              value={githubUser}
              onChangeText={setGithubUser}
              mode="flat"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="account" color={themeColors.textSecondary} />}
            />
            <StableTextInput
              label="Personal Access Token"
              value={githubToken}
              onChangeText={setGithubToken}
              mode="flat"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              underlineColor={themeColors.divider}
              activeUnderlineColor={themeColors.primary}
              left={<TextInput.Icon icon="key" color={themeColors.textSecondary} />}
            />
            {tokenFormatHint && (
              <Text style={styles.fieldHint}>Fine-grained PAT 通常以 github_pat_ 开头</Text>
            )}
            <TouchableOpacity
              onPress={() => setHelpVisible(true)}
              style={styles.helpLink}
              activeOpacity={0.6}
            >
              <MaterialCommunityIcons name="information" size={16} color={themeColors.primary} />
              <Text variant="bodySmall" style={styles.helpLinkText}>
                如何获取？
              </Text>
            </TouchableOpacity>

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

      {/* PAT 获取帮助弹窗 */}
      <Modal
        visible={helpVisible}
        onDismiss={() => setHelpVisible(false)}
        contentContainerStyle={styles.modal}
      >
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <View style={styles.helpHeader}>
              <MaterialCommunityIcons name="information" size={22} color={themeColors.primary} />
              <Text variant="titleMedium" style={styles.helpTitle}>
                如何获取 GitHub PAT
              </Text>
            </View>

            <Text variant="bodyMedium" style={styles.helpBody}>
{`1、打开GitHub → 头像 → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2、点击 Generate new token
3、底部的Permissions，点击Add permissions，勾选"Plan"
4、其余字段按需填写，建议按照"最小权限原则"进行配置
5、点击Generate token`}
            </Text>

            <View style={styles.helpNote}>
              <MaterialCommunityIcons name="shield-lock" size={16} color={themeColors.textSecondary} />
              <Text variant="bodySmall" style={styles.helpNoteText}>
                你的PAT通过secureStorage加密存入系统 Keystore/Keychain，仅本地存储，仅用于直接请求 api.github.com
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={() => setHelpVisible(false)}
                style={styles.saveBtn}
                buttonColor={themeColors.primary}
                textColor="#FFFFFF"
              >
                知道了
              </Button>
            </View>
          </Card.Content>
        </Card>
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
  fieldError: {
    color: themeColors.creditsDanger,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 4,
  },
  fieldWarning: {
    color: themeColors.creditsWarning,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 4,
  },
  fieldHint: {
    color: themeColors.textSecondary,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 14,
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
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  helpLinkText: {
    color: themeColors.primary,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  helpTitle: {
    fontWeight: '700',
    color: themeColors.textPrimary,
  },
  helpBody: {
    color: themeColors.textPrimary,
    lineHeight: 22,
    marginBottom: 16,
  },
  helpNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: themeColors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  helpNoteText: {
    flex: 1,
    color: themeColors.textSecondary,
    lineHeight: 18,
  },
});