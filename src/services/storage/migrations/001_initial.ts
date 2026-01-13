/**
 * Migration 001: Initial Schema
 *
 * Creates all core tables and indexes for BitChat In Browser.
 *
 * Tables created:
 * - messages: Chat messages (encrypted and plain)
 * - channels: Location and DM channels
 * - peers: Known contacts/users
 * - identities: User keypairs
 * - nostr_events: Cached Nostr events
 * - relay_status: Relay connection tracking
 * - pending_actions: Outbox for offline-first
 *
 * @module storage/migrations/001_initial
 */

import type { Migration } from '../schema';
import {
  CREATE_MESSAGES_TABLE,
  CREATE_CHANNELS_TABLE,
  CREATE_PEERS_TABLE,
  CREATE_IDENTITIES_TABLE,
  CREATE_NOSTR_EVENTS_TABLE,
  CREATE_RELAY_STATUS_TABLE,
  CREATE_PENDING_ACTIONS_TABLE,
  MESSAGES_INDEXES,
  CHANNELS_INDEXES,
  PEERS_INDEXES,
  IDENTITIES_INDEXES,
  NOSTR_EVENTS_INDEXES,
  RELAY_STATUS_INDEXES,
  PENDING_ACTIONS_INDEXES,
} from '../schema';

/**
 * Initial database migration.
 *
 * This creates all the core tables and indexes needed for BitChat.
 * The schema is designed for offline-first operation with sync support.
 */
export const migration: Migration = {
  version: 1,
  name: 'initial_schema',

  /**
   * Apply the migration - create all tables and indexes.
   */
  async up(exec) {
    // Create core tables
    await exec(CREATE_MESSAGES_TABLE);
    await exec(CREATE_CHANNELS_TABLE);
    await exec(CREATE_PEERS_TABLE);
    await exec(CREATE_IDENTITIES_TABLE);
    await exec(CREATE_NOSTR_EVENTS_TABLE);
    await exec(CREATE_RELAY_STATUS_TABLE);
    await exec(CREATE_PENDING_ACTIONS_TABLE);

    // Create indexes for messages
    for (const sql of MESSAGES_INDEXES) {
      await exec(sql);
    }

    // Create indexes for channels
    for (const sql of CHANNELS_INDEXES) {
      await exec(sql);
    }

    // Create indexes for peers
    for (const sql of PEERS_INDEXES) {
      await exec(sql);
    }

    // Create indexes for identities
    for (const sql of IDENTITIES_INDEXES) {
      await exec(sql);
    }

    // Create indexes for nostr_events
    for (const sql of NOSTR_EVENTS_INDEXES) {
      await exec(sql);
    }

    // Create indexes for relay_status
    for (const sql of RELAY_STATUS_INDEXES) {
      await exec(sql);
    }

    // Create indexes for pending_actions
    for (const sql of PENDING_ACTIONS_INDEXES) {
      await exec(sql);
    }
  },

  /**
   * Revert the migration - drop all tables.
   *
   * WARNING: This will delete all data!
   */
  async down(exec) {
    // Drop indexes first (they're automatically dropped with tables, but explicit is better)
    // Note: SQLite automatically drops indexes when tables are dropped

    // Drop tables in reverse order of creation (for foreign key safety)
    await exec('DROP TABLE IF EXISTS pending_actions');
    await exec('DROP TABLE IF EXISTS relay_status');
    await exec('DROP TABLE IF EXISTS nostr_events');
    await exec('DROP TABLE IF EXISTS identities');
    await exec('DROP TABLE IF EXISTS peers');
    await exec('DROP TABLE IF EXISTS channels');
    await exec('DROP TABLE IF EXISTS messages');
  },
};

export default migration;
