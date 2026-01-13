/**
 * Migration Runner
 *
 * Provides a safe, versioned migration system for the SQLite database.
 * Supports both upgrading and downgrading the schema.
 *
 * Features:
 * - Version tracking in schema_migrations table
 * - Safe execution with transaction support
 * - Automatic rollback on failure
 * - Up and down migrations
 * - Dry-run mode for testing
 *
 * @module storage/migrations
 */

import type {
  Migration,
  MigrationRecord,
  MigrationResult,
} from '../schema';
import { CREATE_SCHEMA_MIGRATIONS_TABLE, now } from '../schema';

// Import all migrations
import migration001 from './001_initial';

// ============================================
// Migration Registry
// ============================================

/**
 * All registered migrations in order.
 * Add new migrations here when created.
 */
export const migrations: Migration[] = [
  migration001,
  // Add new migrations here as they are created:
  // migration002,
  // migration003,
];

/**
 * Get a migration by version number.
 *
 * @param version - The migration version
 * @returns The migration or undefined if not found
 */
export function getMigration(version: number): Migration | undefined {
  return migrations.find((m) => m.version === version);
}

/**
 * Get the highest migration version available.
 */
export function getLatestVersion(): number {
  return migrations.length > 0 ? Math.max(...migrations.map((m) => m.version)) : 0;
}

// ============================================
// SQL Executor Interface
// ============================================

/**
 * Interface for executing SQL commands.
 * This abstraction allows the migration runner to work with any SQL database.
 */
export interface SqlExecutor {
  /**
   * Execute a SQL statement.
   *
   * @param sql - The SQL statement to execute
   * @param params - Optional parameters for prepared statements
   * @returns Promise that resolves when execution is complete
   */
  exec(sql: string, params?: unknown[]): Promise<void>;

  /**
   * Execute a SQL query and return results.
   *
   * @param sql - The SQL query
   * @param params - Optional parameters
   * @returns Array of result rows
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Begin a transaction.
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction.
   */
  rollback(): Promise<void>;
}

// ============================================
// Migration Runner
// ============================================

/**
 * Migration runner that handles applying and reverting migrations.
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner(sqlExecutor);
 *
 * // Run all pending migrations
 * const result = await runner.migrate();
 *
 * // Check current version
 * const version = await runner.getCurrentVersion();
 *
 * // Rollback to specific version
 * await runner.rollbackTo(1);
 * ```
 */
export class MigrationRunner {
  private executor: SqlExecutor;
  private initialized = false;

  /**
   * Create a new migration runner.
   *
   * @param executor - SQL executor for database operations
   */
  constructor(executor: SqlExecutor) {
    this.executor = executor;
  }

  /**
   * Initialize the migration tracking table.
   * Creates the schema_migrations table if it doesn't exist.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.executor.exec(CREATE_SCHEMA_MIGRATIONS_TABLE);
    this.initialized = true;
  }

  /**
   * Get the current schema version.
   *
   * @returns The highest applied migration version, or 0 if none applied
   */
  async getCurrentVersion(): Promise<number> {
    await this.initialize();

    const results = await this.executor.query<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_migrations'
    );

