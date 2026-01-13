/**
 * Utility Function Tests
 *
 * Tests for performance utilities, timing, memory tracking,
 * benchmarking, and frame rate monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Timer,
  timeSync,
  timeAsync,
  formatBytes,
  getMemorySnapshot,
  isMemoryApiAvailable,
  memoryDelta,
  MemoryTracker,
  runBenchmark,
  runBenchmarkSuite,
  formatBenchmarkResults,
  FrameRateMonitor,
  calculateThroughput,
  formatThroughput,
  assertDuration,
  assertFps,
  assertThroughput,
  PERFORMANCE_THRESHOLDS,
  DEFAULT_BENCHMARK_CONFIG,
  globalTimer,
  globalMemoryTracker,
  globalFrameRateMonitor,
} from '../performance';

describe('Performance Utilities', () => {
  describe('Timer', () => {
    let timer: Timer;

    beforeEach(() => {
      timer = new Timer();
    });

    describe('Basic Timing', () => {
      it('should start and stop timer', () => {
        timer.start();
        // Small delay
        const start = Date.now();
        while (Date.now() - start < 10) { /* busy wait */ }
        timer.stop();

        expect(timer.elapsed()).toBeGreaterThan(0);
      });

      it('should measure elapsed time during running', () => {
        timer.start();
        const elapsed = timer.elapsed();
        expect(elapsed).toBeGreaterThanOrEqual(0);
      });

      it('should return chainable this', () => {
        const result = timer.start();
        expect(result).toBe(timer);

        const result2 = timer.stop();
        expect(result2).toBe(timer);
      });

      it('should reset timer state', () => {
        timer.start();
        timer.stop();
        timer.reset();

        // After reset, elapsed should be 0 or very small
        expect(timer.elapsed()).toBeLessThanOrEqual(1);
      });
    });

    describe('Marks', () => {
      it('should create marks', () => {
        timer.start();
        timer.mark('checkpoint');

        // Should not throw
        expect(() => timer.since('checkpoint')).not.toThrow();
      });

      it('should measure time since mark', () => {
        timer.start();
        timer.mark('start');

        const start = Date.now();
        while (Date.now() - start < 5) { /* busy wait */ }

        const elapsed = timer.since('start');
        expect(elapsed).toBeGreaterThan(0);
      });

      it('should throw for unknown mark in since()', () => {
        expect(() => timer.since('unknown')).toThrow('Mark "unknown" not found');
      });

      it('should measure time between marks', () => {
        timer.start();
        timer.mark('a');

        const start = Date.now();
        while (Date.now() - start < 5) { /* busy wait */ }

        timer.mark('b');

        const between = timer.between('a', 'b');
        expect(between).toBeGreaterThan(0);
      });

      it('should throw for unknown marks in between()', () => {
        timer.mark('a');
        expect(() => timer.between('a', 'unknown')).toThrow();
        expect(() => timer.between('unknown', 'a')).toThrow();
      });

      it('should clear marks on reset', () => {
        timer.mark('test');
        timer.reset();

        expect(() => timer.since('test')).toThrow();
      });
    });
  });

  describe('Timing Functions', () => {
    describe('timeSync', () => {
      it('should time synchronous function', () => {
        const [result, duration] = timeSync(() => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) sum += i;
          return sum;
        });

        expect(result).toBe(499500);
        expect(duration).toBeGreaterThanOrEqual(0);
      });

      it('should return correct result', () => {
        const [result] = timeSync(() => 'hello');
        expect(result).toBe('hello');
      });
    });

    describe('timeAsync', () => {
      it('should time async function', async () => {
        const [result, duration] = await timeAsync(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 42;
        });

        expect(result).toBe(42);
        expect(duration).toBeGreaterThanOrEqual(10);
      });

      it('should handle rejected promises', async () => {
        await expect(
          timeAsync(async () => {
            throw new Error('Test error');
          })
        ).rejects.toThrow('Test error');
      });
    });
  });

  describe('Memory Utilities', () => {
    describe('isMemoryApiAvailable', () => {
      it('should return boolean', () => {
        const result = isMemoryApiAvailable();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('getMemorySnapshot', () => {
      it('should return snapshot or null', () => {
        const snapshot = getMemorySnapshot();

        // In test environment, memory API may not be available
        if (snapshot !== null) {
          expect(snapshot).toHaveProperty('usedJSHeapSize');
          expect(snapshot).toHaveProperty('totalJSHeapSize');
          expect(snapshot).toHaveProperty('jsHeapSizeLimit');
          expect(snapshot).toHaveProperty('timestamp');
        }
      });
    });

    describe('memoryDelta', () => {
      it('should calculate memory difference', () => {
        const before = {
          usedJSHeapSize: 1000,
          totalJSHeapSize: 2000,
          jsHeapSizeLimit: 4000,
          timestamp: Date.now(),
        };

        const after = {
          usedJSHeapSize: 1500,
          totalJSHeapSize: 2000,
          jsHeapSizeLimit: 4000,
          timestamp: Date.now(),
        };

        const delta = memoryDelta(before, after);
        expect(delta).toBe(500);
      });

      it('should handle negative delta (memory freed)', () => {
        const before = {
          usedJSHeapSize: 2000,
          totalJSHeapSize: 4000,
          jsHeapSizeLimit: 8000,
          timestamp: Date.now(),
        };

        const after = {
          usedJSHeapSize: 1000,
          totalJSHeapSize: 4000,
          jsHeapSizeLimit: 8000,
          timestamp: Date.now(),
        };

        const delta = memoryDelta(before, after);
        expect(delta).toBe(-1000);
      });
    });

    describe('formatBytes', () => {
      it('should format bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(500)).toBe('500.00 B');
        expect(formatBytes(1024)).toBe('1.00 KB');
        expect(formatBytes(1536)).toBe('1.50 KB');
        expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      });

      it('should handle negative values', () => {
        expect(formatBytes(-1024)).toBe('-1.00 KB');
      });
    });
  });

  describe('MemoryTracker', () => {
    let tracker: MemoryTracker;

    beforeEach(() => {
      tracker = new MemoryTracker();
    });

    afterEach(() => {
      tracker.stop();
    });

    describe('snapshot', () => {
      it('should take single snapshot', () => {
        tracker.snapshot();
        const snapshots = tracker.getSnapshots();
        // May be empty if memory API not available
        expect(snapshots).toBeInstanceOf(Array);
      });
    });

    describe('getSnapshots', () => {
      it('should return copy of snapshots', () => {
        tracker.snapshot();
        const snapshots1 = tracker.getSnapshots();
        const snapshots2 = tracker.getSnapshots();

        expect(snapshots1).toEqual(snapshots2);
        expect(snapshots1).not.toBe(snapshots2);
      });
    });

    describe('getStats', () => {
      it('should return null when no snapshots', () => {
        const stats = tracker.getStats();
        expect(stats).toBeNull();
      });
    });

    describe('clear', () => {
      it('should clear snapshots', () => {
        tracker.snapshot();
        tracker.clear();

        const snapshots = tracker.getSnapshots();
        expect(snapshots).toHaveLength(0);
      });
    });
  });

  describe('Benchmark Utilities', () => {
    describe('DEFAULT_BENCHMARK_CONFIG', () => {
      it('should have reasonable defaults', () => {
        expect(DEFAULT_BENCHMARK_CONFIG.warmup).toBeGreaterThan(0);
        expect(DEFAULT_BENCHMARK_CONFIG.iterations).toBeGreaterThan(0);
        expect(DEFAULT_BENCHMARK_CONFIG.timeout).toBeGreaterThan(0);
        expect(DEFAULT_BENCHMARK_CONFIG.trackMemory).toBe(true);
      });
    });

    describe('runBenchmark', () => {
      it('should run benchmark and return result', async () => {
        let counter = 0;
        const result = await runBenchmark(
          { name: 'test-counter', iterations: 10, warmup: 2 },
          () => { counter++; }
        );

        expect(result.name).toBe('test-counter');
        expect(result.operations).toBe(10);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.opsPerSecond).toBeGreaterThan(0);
        // Counter should be 12 (2 warmup + 10 iterations)
        expect(counter).toBe(12);
      });

      it('should run setup and teardown', async () => {
        let setupCount = 0;
        let teardownCount = 0;

        await runBenchmark(
          {
            name: 'test-lifecycle',
            iterations: 5,
            warmup: 0,
            setup: () => { setupCount++; },
            teardown: () => { teardownCount++; },
          },
          () => {}
        );

        expect(setupCount).toBe(5);
        expect(teardownCount).toBe(5);
      });

      it('should handle async functions', async () => {
        const result = await runBenchmark(
          { name: 'test-async', iterations: 3, warmup: 0 },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        );

        expect(result.duration).toBeGreaterThanOrEqual(3);
      });
    });

    describe('runBenchmarkSuite', () => {
      it('should run multiple benchmarks', async () => {
        const results = await runBenchmarkSuite([
          {
            config: { name: 'bench1', iterations: 5, warmup: 0 },
            fn: () => {},
          },
          {
            config: { name: 'bench2', iterations: 5, warmup: 0 },
            fn: () => {},
          },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('bench1');
        expect(results[1].name).toBe('bench2');
      });
    });

    describe('formatBenchmarkResults', () => {
      it('should format results as table', () => {
        const results = [
          {
            name: 'test1',
            duration: 100,
            operations: 1000,
            opsPerSecond: 10000,
          },
          {
            name: 'test2',
            duration: 200,
            operations: 500,
            opsPerSecond: 2500,
            memoryDelta: 1024,
          },
        ];

        const formatted = formatBenchmarkResults(results);

        expect(formatted).toContain('test1');
        expect(formatted).toContain('test2');
        expect(formatted).toContain('100.00');
        expect(formatted).toContain('200.00');
        expect(formatted).toContain('1.00 KB');
      });

      it('should show N/A for missing memory data', () => {
        const results = [{
          name: 'no-memory',
          duration: 100,
          operations: 10,
          opsPerSecond: 100,
        }];

        const formatted = formatBenchmarkResults(results);
        expect(formatted).toContain('N/A');
      });
    });
  });

  describe('FrameRateMonitor', () => {
    let monitor: FrameRateMonitor;

    beforeEach(() => {
      monitor = new FrameRateMonitor();
    });

    afterEach(() => {
      monitor.stop();
    });

    describe('getStats', () => {
      it('should return null when not enough frames', () => {
        const stats = monitor.getStats();
        expect(stats).toBeNull();
      });
    });

    describe('meetsTarget', () => {
      it('should return false when no data', () => {
        expect(monitor.meetsTarget()).toBe(false);
      });
    });

    describe('clear', () => {
      it('should clear recorded frames', () => {
        monitor.clear();
        expect(monitor.getStats()).toBeNull();
      });
    });
  });

  describe('Throughput Utilities', () => {
    describe('calculateThroughput', () => {
      it('should calculate bytes per second', () => {
        // 1MB in 1 second = 1MB/s
        const throughput = calculateThroughput(1024 * 1024, 1000);
        expect(throughput).toBe(1024 * 1024);
      });

      it('should handle zero duration', () => {
        const throughput = calculateThroughput(1000, 0);
        expect(throughput).toBe(Infinity);
      });

      it('should handle small durations', () => {
        // 1KB in 10ms = 100KB/s
        const throughput = calculateThroughput(1024, 10);
        expect(throughput).toBe(102400);
      });
    });

    describe('formatThroughput', () => {
      it('should format throughput with /s suffix', () => {
        expect(formatThroughput(1024)).toBe('1.00 KB/s');
        expect(formatThroughput(1024 * 1024)).toBe('1.00 MB/s');
      });
    });
  });

  describe('Performance Assertions', () => {
    describe('assertDuration', () => {
      it('should pass when within threshold', () => {
        expect(() => assertDuration(50, 100)).not.toThrow();
        expect(() => assertDuration(100, 100)).not.toThrow();
      });

      it('should throw when exceeding threshold', () => {
        expect(() => assertDuration(150, 100)).toThrow();
      });

      it('should include custom message', () => {
        expect(() => assertDuration(150, 100, 'Custom message')).toThrow('Custom message');
      });
    });

    describe('assertFps', () => {
      it('should pass when meeting target', () => {
        expect(() => assertFps(60, 60)).not.toThrow();
        expect(() => assertFps(58, 60, 0.05)).not.toThrow(); // 5% tolerance
      });

      it('should throw when below target', () => {
        expect(() => assertFps(50, 60)).toThrow();
      });

      it('should respect custom tolerance', () => {
        expect(() => assertFps(55, 60, 0.1)).not.toThrow(); // 10% tolerance
        expect(() => assertFps(50, 60, 0.1)).toThrow();
      });
    });

    describe('assertThroughput', () => {
      it('should pass when meeting minimum', () => {
        expect(() => assertThroughput(1024 * 1024, 1024)).not.toThrow();
      });

      it('should throw when below minimum', () => {
        expect(() => assertThroughput(512, 1024)).toThrow();
      });
    });
  });

  describe('Performance Thresholds', () => {
    it('should have defined thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.BUNDLE_SIZE).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.FIRST_PAINT).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.MESSAGE_SEND).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.SCROLL_FPS).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.KEY_GENERATION).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.ENCRYPTION_1KB).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.NOISE_HANDSHAKE).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.STORAGE_WRITE).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.STORAGE_READ).toBeDefined();
      expect(PERFORMANCE_THRESHOLDS.RENDER_1000_MESSAGES).toBeDefined();
    });

    it('should have reasonable values', () => {
      expect(PERFORMANCE_THRESHOLDS.BUNDLE_SIZE).toBe(500 * 1024); // 500KB
      expect(PERFORMANCE_THRESHOLDS.FIRST_PAINT).toBe(2000); // 2s
      expect(PERFORMANCE_THRESHOLDS.SCROLL_FPS).toBe(60); // 60fps
    });
  });

  describe('Global Instances', () => {
    it('should export globalTimer', () => {
      expect(globalTimer).toBeInstanceOf(Timer);
    });

    it('should export globalMemoryTracker', () => {
      expect(globalMemoryTracker).toBeInstanceOf(MemoryTracker);
    });

    it('should export globalFrameRateMonitor', () => {
      expect(globalFrameRateMonitor).toBeInstanceOf(FrameRateMonitor);
    });
  });
});

describe('Additional Utility Tests', () => {
  describe('Edge Cases', () => {
    it('should handle very short timings', () => {
      const timer = new Timer();
      timer.start().stop();
      expect(timer.elapsed()).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple start calls', () => {
      const timer = new Timer();
      timer.start();
      const elapsed1 = timer.elapsed();
      timer.start(); // Restart
      const elapsed2 = timer.elapsed();

      // elapsed2 should be smaller (timer was restarted)
      expect(elapsed2).toBeLessThanOrEqual(elapsed1 + 10);
    });

    it('should handle repeated marks with same name', () => {
      const timer = new Timer();
      timer.mark('test');

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 5) { /* busy wait */ }

      timer.mark('test'); // Overwrite

      const since = timer.since('test');
      expect(since).toBeLessThan(5); // Should be from new mark
    });
  });

  describe('Async Benchmark Edge Cases', () => {
    it('should handle async setup and teardown', async () => {
      let setupDone = false;
      let teardownDone = false;

      await runBenchmark(
        {
          name: 'async-lifecycle',
          iterations: 1,
          warmup: 0,
          setup: async () => {
            await new Promise(resolve => setTimeout(resolve, 1));
            setupDone = true;
          },
          teardown: async () => {
            await new Promise(resolve => setTimeout(resolve, 1));
            teardownDone = true;
          },
        },
        () => {}
      );

      expect(setupDone).toBe(true);
      expect(teardownDone).toBe(true);
    });

    it('should handle errors in benchmark function', async () => {
      await expect(
        runBenchmark(
          { name: 'error-test', iterations: 1, warmup: 0 },
          () => { throw new Error('Benchmark error'); }
        )
      ).rejects.toThrow('Benchmark error');
    });
  });

  describe('Memory Delta Edge Cases', () => {
    it('should handle equal snapshots', () => {
      const snapshot = {
        usedJSHeapSize: 1000,
        totalJSHeapSize: 2000,
        jsHeapSizeLimit: 4000,
        timestamp: Date.now(),
      };

      expect(memoryDelta(snapshot, snapshot)).toBe(0);
    });

    it('should handle large deltas', () => {
      const before = {
        usedJSHeapSize: 0,
        totalJSHeapSize: 1000,
        jsHeapSizeLimit: 2000,
        timestamp: Date.now(),
      };

      const after = {
        usedJSHeapSize: 1024 * 1024 * 1024, // 1GB
        totalJSHeapSize: 2 * 1024 * 1024 * 1024,
        jsHeapSizeLimit: 4 * 1024 * 1024 * 1024,
        timestamp: Date.now(),
      };

      const delta = memoryDelta(before, after);
      expect(delta).toBe(1024 * 1024 * 1024);
    });
  });

  describe('formatBytes Edge Cases', () => {
    it('should handle very large values', () => {
      const result = formatBytes(1024 * 1024 * 1024 * 1024);
      expect(result).toContain('GB');
    });

    it('should handle fractional bytes', () => {
      const result = formatBytes(1.5);
      expect(result).toBe('1.50 B');
    });
  });
});
