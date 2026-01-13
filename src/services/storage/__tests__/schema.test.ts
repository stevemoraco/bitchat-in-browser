/**
 * Schema and Migration Tests
 *
 * Tests for the SQLite schema definitions and migration system.
 *
 * @module storage/__tests__/schema.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Schema exports
  CREATE_MESSAGES_TABLE,
  CREATE_CHANNELS_TABLE,
  CREATE_PEERS_TABLE,
  CREATE_IDENTITIES_TABLE,
  CREATE_NOSTR_EVENTS_TABLE,
  CREATE_RELAY_STATUS_TABLE,
  CREATE_PENDING_ACTIONS_TABLE,
  CREATE_SCHEMA_MIGRATIONS_TABLE,
  MESSAGES_INDEXES,
  CHANNELS_INDEXES,
  PEERS_INDEXES,
  IDENTITIES_INDEXES,
  NOSTR_EVENTS_INDEXES,
  RELAY_STATUS_INDEXES,
  PENDING_ACTIONS_INDEXES,
  ALL_TABLE_STATEMENTS,
  ALL_INDEX_STATEMENTS,
  SCHEMA_VERSION,
  DATABASE_NAME,
  // Helper functions
  generateId,
  now,
  isValidMessageStatus,
  isValidChannelType,
  isValidTrustLevel,
  isValidPendingActionType,
  // Types
  type MessageRow,
  type ChannelRow,
  type PeerRow,
  type IdentityRow,
  type NostrEventRow,
  type RelayStatusRow,
  type PendingActionRow,
} from '../schema';

import {
  MigrationRunner,
  InMemorySqlExecutor,
  createMigrationRunner,
  createTestExecutor,
  migrations,
  getMigration,
  getLatestVersion,
} from '../migrations';

// ============================================
// Schema Definition Tests
// ============================================

describe('Schema Definitions', () => {
  describe('Table SQL Statements', () => {
    it('should define messages table with correct columns', () => {
      expect(CREATE_MESSAGES_TABLE).toContain('CREATE TABLE IF NOT EXISTS messages');
      expect(CREATE_MESSAGES_TABLE).toContain('id TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('content TEXT NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('sender TEXT NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('channel_id TEXT NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('timestamp INTEGER NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('status TEXT NOT NULL');
      expect(CREATE_MESSAGES_TABLE).toContain('encrypted_content TEXT');
    });

    it('should define channels table with correct columns', () => {
      expect(CREATE_CHANNELS_TABLE).toContain('CREATE TABLE IF NOT EXISTS channels');
      expect(CREATE_CHANNELS_TABLE).toContain('id TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_CHANNELS_TABLE).toContain('type TEXT NOT NULL');
      expect(CREATE_CHANNELS_TABLE).toContain('name TEXT NOT NULL');
      expect(CREATE_CHANNELS_TABLE).toContain('geohash TEXT');
      expect(CREATE_CHANNELS_TABLE).toContain('created_at INTEGER NOT NULL');
      expect(CREATE_CHANNELS_TABLE).toContain('last_message_at INTEGER');
    });

    it('should define peers table with correct columns', () => {
      expect(CREATE_PEERS_TABLE).toContain('CREATE TABLE IF NOT EXISTS peers');
      expect(CREATE_PEERS_TABLE).toContain('pubkey TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_PEERS_TABLE).toContain('nickname TEXT');
      expect(CREATE_PEERS_TABLE).toContain('fingerprint TEXT');
      expect(CREATE_PEERS_TABLE).toContain('last_seen INTEGER');
      expect(CREATE_PEERS_TABLE).toContain('trust_level TEXT NOT NULL');
    });

    it('should define identities table with correct columns', () => {
      expect(CREATE_IDENTITIES_TABLE).toContain('CREATE TABLE IF NOT EXISTS identities');
      expect(CREATE_IDENTITIES_TABLE).toContain('id TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_IDENTITIES_TABLE).toContain('pubkey TEXT NOT NULL UNIQUE');
      expect(CREATE_IDENTITIES_TABLE).toContain('privkey_encrypted TEXT NOT NULL');
      expect(CREATE_IDENTITIES_TABLE).toContain('is_primary INTEGER NOT NULL');
    });

    it('should define nostr_events table with correct columns', () => {
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('CREATE TABLE IF NOT EXISTS nostr_events');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('id TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('kind INTEGER NOT NULL');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('pubkey TEXT NOT NULL');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('content TEXT NOT NULL');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('tags TEXT NOT NULL');
      expect(CREATE_NOSTR_EVENTS_TABLE).toContain('sig TEXT NOT NULL');
    });

    it('should define relay_status table with correct columns', () => {
      expect(CREATE_RELAY_STATUS_TABLE).toContain('CREATE TABLE IF NOT EXISTS relay_status');
      expect(CREATE_RELAY_STATUS_TABLE).toContain('url TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_RELAY_STATUS_TABLE).toContain('connected INTEGER NOT NULL');
      expect(CREATE_RELAY_STATUS_TABLE).toContain('message_count INTEGER NOT NULL');
    });

    it('should define pending_actions table with correct columns', () => {
      expect(CREATE_PENDING_ACTIONS_TABLE).toContain('CREATE TABLE IF NOT EXISTS pending_actions');
      expect(CREATE_PENDING_ACTIONS_TABLE).toContain('id TEXT PRIMARY KEY NOT NULL');
      expect(CREATE_PENDING_ACTIONS_TABLE).toContain('action_type TEXT NOT NULL');
      expect(CREATE_PENDING_ACTIONS_TABLE).toContain('payload TEXT NOT NULL');
      expect(CREATE_PENDING_ACTIONS_TABLE).toContain('retry_count INTEGER NOT NULL');
    });

    it('should define schema_migrations table', () => {
      expect(CREATE_SCHEMA_MIGRATIONS_TABLE).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
      expect(CREATE_SCHEMA_MIGRATIONS_TABLE).toContain('version INTEGER PRIMARY KEY NOT NULL');
      expect(CREATE_SCHEMA_MIGRATIONS_TABLE).toContain('name TEXT NOT NULL');
      expect(CREATE_SCHEMA_MIGRATIONS_TABLE).toContain('applied_at INTEGER NOT NULL');
    });
  });

  describe('Index Definitions', () => {
    it('should define indexes for messages table', () => {
      expect(MESSAGES_INDEXES.length).toBeGreaterThanOrEqual(3);
      expect(MESSAGES_INDEXES.some(sql => sql.includes('idx_messages_channel_id'))).toBe(true);
      expect(MESSAGES_INDEXES.some(sql => sql.includes('idx_messages_timestamp'))).toBe(true);
      expect(MESSAGES_INDEXES.some(sql => sql.includes('idx_messages_channel_timestamp'))).toBe(true);
    });

    it('should define indexes for channels table', () => {
      expect(CHANNELS_INDEXES.length).toBeGreaterThanOrEqual(2);
      expect(CHANNELS_INDEXES.some(sql => sql.includes('idx_channels_type'))).toBe(true);
      expect(CHANNELS_INDEXES.some(sql => sql.includes('idx_channels_geohash'))).toBe(true);
    });

    it('should define indexes for nostr_events table', () => {
      expect(NOSTR_EVENTS_INDEXES.length).toBeGreaterThanOrEqual(4);
      expect(NOSTR_EVENTS_INDEXES.some(sql => sql.includes('idx_nostr_events_kind'))).toBe(true);
      expect(NOSTR_EVENTS_INDEXES.some(sql => sql.includes('idx_nostr_events_pubkey'))).toBe(true);
      expect(NOSTR_EVENTS_INDEXES.some(sql => sql.includes('idx_nostr_events_kind_pubkey'))).toBe(true);
    });

    it('should include all indexes in ALL_INDEX_STATEMENTS', () => {
      const totalIndexes =
        MESSAGES_INDEXES.length +
        CHANNELS_INDEXES.length +
        PEERS_INDEXES.length +
        IDENTITIES_INDEXES.length +
        NOSTR_EVENTS_INDEXES.length +
        RELAY_STATUS_INDEXES.length +
        PENDING_ACTIONS_INDEXES.length;

      expect(ALL_INDEX_STATEMENTS.length).toBe(totalIndexes);
    });
  });

  describe('All Tables and Indexes', () => {
    it('should include all table creation statements', () => {
      expect(ALL_TABLE_STATEMENTS.length).toBe(8);
      expect(ALL_TABLE_STATEMENTS).toContain(CREATE_SCHEMA_MIGRATIONS_TABLE);
      expect(ALL_TABLE_STATEMENTS).toContain(CREATE_MESSAGES_TABLE);
      expect(ALL_TABLE_STATEMENTS).toContain(CREATE_CHANNELS_TABLE);
    });
  });

  describe('Constants', () => {
    it('should have correct schema version', () => {
      expect(SCHEMA_VERSION).toBe(1);
    });

    it('should have correct database name', () => {
      expect(DATABASE_NAME).toBe('bitchat.db');
    });
  });
});

// ============================================
// Helper Function Tests
// ============================================

describe('Schema Helper Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with correct format', () => {
      const id = generateId();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
      // Should only contain alphanumeric characters
      expect(/^[a-z0-9]+$/i.test(id)).toBe(true);
    });
  });

  describe('now', () => {
    it('should return current timestamp in milliseconds', () => {
      const before = Date.now();
      const timestamp = now();
      const after = Date.now();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('isValidMessageStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidMessageStatus('pending')).toBe(true);
      expect(isValidMessageStatus('sending')).toBe(true);
      expect(isValidMessageStatus('sent')).toBe(true);
      expect(isValidMessageStatus('delivered')).toBe(true);
      expect(isValidMessageStatus('failed')).toBe(true);
      expect(isValidMessageStatus('received')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidMessageStatus('invalid')).toBe(false);
      expect(isValidMessageStatus('')).toBe(false);
      expect(isValidMessageStatus('PENDING')).toBe(false);
    });
  });

  describe('isValidChannelType', () => {
    it('should return true for valid types', () => {
      expect(isValidChannelType('location')).toBe(true);
      expect(isValidChannelType('dm')).toBe(true);
      expect(isValidChannelType('group')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidChannelType('invalid')).toBe(false);
      expect(isValidChannelType('')).toBe(false);
    });
  });

  describe('isValidTrustLevel', () => {
    it('should return true for valid trust levels', () => {
      expect(isValidTrustLevel('unknown')).toBe(true);
      expect(isValidTrustLevel('seen')).toBe(true);
      expect(isValidTrustLevel('contacted')).toBe(true);
      expect(isValidTrustLevel('trusted')).toBe(true);
      expect(isValidTrustLevel('blocked')).toBe(true);
    });

    it('should return false for invalid trust levels', () => {
      expect(isValidTrustLevel('invalid')).toBe(false);
      expect(isValidTrustLevel('')).toBe(false);
    });
  });

  describe('isValidPendingActionType', () => {
    it('should return true for valid action types', () => {
      expect(isValidPendingActionType('send_message')).toBe(true);
      expect(isValidPendingActionType('publish_event')).toBe(true);
      expect(isValidPendingActionType('sync_identity')).toBe(true);
      expect(isValidPendingActionType('ack_message')).toBe(true);
    });

    it('should return false for invalid action types', () => {
      expect(isValidPendingActionType('invalid')).toBe(false);
      expect(isValidPendingActionType('')).toBe(false);
    });
  });
});

// ============================================
// Type Tests (compile-time checks)
// ============================================

describe('Row Types', () => {
  it('should have correct MessageRow type', () => {
    const message: MessageRow = {
      id: 'msg_123',
      content: 'Hello world',
      sender: 'pubkey_abc',
      channel_id: 'chan_456',
      timestamp: Date.now(),
      status: 'sent',
      encrypted_content: null,
      reply_to: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    expect(message.id).toBe('msg_123');
    expect(message.status).toBe('sent');
  });

  it('should have correct ChannelRow type', () => {
    const channel: ChannelRow = {
      id: 'chan_123',
      type: 'location',
      name: 'Downtown',
      geohash: '9q8yyk',
      created_at: Date.now(),
      last_message_at: Date.now(),
      unread_count: 5,
      is_muted: false,
    };

    expect(channel.id).toBe('chan_123');
    expect(channel.type).toBe('location');
  });

  it('should have correct PeerRow type', () => {
    const peer: PeerRow = {
      pubkey: 'abc123',
      nickname: 'Alice',
      fingerprint: 'fp_123',
      last_seen: Date.now(),
      trust_level: 'trusted',
      metadata: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    expect(peer.pubkey).toBe('abc123');
    expect(peer.trust_level).toBe('trusted');
  });

  it('should have correct IdentityRow type', () => {
    const identity: IdentityRow = {
      id: 'id_123',
      pubkey: 'pubkey_abc',
      privkey_encrypted: 'encrypted_data',
      created_at: Date.now(),
      is_primary: true,
      label: 'Main Identity',
      derivation_path: null,
    };

    expect(identity.id).toBe('id_123');
    expect(identity.is_primary).toBe(true);
  });

  it('should have correct NostrEventRow type', () => {
    const event: NostrEventRow = {
      id: 'event_123',
      kind: 1,
      pubkey: 'pubkey_abc',
      content: 'Hello Nostr',
      tags: '[]',
      sig: 'sig_abc',
      created_at: Math.floor(Date.now() / 1000),
      received_at: Date.now(),
      is_processed: false,
    };

    expect(event.id).toBe('event_123');
    expect(event.kind).toBe(1);
  });

  it('should have correct RelayStatusRow type', () => {
    const relay: RelayStatusRow = {
      url: 'wss://relay.example.com',
      connected: true,
      last_connected: Date.now(),
      message_count: 100,
      failure_count: 2,
      last_error: null,
      updated_at: Date.now(),
    };

    expect(relay.url).toBe('wss://relay.example.com');
    expect(relay.connected).toBe(true);
  });

  it('should have correct PendingActionRow type', () => {
    const action: PendingActionRow = {
      id: 'action_123',
      action_type: 'send_message',
      payload: '{"messageId": "msg_123"}',
      created_at: Date.now(),
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      priority: 1,
    };

    expect(action.id).toBe('action_123');
    expect(action.action_type).toBe('send_message');
  });
});

// ============================================
// Migration System Tests
// ============================================

describe('Migration System', () => {
  describe('Migration Registry', () => {
    it('should have at least one migration', () => {
      expect(migrations.length).toBeGreaterThanOrEqual(1);
    });

    it('should have unique version numbers', () => {
      const versions = migrations.map(m => m.version);
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(versions.length);
    });

    it('should have sequential version numbers starting at 1', () => {
      const sortedVersions = migrations.map(m => m.version).sort((a, b) => a - b);
      for (let i = 0; i < sortedVersions.length; i++) {
        expect(sortedVersions[i]).toBe(i + 1);
      }
    });

    it('should get migration by version', () => {
      const migration = getMigration(1);
      expect(migration).toBeDefined();
      expect(migration?.version).toBe(1);
      expect(migration?.name).toBe('initial_schema');
    });

    it('should return undefined for non-existent version', () => {
      const migration = getMigration(999);
      expect(migration).toBeUndefined();
    });

    it('should get latest version', () => {
      const latest = getLatestVersion();
      expect(latest).toBe(Math.max(...migrations.map(m => m.version)));
    });
  });

  describe('InMemorySqlExecutor', () => {
    let executor: InMemorySqlExecutor;

    beforeEach(() => {
      executor = createTestExecutor();
    });

    it('should create tables', async () => {
      await executor.exec(CREATE_MESSAGES_TABLE);
      expect(executor.hasTable('messages')).toBe(true);
    });

    it('should drop tables', async () => {
      await executor.exec(CREATE_MESSAGES_TABLE);
      await executor.exec('DROP TABLE IF EXISTS messages');
      expect(executor.hasTable('messages')).toBe(false);
    });

    it('should handle transactions', async () => {
      await executor.exec(CREATE_MESSAGES_TABLE);
      await executor.beginTransaction();
      await executor.exec('DROP TABLE IF EXISTS messages');
      await executor.rollback();

      // Table should still exist after rollback
      expect(executor.hasTable('messages')).toBe(true);
    });

    it('should commit transactions', async () => {
      await executor.exec(CREATE_MESSAGES_TABLE);
      await executor.beginTransaction();
      await executor.exec('DROP TABLE IF EXISTS messages');
      await executor.commit();

      // Table should be gone after commit
      expect(executor.hasTable('messages')).toBe(false);
    });

    it('should throw on nested transactions', async () => {
      await executor.beginTransaction();

      await expect(executor.beginTransaction()).rejects.toThrow('Already in transaction');
    });

    it('should throw on commit without transaction', async () => {
      await expect(executor.commit()).rejects.toThrow('Not in transaction');
    });

    it('should throw on rollback without transaction', async () => {
      await expect(executor.rollback()).rejects.toThrow('Not in transaction');
    });
  });

  describe('MigrationRunner', () => {
    let executor: InMemorySqlExecutor;
    let runner: MigrationRunner;

    beforeEach(() => {
      executor = createTestExecutor();
      runner = createMigrationRunner(executor);
    });

    describe('initialize', () => {
      it('should create schema_migrations table', async () => {
        await runner.initialize();
        expect(executor.hasTable('schema_migrations')).toBe(true);
      });

      it('should be idempotent', async () => {
        await runner.initialize();
        await runner.initialize();
        expect(executor.hasTable('schema_migrations')).toBe(true);
      });
    });

    describe('getCurrentVersion', () => {
      it('should return 0 when no migrations applied', async () => {
        const version = await runner.getCurrentVersion();
        expect(version).toBe(0);
      });

      it('should return correct version after migrations', async () => {
        await runner.migrate();
        const version = await runner.getCurrentVersion();
        expect(version).toBe(getLatestVersion());
      });
    });

    describe('migrate', () => {
      it('should apply all pending migrations', async () => {
        const result = await runner.migrate();

        expect(result.success).toBe(true);
        expect(result.applied.length).toBe(migrations.length);
        expect(result.currentVersion).toBe(getLatestVersion());
      });

      it('should create all tables', async () => {
        await runner.migrate();

        expect(executor.hasTable('messages')).toBe(true);
        expect(executor.hasTable('channels')).toBe(true);
        expect(executor.hasTable('peers')).toBe(true);
        expect(executor.hasTable('identities')).toBe(true);
        expect(executor.hasTable('nostr_events')).toBe(true);
        expect(executor.hasTable('relay_status')).toBe(true);
        expect(executor.hasTable('pending_actions')).toBe(true);
      });

      it('should be idempotent', async () => {
        await runner.migrate();
        const result = await runner.migrate();

        expect(result.success).toBe(true);
        expect(result.applied.length).toBe(0);
      });

      it('should support dry run mode', async () => {
        const result = await runner.migrate({ dryRun: true });

        expect(result.success).toBe(true);
        expect(result.applied.length).toBe(migrations.length);

        // Tables should not be created in dry run
        expect(executor.hasTable('messages')).toBe(false);
      });
    });

    describe('getPendingMigrations', () => {
      it('should return all migrations when none applied', async () => {
        const pending = await runner.getPendingMigrations();
        expect(pending.length).toBe(migrations.length);
      });

      it('should return empty array when all applied', async () => {
        await runner.migrate();
        const pending = await runner.getPendingMigrations();
        expect(pending.length).toBe(0);
      });
    });

    describe('isApplied', () => {
      it('should return false for unapplied migration', async () => {
        const applied = await runner.isApplied(1);
        expect(applied).toBe(false);
      });

      it('should return true for applied migration', async () => {
        await runner.migrate();
        const applied = await runner.isApplied(1);
        expect(applied).toBe(true);
      });
    });

    describe('getAppliedMigrations', () => {
      it('should return empty array when none applied', async () => {
        const applied = await runner.getAppliedMigrations();
        expect(applied.length).toBe(0);
      });

      it('should return all applied migrations', async () => {
        await runner.migrate();
        const applied = await runner.getAppliedMigrations();

        expect(applied.length).toBe(migrations.length);
        expect(applied[0].version).toBe(1);
        expect(applied[0].name).toBe('initial_schema');
      });
    });

    describe('rollbackTo', () => {
      it('should rollback to specified version', async () => {
        await runner.migrate();
        const result = await runner.rollbackTo(0);

        expect(result.success).toBe(true);
        expect(result.currentVersion).toBe(0);
      });

      it('should drop tables on rollback', async () => {
        await runner.migrate();
        await runner.rollbackTo(0);

        expect(executor.hasTable('messages')).toBe(false);
        expect(executor.hasTable('channels')).toBe(false);
      });

      it('should do nothing when already at target version', async () => {
        await runner.migrate();
        const version = await runner.getCurrentVersion();
        const result = await runner.rollbackTo(version);

        expect(result.success).toBe(true);
        expect(result.applied.length).toBe(0);
      });
    });

    describe('rollbackLast', () => {
      it('should rollback the last migration', async () => {
        await runner.migrate();
        const beforeVersion = await runner.getCurrentVersion();
        await runner.rollbackLast();
        const afterVersion = await runner.getCurrentVersion();

        expect(afterVersion).toBe(beforeVersion - 1);
      });

      it('should do nothing when no migrations applied', async () => {
        const result = await runner.rollbackLast();

        expect(result.success).toBe(true);
        expect(result.currentVersion).toBe(0);
      });
    });

    describe('reset', () => {
      it('should rollback all migrations', async () => {
        await runner.migrate();
        const result = await runner.reset();

        expect(result.success).toBe(true);
        expect(result.currentVersion).toBe(0);
      });
    });

    describe('refresh', () => {
      it('should reset and re-run all migrations', async () => {
        await runner.migrate();
        const result = await runner.refresh();

        expect(result.success).toBe(true);
        expect(result.currentVersion).toBe(getLatestVersion());
        expect(executor.hasTable('messages')).toBe(true);
      });
    });
  });
});

// ============================================
// Migration Content Tests
// ============================================

describe('Migration 001: Initial Schema', () => {
  let executor: InMemorySqlExecutor;
  let runner: MigrationRunner;

  beforeEach(async () => {
    executor = createTestExecutor();
    runner = createMigrationRunner(executor);
    await runner.migrate();
  });

  it('should create all 7 core tables', () => {
    expect(executor.hasTable('messages')).toBe(true);
    expect(executor.hasTable('channels')).toBe(true);
    expect(executor.hasTable('peers')).toBe(true);
    expect(executor.hasTable('identities')).toBe(true);
    expect(executor.hasTable('nostr_events')).toBe(true);
    expect(executor.hasTable('relay_status')).toBe(true);
    expect(executor.hasTable('pending_actions')).toBe(true);
  });

  it('should create schema_migrations table', () => {
    expect(executor.hasTable('schema_migrations')).toBe(true);
  });

  it('should revert cleanly', async () => {
    await runner.reset();

    expect(executor.hasTable('messages')).toBe(false);
    expect(executor.hasTable('channels')).toBe(false);
    expect(executor.hasTable('peers')).toBe(false);
    expect(executor.hasTable('identities')).toBe(false);
    expect(executor.hasTable('nostr_events')).toBe(false);
    expect(executor.hasTable('relay_status')).toBe(false);
    expect(executor.hasTable('pending_actions')).toBe(false);
  });
});
