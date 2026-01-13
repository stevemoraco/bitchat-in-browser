/**
 * Storage Mock - Mock storage adapters for testing
 *
 * Provides mock implementations for:
 * - OPFS (Origin Private File System)
 * - IndexedDB (via Dexie)
 * - wa-sqlite
 */

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface StorageRecord {
  id: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface MockStorageAdapter {
  name: string;
  isAvailable: () => Promise<boolean>;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
  getAll: <T>() => Promise<Map<string, T>>;
}

export interface MockDatabase {
  name: string;
  version: number;
  tables: Map<string, MockTable>;
  open: () => Promise<void>;
  close: () => void;
  delete: () => Promise<void>;
}

export interface MockTable {
  name: string;
  data: Map<string, StorageRecord>;
  get: (id: string) => Promise<StorageRecord | undefined>;
  put: (record: StorageRecord) => Promise<string>;
  delete: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  toArray: () => Promise<StorageRecord[]>;
  where: (conditions: Record<string, unknown>) => MockQuery;
}

export interface MockQuery {
  equals: (value: unknown) => MockQuery;
  between: (lower: unknown, upper: unknown) => MockQuery;
  toArray: () => Promise<StorageRecord[]>;
  first: () => Promise<StorageRecord | undefined>;
  count: () => Promise<number>;
}

// ============================================================================
// Mock Storage Adapter
// ============================================================================

export function createMockStorageAdapter(name: string): MockStorageAdapter {
  const store = new Map<string, unknown>();

  return {
    name,

    isAvailable: vi.fn().mockResolvedValue(true),

    get: vi.fn().mockImplementation(async <T>(key: string): Promise<T | null> => {
      const value = store.get(key);
      return (value as T) ?? null;
    }),

    set: vi.fn().mockImplementation(async <T>(key: string, value: T): Promise<void> => {
      store.set(key, value);
    }),

    delete: vi.fn().mockImplementation(async (key: string): Promise<void> => {
      store.delete(key);
    }),

    clear: vi.fn().mockImplementation(async (): Promise<void> => {
      store.clear();
    }),

    keys: vi.fn().mockImplementation(async (): Promise<string[]> => {
      return Array.from(store.keys());
    }),

    getAll: vi.fn().mockImplementation(async <T>(): Promise<Map<string, T>> => {
      return new Map(store as Map<string, T>);
    }),
  };
}

// ============================================================================
// Mock Table
// ============================================================================

export function createMockTable(tableName: string): MockTable {
  const data = new Map<string, StorageRecord>();

  const createQuery = (records: StorageRecord[]): MockQuery => {
    let filtered = [...records];

    return {
      equals: (value: unknown) => {
        filtered = filtered.filter((r) => Object.values(r.data as object).includes(value));
        return createQuery(filtered);
      },
      between: (lower: unknown, upper: unknown) => {
        filtered = filtered.filter((r) => {
          const values = Object.values(r.data as object);
          return values.some(
            (v) =>
              typeof v === 'number' &&
              typeof lower === 'number' &&
              typeof upper === 'number' &&
              v >= lower &&
              v <= upper
          );
        });
        return createQuery(filtered);
      },
      toArray: async () => filtered,
      first: async () => filtered[0],
      count: async () => filtered.length,
    };
  };

  return {
    name: tableName,
    data,

    get: vi.fn().mockImplementation(async (id: string) => {
      return data.get(id);
    }),

    put: vi.fn().mockImplementation(async (record: StorageRecord) => {
      const id = record.id ?? `${tableName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const now = Date.now();
      const existing = data.get(id);

      const newRecord: StorageRecord = {
        ...record,
        id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      data.set(id, newRecord);
      return id;
    }),

    delete: vi.fn().mockImplementation(async (id: string) => {
      data.delete(id);
    }),

    clear: vi.fn().mockImplementation(async () => {
      data.clear();
    }),

    toArray: vi.fn().mockImplementation(async () => {
      return Array.from(data.values());
    }),

    where: vi.fn().mockImplementation((conditions: Record<string, unknown>) => {
      const records = Array.from(data.values()).filter((record) => {
        return Object.entries(conditions).every(([key, value]) => {
          const recordData = record.data as Record<string, unknown>;
          return recordData[key] === value || (record as unknown as Record<string, unknown>)[key] === value;
        });
      });
      return createQuery(records);
    }),
  };
}

// ============================================================================
// Mock Database
// ============================================================================

export function createMockDatabase(name: string, version: number = 1): MockDatabase {
  const tables = new Map<string, MockTable>();

  return {
    name,
    version,
    tables,

    open: vi.fn().mockImplementation(async () => {
      // Simulate database open
    }),

    close: vi.fn().mockImplementation(() => {
      // Simulate database close
    }),

    delete: vi.fn().mockImplementation(async () => {
      tables.forEach((table) => table.clear());
      tables.clear();
    }),
  };
}

// ============================================================================
// Mock SQLite (wa-sqlite)
// ============================================================================

export interface MockSQLiteDatabase {
  exec: (sql: string) => Promise<void>;
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  run: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  close: () => Promise<void>;
}

interface MockTableSchema {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export function createMockSQLiteDatabase(): MockSQLiteDatabase {
  const tables = new Map<string, MockTableSchema>();
  let lastInsertRowId = 0;

  const parseCreateTable = (sql: string): { tableName: string; columns: string[] } | null => {
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*)\)/is);
    if (!match) return null;

    const tableName = match[1] ?? '';
    const columnStr = match[2] ?? '';
    const columnDefs = columnStr.split(',').map((col) => col.trim().split(/\s+/)[0] ?? '').filter(Boolean);
    return { tableName, columns: columnDefs };
  };

  return {
    exec: vi.fn().mockImplementation(async (sql: string) => {
      // Handle CREATE TABLE
      const tableInfo = parseCreateTable(sql);
      if (tableInfo) {
        tables.set(tableInfo.tableName, {
          name: tableInfo.tableName,
          columns: tableInfo.columns,
          rows: [],
        });
      }

      // Handle DROP TABLE
      const dropMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
      if (dropMatch && dropMatch[1]) {
        tables.delete(dropMatch[1]);
      }
    }),

    query: vi.fn().mockImplementation(async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      // Simple SELECT parsing
      const selectMatch = sql.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
      if (selectMatch && selectMatch[1]) {
        const table = tables.get(selectMatch[1]);
        return (table?.rows ?? []) as T[];
      }
      return [];
    }),

    run: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      // Simple INSERT parsing
      const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
      if (insertMatch && insertMatch[1]) {
        const table = tables.get(insertMatch[1]);
        if (table && params) {
          lastInsertRowId++;
          const row: Record<string, unknown> = { id: lastInsertRowId };
          table.columns.forEach((col, i) => {
            if (col !== 'id' && params[i] !== undefined) {
              row[col] = params[i];
            }
          });
          table.rows.push(row);
          return { lastInsertRowId, changes: 1 };
        }
      }

      // Simple UPDATE parsing
      const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
      if (updateMatch) {
        return { lastInsertRowId, changes: 1 };
      }

      // Simple DELETE parsing
      const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
      if (deleteMatch && deleteMatch[1]) {
        const table = tables.get(deleteMatch[1]);
        if (table) {
          const count = table.rows.length;
          table.rows = [];
          return { lastInsertRowId, changes: count };
        }
      }

      return { lastInsertRowId: 0, changes: 0 };
    }),

    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Mock OPFS (Origin Private File System)
// ============================================================================

export interface MockOPFSFile {
  name: string;
  content: ArrayBuffer;
}

export interface MockOPFSDirectory {
  name: string;
  files: Map<string, MockOPFSFile>;
  directories: Map<string, MockOPFSDirectory>;
}

export function createMockOPFS(): {
  root: MockOPFSDirectory;
  getDirectory: (path: string) => Promise<MockOPFSDirectory>;
  writeFile: (path: string, content: ArrayBuffer) => Promise<void>;
  readFile: (path: string) => Promise<ArrayBuffer>;
  deleteFile: (path: string) => Promise<void>;
} {
  const root: MockOPFSDirectory = {
    name: '',
    files: new Map(),
    directories: new Map(),
  };

  const resolvePath = (path: string): { directory: MockOPFSDirectory; fileName: string } => {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop() ?? '';
    let current = root;

    for (const part of parts) {
      let dir = current.directories.get(part);
      if (!dir) {
        dir = { name: part, files: new Map(), directories: new Map() };
        current.directories.set(part, dir);
      }
      current = dir;
    }

    return { directory: current, fileName };
  };

  return {
    root,

    getDirectory: vi.fn().mockImplementation(async (path: string) => {
      const parts = path.split('/').filter(Boolean);
      let current = root;

      for (const part of parts) {
        let dir = current.directories.get(part);
        if (!dir) {
          dir = { name: part, files: new Map(), directories: new Map() };
          current.directories.set(part, dir);
        }
        current = dir;
      }

      return current;
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: ArrayBuffer) => {
      const { directory, fileName } = resolvePath(path);
      directory.files.set(fileName, { name: fileName, content });
    }),

    readFile: vi.fn().mockImplementation(async (path: string) => {
      const { directory, fileName } = resolvePath(path);
      const file = directory.files.get(fileName);
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }
      return file.content;
    }),

    deleteFile: vi.fn().mockImplementation(async (path: string) => {
      const { directory, fileName } = resolvePath(path);
      directory.files.delete(fileName);
    }),
  };
}

// ============================================================================
// Mock Dexie
// ============================================================================

export function createMockDexie(name: string): MockDatabase & { table: (name: string) => MockTable } {
  const db = createMockDatabase(name);

  const getOrCreateTable = (tableName: string): MockTable => {
    let table = db.tables.get(tableName);
    if (!table) {
      table = createMockTable(tableName);
      db.tables.set(tableName, table);
    }
    return table;
  };

  return {
    ...db,
    table: vi.fn().mockImplementation((tableName: string) => {
      return getOrCreateTable(tableName);
    }),
  };
}

// ============================================================================
// Installation helpers
// ============================================================================

export function installStorageMocks(): {
  storageAdapter: MockStorageAdapter;
  database: ReturnType<typeof createMockDexie>;
  sqlite: MockSQLiteDatabase;
  opfs: ReturnType<typeof createMockOPFS>;
} {
  const storageAdapter = createMockStorageAdapter('test-storage');
  const database = createMockDexie('bitchat-test');
  const sqlite = createMockSQLiteDatabase();
  const opfs = createMockOPFS();

  return { storageAdapter, database, sqlite, opfs };
}

export function resetStorageMocks(mocks: ReturnType<typeof installStorageMocks>): void {
  mocks.storageAdapter.clear();
  mocks.database.delete();
}
