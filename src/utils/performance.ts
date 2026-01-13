/**
 * Performance Measurement Utilities
 *
 * Provides utilities for measuring and tracking performance metrics
 * in BitChat In Browser PWA. Includes timing helpers, memory tracking,
 * and standardized benchmark utilities.
 *
 * ## Performance Targets
 * - Initial bundle under 500KB
 * - First paint under 2 seconds
 * - Message send under 100ms
 * - 60fps scroll on message list
 *
 * @module utils/performance
 */

// MARK: - Types

/**
 * Performance measurement result
 */
export interface PerformanceResult {
  /** Name of the operation */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Number of operations performed */
  operations: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Memory usage in bytes (if available) */
  memoryUsage?: number;
  /** Memory delta from start to end (if available) */
  memoryDelta?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Name of the benchmark */
  name: string;
  /** Number of warmup iterations */
  warmup?: number;
  /** Number of iterations to run */
  iterations?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to track memory usage */
  trackMemory?: boolean;
  /** Custom setup function called before each iteration */
  setup?: () => void | Promise<void>;
  /** Custom teardown function called after each iteration */
  teardown?: () => void | Promise<void>;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  /** Used JS heap size in bytes */
  usedJSHeapSize: number;
  /** Total JS heap size in bytes */
  totalJSHeapSize: number;
  /** JS heap size limit in bytes */
  jsHeapSizeLimit: number;
  /** Timestamp of the snapshot */
  timestamp: number;
}

/**
 * Performance mark with metadata
 */
export interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// MARK: - Constants

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: Required<Omit<BenchmarkConfig, 'name' | 'setup' | 'teardown'>> = {
  warmup: 5,
  iterations: 100,
  timeout: 30000,
  trackMemory: true,
};

/**
 * Performance thresholds for BitChat
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Maximum initial bundle size in bytes */
  BUNDLE_SIZE: 500 * 1024, // 500KB
  /** Maximum first paint time in milliseconds */
  FIRST_PAINT: 2000, // 2s
  /** Maximum message send time in milliseconds */
  MESSAGE_SEND: 100, // 100ms
  /** Minimum scroll frame rate */
  SCROLL_FPS: 60,
  /** Maximum key generation time in milliseconds */
  KEY_GENERATION: 50, // 50ms
  /** Maximum encryption time for 1KB in milliseconds */
  ENCRYPTION_1KB: 5, // 5ms
  /** Maximum Noise handshake time in milliseconds */
  NOISE_HANDSHAKE: 20, // 20ms
  /** Maximum storage write latency in milliseconds */
  STORAGE_WRITE: 10, // 10ms
  /** Maximum storage read latency in milliseconds */
  STORAGE_READ: 5, // 5ms
  /** Maximum time to render 1000 messages in milliseconds */
  RENDER_1000_MESSAGES: 200, // 200ms
} as const;

// MARK: - Timing Utilities

/**
 * High-precision timer using Performance API
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;
  private marks: Map<string, number> = new Map();

  /**
   * Start the timer
   */
  start(): this {
    this.startTime = performance.now();
    this.endTime = 0;
    return this;
  }

  /**
   * Stop the timer
   */
  stop(): this {
    this.endTime = performance.now();
    return this;
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }

  /**
   * Mark a point in time
   */
  mark(name: string): this {
    this.marks.set(name, performance.now());
    return this;
  }

  /**
   * Get time since a mark
   */
  since(name: string): number {
    const markTime = this.marks.get(name);
    if (markTime === undefined) {
      throw new Error(`Mark "${name}" not found`);
    }
    return performance.now() - markTime;
  }

  /**
   * Get time between two marks
   */
  between(startMark: string, endMark: string): number {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    if (start === undefined || end === undefined) {
      throw new Error(`Mark not found: ${start === undefined ? startMark : endMark}`);
    }
    return end - start;
  }

  /**
   * Reset the timer
   */
  reset(): this {
    this.startTime = 0;
    this.endTime = 0;
    this.marks.clear();
    return this;
  }
}

