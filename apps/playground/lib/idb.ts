/**
 * IndexedDB, reduced to get, set and delete.
 *
 * For documents too large for localStorage's few megabytes — drawings. When
 * IndexedDB is refused (some private windows), a plain map stands in, so the
 * tool still works for the session and forgets on close.
 */

const DB = 'playground';
const STORE = 'docs';
const memory = new Map<string, unknown>();
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    if (!db) return reject(new Error('no db'));
    try {
      const request = act(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  }));
}

export async function getDoc<T>(key: string): Promise<T | undefined> {
  try {
    return await run<T | undefined>('readonly', (store) => store.get(key));
  } catch {
    return memory.get(key) as T | undefined;
  }
}

/** False when the browser refused to store it — usually because it is full. */
export async function setDoc(key: string, value: unknown): Promise<boolean> {
  try {
    await run('readwrite', (store) => store.put(value, key));
    return true;
  } catch {
    const db = await open();
    if (db) return false;
    memory.set(key, value);
    return true;
  }
}

export async function deleteDoc(key: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(key));
  } catch {
    memory.delete(key);
  }
}
