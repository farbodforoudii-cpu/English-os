// IndexedDB wrapper. Everything the app knows lives on this device; sync (later, optional) only copies it.
const DB_NAME = 'english-os';
const VERSION = 1;
const STORES = ['sessions', 'cards', 'mistakes'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function run(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  }));
}

export const db = {
  all: store => run(store, 'readonly', s => s.getAll()),
  put: (store, rec) => run(store, 'readwrite', s => { s.put(rec); }),
  putMany: (store, list) => run(store, 'readwrite', s => { for (const r of list) s.put(r); }),
  del: (store, id) => run(store, 'readwrite', s => { s.delete(id); }),
  get: key => run('kv', 'readonly', s => s.get(key)),
  set: (key, val) => run('kv', 'readwrite', s => { s.put(val, key); }),
  wipe: () => Promise.all([...STORES, 'kv'].map(st => run(st, 'readwrite', s => { s.clear(); }))),
};

export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* unsupported */ }
  return false;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
