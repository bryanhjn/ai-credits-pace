import * as SecureStore from 'expo-secure-store';
import type { CloudFunctionConfig } from '../types';

// 云函数配置安全存储（Android Keystore / iOS Keychain）
const KEY_ENDPOINT = 'cf_endpoint';
const KEY_SECRET = 'cf_secret';

export async function getCloudFunctionConfig(): Promise<CloudFunctionConfig | null> {
  const endpoint = await SecureStore.getItemAsync(KEY_ENDPOINT);
  const secret = await SecureStore.getItemAsync(KEY_SECRET);
  if (!endpoint || !secret) return null;
  return { endpoint, secret };
}

export async function saveCloudFunctionConfig(endpoint: string, secret: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_ENDPOINT, endpoint);
  await SecureStore.setItemAsync(KEY_SECRET, secret);
}

export async function clearCloudFunctionConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ENDPOINT);
  await SecureStore.deleteItemAsync(KEY_SECRET);
}
