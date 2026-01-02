
const DB_NAME = 'email-client-db';
const DB_VERSION = 1;
const STORES = {
  EMAILS: 'emails',
  MAILBOXES: 'mailboxes',
};

class CacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Error opening database');
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.EMAILS)) {
          const emailStore = db.createObjectStore(STORES.EMAILS, { keyPath: 'id' });
          emailStore.createIndex('mailboxId', 'mailboxId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MAILBOXES)) {
          db.createObjectStore(STORES.MAILBOXES, { keyPath: 'id' });
        }
      };
    });

    return this.dbPromise;
  }

  async getMailboxes(): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MAILBOXES, 'readonly');
      const store = transaction.objectStore(STORES.MAILBOXES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMailboxes(mailboxes: any[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MAILBOXES, 'readwrite');
      const store = transaction.objectStore(STORES.MAILBOXES);
      
      // Clear existing mailboxes to ensure freshness or just put/update
      // For mailboxes, usually we want to replace the list or update. 
      // Let's just put them all.
      mailboxes.forEach(mailbox => store.put(mailbox));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getEmailsByMailbox(mailboxId: string): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.EMAILS, 'readonly');
      const store = transaction.objectStore(STORES.EMAILS);
      const index = store.index('mailboxId');
      const request = index.getAll(mailboxId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEmail(id: string): Promise<any> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.EMAILS, 'readonly');
      const store = transaction.objectStore(STORES.EMAILS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveEmails(emails: any[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.EMAILS, 'readwrite');
      const store = transaction.objectStore(STORES.EMAILS);
      
      emails.forEach(email => store.put(email));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  async saveEmail(email: any): Promise<void> {
      return this.saveEmails([email]);
  }

  async clearCache(): Promise<void> {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORES.EMAILS, STORES.MAILBOXES], 'readwrite');
          transaction.objectStore(STORES.EMAILS).clear();
          transaction.objectStore(STORES.MAILBOXES).clear();
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
      });
  }
}

export const cacheService = new CacheService();
