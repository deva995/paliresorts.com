/**
 * Pali Resort & Club - Offline IndexedDB & Sync Queue Architecture
 * Ensures customer QR orders, waiter punches, and payments are preserved
 * during network dropouts and automatically re-synced upon reconnection.
 */

export interface QueuedAction {
  id: string;
  type: 'CUSTOMER_QR_ORDER' | 'WAITER_ORDER' | 'SETTLE_BILL' | 'UPDATE_TIP' | 'CALL_WAITER';
  payload: any;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
}

const DB_NAME = 'PALI_RESORT_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';
const LOCAL_STORAGE_FALLBACK_KEY = 'pali_offline_sync_queue';

/**
 * Open IndexedDB database with fallback handling
 */
function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('IndexedDB failed to open, utilizing localStorage fallback.');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Retrieve all pending queued actions
 */
export async function getPendingSyncQueue(): Promise<QueuedAction[]> {
  try {
    const db = await openDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          resolve((req.result as QueuedAction[]) || []);
        };
        req.onerror = () => {
          resolve(getFallbackQueue());
        };
      });
    }
  } catch (err) {
    console.error('Error reading offline queue:', err);
  }

  return getFallbackQueue();
}

/**
 * Queue an action when offline or in transit
 */
export async function enqueueOfflineAction(
  type: QueuedAction['type'],
  payload: any
): Promise<QueuedAction> {
  const action: QueuedAction = {
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  };

  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(action);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return action;
    }
  } catch (err) {
    console.warn('IndexedDB write error, saving to fallback:', err);
  }

  // Fallback
  const current = getFallbackQueue();
  current.push(action);
  setFallbackQueue(current);
  return action;
}

/**
 * Remove an item from the queue after successful sync
 */
export async function removeQueueItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
      return;
    }
  } catch {
    // fallback
  }

  const current = getFallbackQueue();
  setFallbackQueue(current.filter(i => i.id !== id));
}

/**
 * Clear the entire queue
 */
export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
      });
      return;
    }
  } catch {
    // fallback
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
  }
}

// Fallback helpers
function getFallbackQueue(): QueuedAction[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFallbackQueue(items: QueuedAction[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}
