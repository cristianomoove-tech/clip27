/**
 * Clip27 - Banco de Dados Local IndexedDB para Persistência de Vídeos
 * ===================================================================
 * Salva os arquivos binários de vídeo (Blob/File) diretamente no navegador
 * para que nada se perca ao recarregar a página (F5), fechar ou trocar de aba.
 */

const DB_NAME = 'Clip27_LocalDB';
const DB_VERSION = 1;
const STORE_NAME = 'video_blobs';

interface StoredVideoEntry {
  id: string;
  fileName: string;
  blob: Blob;
  duration: number;
  thumbnailDataUrl?: string;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste ambiente'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva um arquivo de vídeo (Blob/File) no banco de dados IndexedDB
 */
export async function persistClipToIndexedDB(
  id: string,
  file: Blob | File,
  fileName: string,
  duration: number,
  thumbnailDataUrl?: string
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const entry: StoredVideoEntry = {
        id,
        fileName,
        blob: file,
        duration,
        thumbnailDataUrl,
        updatedAt: Date.now(),
      };

      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Aviso ao persistir clipe no banco local:', err);
  }
}

/**
 * Recupera um clipe do banco pelo ID ou nome do arquivo
 */
export async function getClipFromIndexedDB(idOrName: string): Promise<StoredVideoEntry | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Tenta pelo ID direto
      const req = store.get(idOrName);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
          return;
        }

        // Se não achou por ID, busca pelo índice de fileName
        try {
          const index = store.index('fileName');
          const nameReq = index.get(idOrName);
          nameReq.onsuccess = () => resolve(nameReq.result || null);
          nameReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Carrega todos os clipes salvos no banco IndexedDB
 */
export async function getAllClipsFromIndexedDB(): Promise<StoredVideoEntry[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Remove um clipe do banco IndexedDB
 */
export async function deleteClipFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Silencioso
  }
}

