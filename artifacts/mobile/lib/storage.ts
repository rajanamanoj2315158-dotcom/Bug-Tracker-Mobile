import AsyncStorage from "@react-native-async-storage/async-storage";

type Validator<T> = (value: unknown) => value is T;

const DEFAULT_MAX_JSON_CHARS = 1_000_000;

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
  maxChars = DEFAULT_MAX_JSON_CHARS,
): Promise<T> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  try {
    if (raw.length > maxChars) {
      throw new Error(`Stored value for ${key} exceeds safe JSON size`);
    }
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      throw new Error(`Invalid stored value for ${key}`);
    }
    return parsed as T;
  } catch {
    await removeStorageItem(key);
    return fallback;
  }
}

export async function setJson<T>(
  key: string,
  value: T,
  maxChars = DEFAULT_MAX_JSON_CHARS,
): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string" || serialized.length > maxChars) {
      return false;
    }
    await AsyncStorage.setItem(key, serialized);
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
