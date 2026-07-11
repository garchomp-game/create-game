import type { StorageLike } from "../../ports/RunRecordStorePort";

export function createBrowserStorage(getStorage: () => StorageLike = () => window.localStorage): StorageLike {
  try {
    return getStorage();
  } catch {
    return createVolatileStorage();
  }
}

export function createVolatileStorage(): StorageLike {
  return new VolatileStorage();
}

class VolatileStorage implements StorageLike {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}
