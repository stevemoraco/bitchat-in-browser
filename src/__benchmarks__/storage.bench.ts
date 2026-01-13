/**
 * Storage Performance Benchmarks
 *
 * Benchmarks for BitChat's storage operations including:
 * - Write throughput (single and bulk)
 * - Read latency
 * - IndexedDB vs OPFS comparison
 * - Bulk operations performance
 *
 * ## Performance Targets
 * - Write latency: < 10ms per record
 * - Read latency: < 5ms per record
 * - Bulk write: > 100 records/sec
 * - Bulk read: > 500 records/sec
 *
 * @module __benchmarks__/storage.bench
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  Timer,
  runBenchmark,
  formatBenchmarkResults,
  calculateThroughput,
  formatThroughput,
  PERFORMANCE_THRESHOLDS,
  type PerformanceResult,
} from '../utils/performance';
import { IndexedDBStorage, createIndexedDBStorage } from '../services/storage/indexeddb-storage';
import { OPFSStorage, createOPFSStorage } from '../services/storage/opfs-storage';
import type { StorageTableName } from '../services/storage/types';

// Benchmark results collector
const benchmarkResults: PerformanceResult[] = [];

// Test data generators
function generateTestRecord(id: string, sizeBytes: number = 500): Record<string, unknown> {
  const content = 'x'.repeat(Math.max(0, sizeBytes - 100));
  return {
    id,
    timestamp: Date.now(),
    content,
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  };
}

function generateTestRecords(count: number, sizeBytes: number = 500): Array<[string, Record<string, unknown>]> {
  const records: Array<[string, Record<string, unknown>]> = [];
  for (let i = 0; i < count; i++) {
    records.push([`test_${i}`, generateTestRecord(`test_${i}`, sizeBytes)]);
  }
  return records;
}

describe('Storage Benchmarks', () => {
  let indexedDBStorage: IndexedDBStorage | null = null;
  let opfsStorage: OPFSStorage | null = null;
  let opfsAvailable = false;

  beforeAll(async () => {
    // Initialize IndexedDB storage
    indexedDBStorage = createIndexedDBStorage({ dbName: 'bitchat_benchmark_test' });

    // Check and initialize OPFS storage
    opfsStorage = createOPFSStorage({ dbName: 'bitchat_benchmark_test_opfs' });
    opfsAvailable = await opfsStorage.isAvailable();

    if (!opfsAvailable) {
      console.log('OPFS not available in this environment, skipping OPFS benchmarks');
    }
  });

  afterAll(async () => {
    // Print benchmark summary
    console.log('\n=== Storage Benchmark Results ===\n');
    console.log(formatBenchmarkResults(benchmarkResults));

    // Clean up
    if (indexedDBStorage) {
      await indexedDBStorage.deleteDatabase();
    }
    if (opfsStorage && opfsAvailable) {
      await opfsStorage.deleteAll();
    }
  });

  describe('IndexedDB Storage', () => {
    const tableName: StorageTableName = 'messages';

    beforeEach(async () => {
      // Clear table before each test
      await indexedDBStorage!.clear(tableName);
    });

    afterEach(async () => {
      // Clean up after each test
      await indexedDBStorage!.clear(tableName);
    });

    describe('Write Operations', () => {
      it('should benchmark single write latency', async () => {
        const record = generateTestRecord('single_write', 500);

        const result = await runBenchmark(
          { name: 'IDB Single Write', iterations: 100, warmup: 10 },
          async () => {
            await indexedDBStorage!.set(tableName, `key_${Math.random()}`, record);
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Single Write: ${avgLatency.toFixed(3)}ms avg latency, ${result.opsPerSecond.toFixed(0)} writes/sec`
        );

        expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_WRITE);
      });

      it('should benchmark bulk write throughput (10 records)', async () => {
        const records = generateTestRecords(10, 500);

        const result = await runBenchmark(
          { name: 'IDB Bulk Write (10)', iterations: 50, warmup: 5 },
          async () => {
            await indexedDBStorage!.setMany(tableName, records);
          }
        );

        benchmarkResults.push(result);

        const totalRecords = 10 * result.operations;
        const recordsPerSec = (totalRecords / result.duration) * 1000;
        console.log(
          `IDB Bulk Write (10): ${(result.duration / result.operations).toFixed(3)}ms per batch, ${recordsPerSec.toFixed(0)} records/sec`
        );
      });

      it('should benchmark bulk write throughput (100 records)', async () => {
        const records = generateTestRecords(100, 500);

        const result = await runBenchmark(
          { name: 'IDB Bulk Write (100)', iterations: 20, warmup: 3 },
          async () => {
            await indexedDBStorage!.setMany(tableName, records);
          }
        );

        benchmarkResults.push(result);

        const totalRecords = 100 * result.operations;
        const recordsPerSec = (totalRecords / result.duration) * 1000;
        console.log(
          `IDB Bulk Write (100): ${(result.duration / result.operations).toFixed(3)}ms per batch, ${recordsPerSec.toFixed(0)} records/sec`
        );

        // Should achieve at least 100 records/sec
        expect(recordsPerSec).toBeGreaterThan(100);
      });

      it('should benchmark write throughput by record size', async () => {
        const sizes = [
          { name: '100B', size: 100 },
          { name: '1KB', size: 1024 },
          { name: '10KB', size: 10240 },
          { name: '100KB', size: 102400 },
        ];

        for (const { name: sizeName, size } of sizes) {
          const record = generateTestRecord(`size_test`, size);

          const timer = new Timer().start();
          const iterations = 50;

          for (let i = 0; i < iterations; i++) {
            await indexedDBStorage!.set(tableName, `key_${i}`, record);
          }

          timer.stop();
          const avgLatency = timer.elapsed() / iterations;
          const throughput = calculateThroughput(size, avgLatency);

          console.log(
            `IDB Write ${sizeName}: ${avgLatency.toFixed(3)}ms, ${formatThroughput(throughput)}`
          );

          // Clear for next test
          await indexedDBStorage!.clear(tableName);
        }
      });
    });

    describe('Read Operations', () => {
      const testKey = 'read_test_key';
      const testRecord = generateTestRecord(testKey, 500);

      beforeEach(async () => {
        // Seed data for read tests
        await indexedDBStorage!.set(tableName, testKey, testRecord);
      });

      it('should benchmark single read latency', async () => {
        const result = await runBenchmark(
          { name: 'IDB Single Read', iterations: 200, warmup: 20 },
          async () => {
            await indexedDBStorage!.get(tableName, testKey);
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Single Read: ${avgLatency.toFixed(3)}ms avg latency, ${result.opsPerSecond.toFixed(0)} reads/sec`
        );

        expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_READ);
      });

      it('should benchmark bulk read throughput', async () => {
        // Seed 100 records
        const records = generateTestRecords(100, 500);
        await indexedDBStorage!.setMany(tableName, records);
        const keys = records.map(([key]) => key);

        const result = await runBenchmark(
          { name: 'IDB Bulk Read (100)', iterations: 50, warmup: 5 },
          async () => {
            await indexedDBStorage!.getMany(tableName, keys);
          }
        );

        benchmarkResults.push(result);

        const totalRecords = 100 * result.operations;
        const recordsPerSec = (totalRecords / result.duration) * 1000;
        console.log(
          `IDB Bulk Read (100): ${(result.duration / result.operations).toFixed(3)}ms per batch, ${recordsPerSec.toFixed(0)} records/sec`
        );

        // Should achieve at least 500 records/sec
        expect(recordsPerSec).toBeGreaterThan(500);
      });

      it('should benchmark getAll performance', async () => {
        // Seed 500 records
        const records = generateTestRecords(500, 200);
        await indexedDBStorage!.setMany(tableName, records);

        const result = await runBenchmark(
          { name: 'IDB GetAll (500)', iterations: 20, warmup: 3 },
          async () => {
            await indexedDBStorage!.getAll(tableName);
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB GetAll (500 records): ${avgLatency.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
        );
      });

      it('should benchmark key listing performance', async () => {
        // Seed 1000 records
        const records = generateTestRecords(1000, 100);
        await indexedDBStorage!.setMany(tableName, records);

        const result = await runBenchmark(
          { name: 'IDB Keys (1000)', iterations: 30, warmup: 5 },
          async () => {
            await indexedDBStorage!.keys(tableName);
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Keys (1000 records): ${avgLatency.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
        );
      });
    });

    describe('Mixed Operations', () => {
      it('should benchmark read-after-write pattern', async () => {
        const record = generateTestRecord('rw_test', 500);

        const result = await runBenchmark(
          { name: 'IDB Read-After-Write', iterations: 100, warmup: 10 },
          async () => {
            const key = `rw_${Math.random()}`;
            await indexedDBStorage!.set(tableName, key, record);
            await indexedDBStorage!.get(tableName, key);
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Read-After-Write: ${avgLatency.toFixed(3)}ms per cycle, ${result.opsPerSecond.toFixed(0)} cycles/sec`
        );
      });

      it('should benchmark update pattern', async () => {
        const key = 'update_test';
        await indexedDBStorage!.set(tableName, key, generateTestRecord(key, 500));

        const result = await runBenchmark(
          { name: 'IDB Update', iterations: 100, warmup: 10 },
          async () => {
            await indexedDBStorage!.set(tableName, key, generateTestRecord(key, 500));
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Update: ${avgLatency.toFixed(3)}ms per update, ${result.opsPerSecond.toFixed(0)} updates/sec`
        );
      });

      it('should benchmark delete operations', async () => {
        // Pre-seed keys
        const keys: string[] = [];
        for (let i = 0; i < 100; i++) {
          const key = `delete_${i}`;
          keys.push(key);
          await indexedDBStorage!.set(tableName, key, generateTestRecord(key, 100));
        }

        let keyIndex = 0;
        const result = await runBenchmark(
          { name: 'IDB Delete', iterations: 100, warmup: 0 },
          async () => {
            if (keyIndex < keys.length) {
              await indexedDBStorage!.delete(tableName, keys[keyIndex]!);
              keyIndex++;
            }
          }
        );

        benchmarkResults.push(result);

        const avgLatency = result.duration / result.operations;
        console.log(
          `IDB Delete: ${avgLatency.toFixed(3)}ms per delete, ${result.opsPerSecond.toFixed(0)} deletes/sec`
        );
      });
    });
  });

  describe('OPFS Storage', () => {
    const tableName: StorageTableName = 'messages';

    beforeEach(async () => {
      if (!opfsAvailable) return;
      await opfsStorage!.clear(tableName);
    });

    afterEach(async () => {
      if (!opfsAvailable) return;
      await opfsStorage!.clear(tableName);
    });

    it.skipIf(!opfsAvailable)('should benchmark single write latency', async () => {
      const record = generateTestRecord('single_write', 500);

      const result = await runBenchmark(
        { name: 'OPFS Single Write', iterations: 50, warmup: 5 },
        async () => {
          await opfsStorage!.set(tableName, `key_${Math.random()}`, record);
        }
      );

      benchmarkResults.push(result);

      const avgLatency = result.duration / result.operations;
      console.log(
        `OPFS Single Write: ${avgLatency.toFixed(3)}ms avg latency, ${result.opsPerSecond.toFixed(0)} writes/sec`
      );
    });

    it.skipIf(!opfsAvailable)('should benchmark single read latency', async () => {
      const testKey = 'read_test';
      await opfsStorage!.set(tableName, testKey, generateTestRecord(testKey, 500));

      const result = await runBenchmark(
        { name: 'OPFS Single Read', iterations: 100, warmup: 10 },
        async () => {
          await opfsStorage!.get(tableName, testKey);
        }
      );

      benchmarkResults.push(result);

      const avgLatency = result.duration / result.operations;
      console.log(
        `OPFS Single Read: ${avgLatency.toFixed(3)}ms avg latency, ${result.opsPerSecond.toFixed(0)} reads/sec`
      );
    });

    it.skipIf(!opfsAvailable)('should benchmark bulk write throughput', async () => {
      const records = generateTestRecords(50, 500);

      const result = await runBenchmark(
        { name: 'OPFS Bulk Write (50)', iterations: 10, warmup: 2 },
        async () => {
          await opfsStorage!.setMany(tableName, records);
        }
      );

      benchmarkResults.push(result);

      const totalRecords = 50 * result.operations;
      const recordsPerSec = (totalRecords / result.duration) * 1000;
      console.log(
        `OPFS Bulk Write (50): ${(result.duration / result.operations).toFixed(3)}ms per batch, ${recordsPerSec.toFixed(0)} records/sec`
      );
    });

    it.skipIf(!opfsAvailable)('should benchmark getAll performance', async () => {
      // Seed 200 records
      const records = generateTestRecords(200, 200);
      await opfsStorage!.setMany(tableName, records);

      const result = await runBenchmark(
        { name: 'OPFS GetAll (200)', iterations: 10, warmup: 2 },
        async () => {
          await opfsStorage!.getAll(tableName);
        }
      );

      benchmarkResults.push(result);

      const avgLatency = result.duration / result.operations;
      console.log(
        `OPFS GetAll (200 records): ${avgLatency.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );
    });
  });

  describe('IndexedDB vs OPFS Comparison', () => {
    const tableName: StorageTableName = 'messages';

    it.skipIf(!opfsAvailable)('should compare write performance', async () => {
      const record = generateTestRecord('compare_write', 1024);
      const iterations = 30;

      // IndexedDB
      await indexedDBStorage!.clear(tableName);
      const idbTimer = new Timer().start();
      for (let i = 0; i < iterations; i++) {
        await indexedDBStorage!.set(tableName, `idb_${i}`, record);
      }
      idbTimer.stop();
      const idbAvg = idbTimer.elapsed() / iterations;

      // OPFS
      await opfsStorage!.clear(tableName);
      const opfsTimer = new Timer().start();
      for (let i = 0; i < iterations; i++) {
        await opfsStorage!.set(tableName, `opfs_${i}`, record);
      }
      opfsTimer.stop();
      const opfsAvg = opfsTimer.elapsed() / iterations;

      console.log('\n=== Write Performance Comparison (1KB records) ===');
      console.log(`IndexedDB: ${idbAvg.toFixed(3)}ms per write`);
      console.log(`OPFS:      ${opfsAvg.toFixed(3)}ms per write`);
      console.log(`Ratio:     ${(opfsAvg / idbAvg).toFixed(2)}x (${opfsAvg < idbAvg ? 'OPFS faster' : 'IDB faster'})`);
    });

    it.skipIf(!opfsAvailable)('should compare read performance', async () => {
      const testKey = 'compare_read';
      const record = generateTestRecord(testKey, 1024);
      const iterations = 50;

      // Setup
      await indexedDBStorage!.set(tableName, testKey, record);
      await opfsStorage!.set(tableName, testKey, record);

      // IndexedDB
      const idbTimer = new Timer().start();
      for (let i = 0; i < iterations; i++) {
        await indexedDBStorage!.get(tableName, testKey);
      }
      idbTimer.stop();
      const idbAvg = idbTimer.elapsed() / iterations;

      // OPFS
      const opfsTimer = new Timer().start();
      for (let i = 0; i < iterations; i++) {
        await opfsStorage!.get(tableName, testKey);
      }
      opfsTimer.stop();
      const opfsAvg = opfsTimer.elapsed() / iterations;

      console.log('\n=== Read Performance Comparison (1KB records) ===');
      console.log(`IndexedDB: ${idbAvg.toFixed(3)}ms per read`);
      console.log(`OPFS:      ${opfsAvg.toFixed(3)}ms per read`);
      console.log(`Ratio:     ${(opfsAvg / idbAvg).toFixed(2)}x (${opfsAvg < idbAvg ? 'OPFS faster' : 'IDB faster'})`);
    });

    it.skipIf(!opfsAvailable)('should compare bulk operation performance', async () => {
      const records = generateTestRecords(100, 500);
      const keys = records.map(([key]) => key);

      // IndexedDB Write
      await indexedDBStorage!.clear(tableName);
      const idbWriteTimer = new Timer().start();
      await indexedDBStorage!.setMany(tableName, records);
      idbWriteTimer.stop();

      // OPFS Write
      await opfsStorage!.clear(tableName);
      const opfsWriteTimer = new Timer().start();
      await opfsStorage!.setMany(tableName, records);
      opfsWriteTimer.stop();

      // IndexedDB Read
      const idbReadTimer = new Timer().start();
      await indexedDBStorage!.getMany(tableName, keys);
      idbReadTimer.stop();

      // OPFS Read
      const opfsReadTimer = new Timer().start();
      await opfsStorage!.getMany(tableName, keys);
      opfsReadTimer.stop();

      console.log('\n=== Bulk Operation Comparison (100 records, 500B each) ===');
      console.log('Write:');
      console.log(`  IndexedDB: ${idbWriteTimer.elapsed().toFixed(0)}ms total`);
      console.log(`  OPFS:      ${opfsWriteTimer.elapsed().toFixed(0)}ms total`);
      console.log('Read:');
      console.log(`  IndexedDB: ${idbReadTimer.elapsed().toFixed(0)}ms total`);
      console.log(`  OPFS:      ${opfsReadTimer.elapsed().toFixed(0)}ms total`);
    });
  });

  describe('Stress Tests', () => {
    const tableName: StorageTableName = 'messages';

    it('should handle 1000 sequential writes', async () => {
      await indexedDBStorage!.clear(tableName);
      const record = generateTestRecord('stress', 256);

      const timer = new Timer().start();
      for (let i = 0; i < 1000; i++) {
        await indexedDBStorage!.set(tableName, `stress_${i}`, record);
      }
      timer.stop();

      const avgLatency = timer.elapsed() / 1000;
      console.log(
        `1000 Sequential Writes: ${timer.elapsed().toFixed(0)}ms total, ${avgLatency.toFixed(3)}ms avg`
      );

      // Should complete in reasonable time
      expect(timer.elapsed()).toBeLessThan(30000); // < 30 seconds
    });

    it('should handle concurrent reads', async () => {
      // Seed 100 records
      const records = generateTestRecords(100, 500);
      await indexedDBStorage!.setMany(tableName, records);
      const keys = records.map(([key]) => key);

      const timer = new Timer().start();

      // Perform 100 concurrent reads
      await Promise.all(keys.map(key => indexedDBStorage!.get(tableName, key)));

      timer.stop();

      console.log(
        `100 Concurrent Reads: ${timer.elapsed().toFixed(0)}ms total, ${(timer.elapsed() / 100).toFixed(3)}ms avg`
      );

      // Should handle concurrent access efficiently
      expect(timer.elapsed()).toBeLessThan(1000); // < 1 second
    });

    it('should handle mixed concurrent operations', async () => {
      await indexedDBStorage!.clear(tableName);
      const record = generateTestRecord('mixed', 256);

      const timer = new Timer().start();
      const operations: Promise<unknown>[] = [];

      // Mix of writes and reads
      for (let i = 0; i < 200; i++) {
        if (i % 2 === 0) {
          operations.push(indexedDBStorage!.set(tableName, `mixed_${i}`, record));
        } else {
          operations.push(indexedDBStorage!.get(tableName, `mixed_${i - 1}`));
        }
      }

      await Promise.all(operations);
      timer.stop();

      console.log(
        `200 Mixed Concurrent Ops: ${timer.elapsed().toFixed(0)}ms total, ${(timer.elapsed() / 200).toFixed(3)}ms avg`
      );
    });

    it('should handle large record writes', async () => {
      await indexedDBStorage!.clear(tableName);

      // 100KB record
      const largeRecord = generateTestRecord('large', 100 * 1024);

      const timer = new Timer().start();
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await indexedDBStorage!.set(tableName, `large_${i}`, largeRecord);
      }

      timer.stop();
      const avgLatency = timer.elapsed() / iterations;
      const throughput = calculateThroughput(100 * 1024, avgLatency);

      console.log(
        `100KB Record Writes: ${avgLatency.toFixed(3)}ms avg, ${formatThroughput(throughput)}`
      );
    });
  });

  describe('Message-like Operations (BitChat Simulation)', () => {
    const tableName: StorageTableName = 'messages';

    it('should simulate storing chat messages', async () => {
      await indexedDBStorage!.clear(tableName);

      // Simulate typical chat message structure
      const createMessage = (id: number) => ({
        id: `msg_${id}`,
        channelId: 'channel_123',
        senderId: 'user_456',
        content: `This is test message number ${id} with some realistic content length.`,
        timestamp: Date.now(),
        signature: 'a'.repeat(128), // Simulated signature
        encrypted: true,
        delivered: true,
        read: false,
      });

      const timer = new Timer().start();
      const count = 500;

      // Store messages like a chat app would
      for (let i = 0; i < count; i++) {
        const message = createMessage(i);
        await indexedDBStorage!.set(tableName, message.id, message);
      }

      timer.stop();

      console.log(
        `Chat Message Simulation (${count} messages): ${timer.elapsed().toFixed(0)}ms total, ${(timer.elapsed() / count).toFixed(3)}ms per message`
      );

      // Should meet the 10ms target per write
      expect(timer.elapsed() / count).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_WRITE);
    });

    it('should simulate loading recent messages', async () => {
      // Get keys for "recent" messages
      const allKeys = await indexedDBStorage!.keys(tableName);
      const recentKeys = allKeys.slice(-100); // Last 100 messages

      const timer = new Timer().start();
      const messages = await indexedDBStorage!.getMany(tableName, recentKeys);
      timer.stop();

      console.log(
        `Load Recent Messages (${recentKeys.length}): ${timer.elapsed().toFixed(0)}ms total`
      );

      expect(messages.length).toBe(recentKeys.length);
      expect(timer.elapsed()).toBeLessThan(500); // < 500ms to load 100 messages
    });

    it('should simulate channel message retrieval pattern', async () => {
      // Simulate getting all messages (then filtering by channel in app code)
      const timer = new Timer().start();
      const allMessages = await indexedDBStorage!.getAll(tableName);
      timer.stop();

      console.log(
        `Load All Messages (${allMessages.length}): ${timer.elapsed().toFixed(0)}ms`
      );

      // For 500 messages, should be fast
      if (allMessages.length >= 500) {
        expect(timer.elapsed()).toBeLessThan(1000); // < 1s
      }
    });
  });
});
