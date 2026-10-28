// IndexedDB persistent storage for original PDF receipt page bytes
// Ensures original PDF pages are never lost across page reloads, updates, or restarts.

const DB_NAME = 'RecibosOriginalPdfDB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'originalPdfStore';

let dbInstance: IDBDatabase | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste ambiente'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB para recibos originais:', event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// Save a single original PDF page buffer by receipt ID
export async function saveOriginalPdfBytes(receiptId: string, bytes: Uint8Array): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Store pure ArrayBuffer slice to be 100% structured clone compatible
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const req = store.put(arrayBuffer, receiptId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Não foi possível salvar PDF original para ${receiptId}:`, err);
  }
}

// Bulk save multiple original PDF page buffers
export async function saveMultipleOriginalPdfBytes(
  records: { id: string; bytes: Uint8Array }[]
): Promise<void> {
  if (!records.length) return;
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      records.forEach(({ id, bytes }) => {
        if (bytes && bytes.length > 0) {
          const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          store.put(arrayBuffer, id);
        }
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar lote de PDFs originais no IndexedDB:', err);
  }
}

// Retrieve an original PDF page buffer by receipt ID
export async function getOriginalPdfBytes(receiptId: string): Promise<Uint8Array | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(receiptId);

      req.onsuccess = () => {
        const result = req.result;
        if (!result) {
          resolve(null);
          return;
        }
        if (result instanceof ArrayBuffer) {
          resolve(new Uint8Array(result));
        } else if (result instanceof Uint8Array) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Erro ao carregar PDF original para ${receiptId}:`, err);
    return null;
  }
}

// Retrieve all stored original PDF page buffers as a Map
export async function getAllOriginalPdfBytes(): Promise<Map<string, Uint8Array>> {
  const map = new Map<string, Uint8Array>();
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      if (store.getAllKeys && store.getAll) {
        const keysReq = store.getAllKeys();
        const valsReq = store.getAll();

        tx.oncomplete = () => {
          const keys = keysReq.result;
          const vals = valsReq.result;
          if (Array.isArray(keys) && Array.isArray(vals)) {
            for (let i = 0; i < keys.length; i++) {
              const k = String(keys[i]);
              const v = vals[i];
              if (v instanceof ArrayBuffer) {
                map.set(k, new Uint8Array(v));
              } else if (v instanceof Uint8Array) {
                map.set(k, v);
              }
            }
          }
          resolve(map);
        };

        tx.onerror = () => resolve(map);
      } else {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const k = String(cursor.key);
            const v = cursor.value;
            if (v instanceof ArrayBuffer) {
              map.set(k, new Uint8Array(v));
            } else if (v instanceof Uint8Array) {
              map.set(k, v);
            }
            cursor.continue();
          } else {
            resolve(map);
          }
        };
        cursorReq.onerror = () => resolve(map);
      }
    });
  } catch (err) {
    console.warn('Erro ao obter todos os PDFs originais do IndexedDB:', err);
    return map;
  }
}

// Delete an original PDF page buffer
export async function deleteOriginalPdfBytes(receiptId: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(receiptId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Erro ao eliminar PDF original ${receiptId}:`, err);
  }
}
