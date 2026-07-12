import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Modal, Card, Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themeColors } from '../theme';

interface Props {
  visible: boolean;
  totalCredits: number;
  usedCredits: number;
  monthTitle: string;
  onSave: (total: number, used: number) => void;
  onClose: () => void;
}

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

  useEffect(() => {
    if (visible) {
      setTotalStr(String(totalCredits));
      setUsedStr(String(usedCredits));
    }
  }, [visible, totalCredits, usedCredits]);

  const handleSave = () => {
    const total = parseFloat(totalStr) || 0;
    const used = parseFloat(usedStr) || 0;
    onSave(total, used);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modal}>
        <Card style={styles.card}>
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

            <TextInput
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
            <TextInput
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
    elevation: 4,
    shadowColor: '#6366F1',
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