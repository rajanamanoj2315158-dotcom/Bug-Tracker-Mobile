import AsyncStorage from "@react-native-async-storage/async-storage";

type Validator<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export async function getJson<T>(
  key: string,
  fallback: T,
  validate?: Validator<T>,
): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      throw new Error(`Invalid stored value for ${key}`);
    }
    return parsed as T;
  } catch {
    await AsyncStorage.removeItem(key);
    return fallback;
  }
}

export async function setJson<T>(key: string, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function removeStorageItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