    return results[0]?.version ?? 0;
  }

  /**
   * Get all applied migrations.
   *
   * @returns Array of applied migration records
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    await this.initialize();

    const results = await this.executor.query<MigrationRecord>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
    );

    return results;
  }

  /**
   * Check if a specific migration has been applied.
   *
   * @param version - The migration version to check
   * @returns True if the migration has been applied
   */
  async isApplied(version: number): Promise<boolean> {
    await this.initialize();

    const results = await this.executor.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM schema_migrations WHERE version = ?',
      [version]
    );

    return results[0]?.count > 0;
  }

  /**
   * Get pending migrations that need to be applied.
   *
   * @returns Array of migrations that haven't been applied yet
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const currentVersion = await this.getCurrentVersion();

    return migrations.filter((m) => m.version > currentVersion);
  }

  /**
   * Run all pending migrations.
   *
   * @param options - Migration options
   * @returns Result of the migration
   */
  async migrate(options: { dryRun?: boolean } = {}): Promise<MigrationResult> {
    await this.initialize();

    const pending = await this.getPendingMigrations();
    const applied: MigrationRecord[] = [];

    if (pending.length === 0) {
      return {
        success: true,
        applied: [],
        currentVersion: await this.getCurrentVersion(),
      };
    }

    // Sort migrations by version to ensure correct order
    pending.sort((a, b) => a.version - b.version);

    try {
      for (const migration of pending) {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would apply migration ${migration.version}: ${migration.name}`);
          applied.push({
            version: migration.version,
            name: migration.name,
            applied_at: now(),
          });
          continue;
        }

        await this.applyMigration(migration);

        applied.push({
          version: migration.version,
          name: migration.name,
          applied_at: now(),
        });

        console.log(`Applied migration ${migration.version}: ${migration.name}`);
      }

      return {
        success: true,
        applied,
        currentVersion: options.dryRun
          ? Math.max(...pending.map((m) => m.version))
          : await this.getCurrentVersion(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Migration failed:', errorMessage);

      return {
        success: false,
        applied,
        currentVersion: await this.getCurrentVersion(),
        error: errorMessage,
      };
    }
  }

  /**
   * Apply a single migration within a transaction.
   *
   * @param migration - The migration to apply
   */
  private async applyMigration(migration: Migration): Promise<void> {
    // Create an executor function for the migration
    const exec = async (sql: string, params?: unknown[]) => {
      await this.executor.exec(sql, params);
    };

    await this.executor.beginTransaction();

    try {
      // Run the migration
      await migration.up(exec);

      // Record the migration
      await this.executor.exec(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, now()]
      );

      await this.executor.commit();
    } catch (error) {
      await this.executor.rollback();
      throw error;
    }
  }

  /**
   * Rollback to a specific version.
   *
   * @param targetVersion - The version to rollback to (exclusive)
   * @returns Result of the rollback
   */
  async rollbackTo(targetVersion: number): Promise<MigrationResult> {
    await this.initialize();

    const currentVersion = await this.getCurrentVersion();
    const applied: MigrationRecord[] = [];

    if (targetVersion >= currentVersion) {
      return {
        success: true,
        applied: [],
        currentVersion,
      };
    }

    // Get migrations to rollback in reverse order
    const toRollback = migrations
      .filter((m) => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version);

    try {
      for (const migration of toRollback) {
        await this.revertMigration(migration);

        applied.push({
          version: migration.version,
          name: migration.name,
          applied_at: now(),
        });

        console.log(`Reverted migration ${migration.version}: ${migration.name}`);
      }

      return {
        success: true,
        applied,
        currentVersion: await this.getCurrentVersion(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Rollback failed:', errorMessage);

      return {
        success: false,
        applied,
        currentVersion: await this.getCurrentVersion(),
        error: errorMessage,
      };
    }
  }

  /**
   * Revert a single migration within a transaction.
   *
   * @param migration - The migration to revert
   */
  private async revertMigration(migration: Migration): Promise<void> {
    // Create an executor function for the migration
    const exec = async (sql: string, params?: unknown[]) => {
      await this.executor.exec(sql, params);
    };

    await this.executor.beginTransaction();

    try {
      // Run the down migration
      await migration.down(exec);

      // Remove the migration record
      await this.executor.exec(
        'DELETE FROM schema_migrations WHERE version = ?',
        [migration.version]
      );

      await this.executor.commit();
    } catch (error) {
      await this.executor.rollback();
      throw error;
    }
  }

  /**
   * Rollback the last applied migration.
   *
   * @returns Result of the rollback
   */
  async rollbackLast(): Promise<MigrationResult> {
    const currentVersion = await this.getCurrentVersion();

    if (currentVersion === 0) {
      return {
        success: true,
        applied: [],
        currentVersion: 0,
      };
    }

    return this.rollbackTo(currentVersion - 1);
  }

  /**
   * Reset the database by rolling back all migrations.
   * WARNING: This will delete all data!
   *
   * @returns Result of the reset
   */
  async reset(): Promise<MigrationResult> {
    return this.rollbackTo(0);
  }

  /**
   * Reset and re-run all migrations.
   * Useful for development and testing.
   *
   * @returns Result of the refresh
   */
  async refresh(): Promise<MigrationResult> {
    const resetResult = await this.reset();

    if (!resetResult.success) {
      return resetResult;
    }

    return this.migrate();
  }
}

// ============================================
// In-Memory SQL Executor (for testing)
// ============================================

/**
 * In-memory SQL executor for testing.
 * Stores data in simple JavaScript objects.
 *
 * @example
 * ```typescript
 * const executor = new InMemorySqlExecutor();
 * const runner = new MigrationRunner(executor);
 *
 * // Test migrations
 * await runner.migrate();
 * ```
 */
export class InMemorySqlExecutor implements SqlExecutor {
  private tables: Map<string, Record<string, unknown>[]> = new Map();
  private inTransaction = false;
  private transactionBackup: Map<string, Record<string, unknown>[]> | null = null;

  /**
   * Execute a SQL statement (simplified for testing).
   */
  async exec(sql: string, params?: unknown[]): Promise<void> {
    // Parse simple CREATE TABLE statements
    const createTableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (createTableMatch) {
      const tableName = createTableMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      return;
    }

    // Parse DROP TABLE statements
    const dropTableMatch = sql.match(/DROP TABLE IF EXISTS (\w+)/i);
    if (dropTableMatch) {
      const tableName = dropTableMatch[1];
      this.tables.delete(tableName);
      return;
    }

    // Parse INSERT statements
    const insertMatch = sql.match(/INSERT INTO (\w+)/i);
    if (insertMatch && params) {
      const tableName = insertMatch[1];
      const table = this.tables.get(tableName);
      if (table) {
        // Simple insert - just store the params as a row
        if (tableName === 'schema_migrations') {
          table.push({
            version: params[0],
            name: params[1],
            applied_at: params[2],
          });
        }
      }
      return;
    }

    // Parse DELETE statements
    const deleteMatch = sql.match(/DELETE FROM (\w+) WHERE version = \?/i);
    if (deleteMatch && params) {
      const tableName = deleteMatch[1];
      const table = this.tables.get(tableName);
      if (table) {
        const version = params[0];
        const index = table.findIndex((r) => r.version === version);
        if (index !== -1) {
          table.splice(index, 1);
        }
      }
      return;
    }

    // Ignore CREATE INDEX statements
    if (sql.match(/CREATE INDEX/i)) {
      return;
    }
  }

  /**
   * Execute a query and return results.
   */
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    // Handle MAX(version) query
    if (sql.includes('MAX(version)')) {
      const table = this.tables.get('schema_migrations') || [];
      const maxVersion = table.reduce((max, row) => {
        const version = row.version as number;
        return version > max ? version : max;
      }, 0);
      return [{ version: maxVersion || null } as unknown as T];
    }

    // Handle SELECT all from schema_migrations
    if (sql.includes('SELECT version, name, applied_at FROM schema_migrations')) {
      const table = this.tables.get('schema_migrations') || [];
      return table as unknown as T[];
    }

    // Handle COUNT query
    if (sql.includes('COUNT(*)') && params) {
      const table = this.tables.get('schema_migrations') || [];
      const count = table.filter((r) => r.version === params[0]).length;
      return [{ count } as unknown as T];
    }

    return [];
  }

  /**
   * Begin a transaction.
   */
  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Already in transaction');
    }

    // Create a backup of current state
    this.transactionBackup = new Map();
    this.tables.forEach((value, key) => {
      this.transactionBackup!.set(key, JSON.parse(JSON.stringify(value)));
    });

    this.inTransaction = true;
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('Not in transaction');
    }

    this.transactionBackup = null;
    this.inTransaction = false;
  }

  /**
   * Rollback the transaction.
   */
  async rollback(): Promise<void> {
    if (!this.inTransaction || !this.transactionBackup) {
      throw new Error('Not in transaction');
    }

    // Restore from backup
    this.tables = this.transactionBackup;
    this.transactionBackup = null;
    this.inTransaction = false;
  }

  /**
   * Get all table names (for testing).
   */
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * Check if a table exists (for testing).
   */
  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.tables.clear();
    this.transactionBackup = null;
    this.inTransaction = false;
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a migration runner with the given SQL executor.
 *
 * @param executor - SQL executor for database operations
 * @returns A new MigrationRunner instance
 */
export function createMigrationRunner(executor: SqlExecutor): MigrationRunner {
  return new MigrationRunner(executor);
}

/**
 * Create an in-memory SQL executor for testing.
 *
 * @returns A new InMemorySqlExecutor instance
 */
export function createTestExecutor(): InMemorySqlExecutor {
  return new InMemorySqlExecutor();
}

// Export types
export type { Migration, MigrationRecord, MigrationResult } from '../schema';
