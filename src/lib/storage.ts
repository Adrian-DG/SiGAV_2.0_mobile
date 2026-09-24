import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Key-value session storage. expo-secure-store has no web implementation,
 * so web falls back to localStorage (web builds are for internal/dev use only,
 * the shipped app is native).
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = { getItem, setItem, deleteItem };