/**
 * Time a synchronous function
 *
 * @param fn - Function to time
 * @returns Tuple of [result, duration in ms]
 */
export function timeSync<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return [result, duration];
}

/**
 * Time an asynchronous function
 *
 * @param fn - Async function to time
 * @returns Tuple of [result, duration in ms]
 */
export async function timeAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return [result, duration];
}

/**
 * Create a timing decorator for methods
 *
 * @param name - Name for the timing entry
 */
export function timed(name?: string) {
  return function <T extends (...args: unknown[]) => unknown>(
    _target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    const timingName = name ?? propertyKey;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const start = performance.now();
      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          console.debug(`[TIMING] ${timingName}: ${duration.toFixed(2)}ms`);
        });
      }

      const duration = performance.now() - start;
      console.debug(`[TIMING] ${timingName}: ${duration.toFixed(2)}ms`);
      return result;
    } as T;

    return descriptor;
  };
}

// MARK: - Memory Utilities

/**
 * Check if memory API is available
 */
export function isMemoryApiAvailable(): boolean {
  return typeof performance !== 'undefined' && 'memory' in performance;
}

/**
 * Get current memory snapshot
 *
 * @returns Memory snapshot or null if not available
 */
export function getMemorySnapshot(): MemorySnapshot | null {
  if (!isMemoryApiAvailable()) {
    return null;
  }

  const memory = (performance as Performance & { memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } }).memory;

  if (!memory) return null;

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    timestamp: Date.now(),
  };
}

/**
 * Calculate memory delta between two snapshots
 */
