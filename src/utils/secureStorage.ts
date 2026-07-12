import * as SecureStore from 'expo-secure-store';
import type { CopilotConfig } from '../types';

// PAT 安全存储（Android Keystore / iOS Keychain）。用户名非敏感，为简化一并存。
const KEY_USERNAME = 'copilot_username';
const KEY_TOKEN = 'copilot_token';

export async function getCopilotConfig(): Promise<CopilotConfig | null> {
  const username = await SecureStore.getItemAsync(KEY_USERNAME);
  const token = await SecureStore.getItemAsync(KEY_TOKEN);
  if (!username || !token) return null;
  return { username, token };
}

export async function saveCopilotConfig(username: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_USERNAME, username);
  await SecureStore.setItemAsync(KEY_TOKEN, token);
}

export async function clearCopilotConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_USERNAME);
  await SecureStore.deleteItemAsync(KEY_TOKEN);
}