export function memoryDelta(before: MemorySnapshot, after: MemorySnapshot): number {
  return after.usedJSHeapSize - before.usedJSHeapSize;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Memory tracker for monitoring memory usage over time
 */
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Start tracking memory at regular intervals
   *
   * @param interval - Interval in milliseconds (default: 1000)
   */
  start(interval: number = 1000): void {
    this.stop();
    this.snapshots = [];

    this.intervalId = setInterval(() => {
      const snapshot = getMemorySnapshot();
      if (snapshot) {
        this.snapshots.push(snapshot);
      }
    }, interval);
  }

  /**
   * Stop tracking memory
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Take a single snapshot
   */
  snapshot(): MemorySnapshot | null {
    const snapshot = getMemorySnapshot();
    if (snapshot) {
      this.snapshots.push(snapshot);
    }
    return snapshot;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    min: number;
    max: number;
    avg: number;
    current: number;
    growth: number;
  } | null {
    if (this.snapshots.length === 0) return null;

    const values = this.snapshots.map(s => s.usedJSHeapSize);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const current = values[values.length - 1]!;
    const growth = values.length > 1 ? current - values[0]! : 0;

    return { min, max, avg, current, growth };
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}

// MARK: - Benchmark Utilities

/**
 * Run a benchmark with consistent configuration
 *
 * @param config - Benchmark configuration
 * @param fn - Function to benchmark
 * @returns Performance result
 */
export async function runBenchmark(
  config: BenchmarkConfig,
  fn: () => void | Promise<void>
): Promise<PerformanceResult> {
  const {
    name,
    warmup = DEFAULT_BENCHMARK_CONFIG.warmup,
    iterations = DEFAULT_BENCHMARK_CONFIG.iterations,
    trackMemory = DEFAULT_BENCHMARK_CONFIG.trackMemory,
    setup,
    teardown,
  } = config;

  // Warmup phase
  for (let i = 0; i < warmup; i++) {
    if (setup) await setup();
    await fn();
    if (teardown) await teardown();
  }

  // Record starting memory
  const startMemory = trackMemory ? getMemorySnapshot() : null;

  // Measurement phase
  const timer = new Timer().start();

  for (let i = 0; i < iterations; i++) {
    if (setup) await setup();
    await fn();
    if (teardown) await teardown();
  }

  timer.stop();
  const duration = timer.elapsed();

  // Record ending memory
  const endMemory = trackMemory ? getMemorySnapshot() : null;

  const result: PerformanceResult = {
    name,
    duration,
    operations: iterations,
    opsPerSecond: (iterations / duration) * 1000,
  };

  if (startMemory && endMemory) {
    result.memoryUsage = endMemory.usedJSHeapSize;
    result.memoryDelta = memoryDelta(startMemory, endMemory);
  }

  return result;
}

/**
 * Run multiple benchmarks and return results
 *
 * @param benchmarks - Array of benchmark configs and functions
 * @returns Array of performance results
 */
export async function runBenchmarkSuite(
  benchmarks: Array<{
    config: BenchmarkConfig;
    fn: () => void | Promise<void>;
  }>
): Promise<PerformanceResult[]> {
  const results: PerformanceResult[] = [];

  for (const { config, fn } of benchmarks) {
    const result = await runBenchmark(config, fn);
    results.push(result);
  }

  return results;
}

/**
 * Format benchmark results as a table
 */
export function formatBenchmarkResults(results: PerformanceResult[]): string {
  const lines: string[] = [
    '| Benchmark | Duration (ms) | Ops | Ops/sec | Memory |',
    '|-----------|---------------|-----|---------|--------|',
  ];

  for (const result of results) {
    const memory = result.memoryDelta !== undefined
      ? formatBytes(result.memoryDelta)
      : 'N/A';

    lines.push(
      `| ${result.name} | ${result.duration.toFixed(2)} | ${result.operations} | ${result.opsPerSecond.toFixed(2)} | ${memory} |`
    );
  }

  return lines.join('\n');
}

// MARK: - Frame Rate Utilities

/**
 * Frame rate monitor for measuring scroll performance
 */
export class FrameRateMonitor {
  private frames: number[] = [];
  private lastFrameTime: number = 0;
  private rafId: number | null = null;
  private isRunning: boolean = false;

  /**
   * Start monitoring frame rate
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frames = [];
    this.lastFrameTime = performance.now();
    this.tick();
  }

  private tick(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.frames.push(delta);
    this.lastFrameTime = now;

    this.rafId = requestAnimationFrame(() => this.tick());
  }

  /**
   * Stop monitoring frame rate
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get frame rate statistics
   */
  getStats(): {
    fps: number;
    minFps: number;
    maxFps: number;
    avgFrameTime: number;
    droppedFrames: number;
    totalFrames: number;
  } | null {
    if (this.frames.length < 2) return null;

    // Skip first frame (may be inaccurate)
    const frameTimes = this.frames.slice(1);
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1000 / avgFrameTime;

    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const maxFps = 1000 / minFrameTime;
    const minFps = 1000 / maxFrameTime;

    // Count frames that took longer than 16.67ms (60fps target)
    const droppedFrames = frameTimes.filter(t => t > 16.67).length;

    return {
      fps,
      minFps,
      maxFps,
      avgFrameTime,
      droppedFrames,
      totalFrames: frameTimes.length,
    };
  }

  /**
   * Check if frame rate meets target
   *
   * @param targetFps - Target FPS (default: 60)
   */
  meetsTarget(targetFps: number = 60): boolean {
    const stats = this.getStats();
    return stats !== null && stats.fps >= targetFps * 0.95; // Allow 5% tolerance
  }

  /**
   * Clear recorded frames
   */
  clear(): void {
    this.frames = [];
  }
}

// MARK: - Performance Observer Utilities

/**
 * Observe long tasks (tasks > 50ms)
 *
 * @param callback - Function called for each long task
 * @returns Cleanup function
 */
export function observeLongTasks(
  callback: (duration: number, startTime: number) => void
): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    console.warn('PerformanceObserver not available');
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry.duration, entry.startTime);
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    return () => observer.disconnect();
  } catch {
    // Long task observation not supported
    return () => {};
  }
}

/**
 * Observe paint timing (FCP, LCP)
 *
 * @param callback - Function called for each paint entry
 * @returns Cleanup function
 */
export function observePaintTiming(
  callback: (name: string, startTime: number) => void
): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    console.warn('PerformanceObserver not available');
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry.name, entry.startTime);
      }
    });

    observer.observe({ entryTypes: ['paint'] });

    return () => observer.disconnect();
  } catch {
    // Paint timing not supported
    return () => {};
  }
}

/**
 * Get Core Web Vitals metrics
 */
export async function getCoreWebVitals(): Promise<{
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
}> {
  const result = {
    fcp: null as number | null,
    lcp: null as number | null,
    cls: null as number | null,
    fid: null as number | null,
    ttfb: null as number | null,
  };

  // Get FCP from paint timing
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
  if (fcpEntry) {
    result.fcp = fcpEntry.startTime;
  }

  // Get TTFB from navigation timing
  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navEntries.length > 0) {
    result.ttfb = navEntries[0]!.responseStart;
  }

  return result;
}

// MARK: - Throughput Utilities

/**
 * Measure throughput (bytes per second)
 *
 * @param dataSize - Size of data in bytes
 * @param duration - Duration in milliseconds
 * @returns Throughput in bytes per second
 */
export function calculateThroughput(dataSize: number, duration: number): number {
  if (duration === 0) return Infinity;
  return (dataSize / duration) * 1000;
}

/**
 * Format throughput to human-readable string
 */
export function formatThroughput(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Measure encryption throughput
 *
 * @param encryptFn - Encryption function
 * @param dataSize - Size of test data in bytes
 * @param iterations - Number of iterations
 * @returns Throughput in bytes per second
 */
export async function measureEncryptionThroughput(
  encryptFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  dataSize: number,
  iterations: number = 100
): Promise<number> {
  const testData = new Uint8Array(dataSize);
  crypto.getRandomValues(testData);

  const timer = new Timer().start();

  for (let i = 0; i < iterations; i++) {
    await encryptFn(testData);
  }

  timer.stop();
  const totalBytes = dataSize * iterations;
  return calculateThroughput(totalBytes, timer.elapsed());
}

// MARK: - Performance Assertions

/**
 * Assert that a duration is within threshold
 *
 * @param actual - Actual duration in ms
 * @param threshold - Maximum allowed duration in ms
 * @param message - Error message
 * @throws Error if assertion fails
 */
export function assertDuration(
  actual: number,
  threshold: number,
  message?: string
): void {
  if (actual > threshold) {
    const msg = message ?? `Duration ${actual.toFixed(2)}ms exceeds threshold ${threshold}ms`;
    throw new Error(msg);
  }
}

/**
 * Assert that FPS meets target
 *
 * @param actual - Actual FPS
 * @param target - Target FPS
 * @param tolerance - Tolerance percentage (default: 5%)
 * @param message - Error message
 */
export function assertFps(
  actual: number,
  target: number,
  tolerance: number = 0.05,
  message?: string
): void {
  const minAllowed = target * (1 - tolerance);
  if (actual < minAllowed) {
    const msg = message ?? `FPS ${actual.toFixed(1)} is below target ${target} (min: ${minAllowed.toFixed(1)})`;
    throw new Error(msg);
  }
}

/**
 * Assert that throughput meets minimum
 *
 * @param actual - Actual throughput in bytes/second
 * @param minimum - Minimum required throughput
 * @param message - Error message
 */
export function assertThroughput(
  actual: number,
  minimum: number,
  message?: string
): void {
  if (actual < minimum) {
    const msg = message ?? `Throughput ${formatThroughput(actual)} is below minimum ${formatThroughput(minimum)}`;
    throw new Error(msg);
  }
}

// MARK: - Export Default Timer Instance

/**
 * Global timer instance for convenience
 */
export const globalTimer = new Timer();

/**
 * Global memory tracker instance
 */
export const globalMemoryTracker = new MemoryTracker();

/**
 * Global frame rate monitor instance
 */
export const globalFrameRateMonitor = new FrameRateMonitor();
