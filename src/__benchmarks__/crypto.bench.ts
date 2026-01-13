/**
 * Cryptography Performance Benchmarks
 *
 * Benchmarks for BitChat's cryptographic operations including:
 * - Key generation (X25519, Ed25519)
 * - Encryption throughput (ChaCha20-Poly1305)
 * - Digital signatures (Ed25519)
 * - Noise Protocol XX handshakes
 *
 * ## Performance Targets
 * - Key generation: < 50ms
 * - Encryption (1KB): < 5ms
 * - Signing: < 5ms
 * - Noise handshake: < 20ms
 *
 * @module __benchmarks__/crypto.bench
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Timer,
  runBenchmark,
  formatBenchmarkResults,
  measureEncryptionThroughput,
  PERFORMANCE_THRESHOLDS,
  assertDuration,
  type PerformanceResult,
} from '../utils/performance';
import { loadSodium, isSodiumReady } from '../services/crypto/init';
import { generateX25519KeyPair, generateEd25519KeyPair } from '../services/crypto/keys';
import {
  encryptChaCha20Poly1305,
  decryptChaCha20Poly1305,
  generateKey,
} from '../services/crypto/encryption';
import { sign, verify } from '../services/crypto/signing';
import {
  NoiseSession,
  NoiseRole,
  generateNoiseKeyPair,
  performXXHandshake,
} from '../services/crypto/noise';

// Benchmark results collector
const benchmarkResults: PerformanceResult[] = [];

describe('Crypto Benchmarks', () => {
  beforeAll(async () => {
    // Initialize sodium
    await loadSodium();
    expect(isSodiumReady()).toBe(true);
  });

  afterAll(() => {
    // Print benchmark summary
    console.log('\n=== Crypto Benchmark Results ===\n');
    console.log(formatBenchmarkResults(benchmarkResults));
  });

  describe('Key Generation', () => {
    it('should benchmark X25519 key pair generation', async () => {
      const result = await runBenchmark(
        { name: 'X25519 KeyGen', iterations: 1000, warmup: 50 },
        () => {
          generateX25519KeyPair();
        }
      );

      benchmarkResults.push(result);

      // Assert single operation is fast enough
      const avgDuration = result.duration / result.operations;
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.KEY_GENERATION);

      console.log(
        `X25519 KeyGen: ${avgDuration.toFixed(3)}ms per operation, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );
    });

    it('should benchmark Ed25519 key pair generation', async () => {
      const result = await runBenchmark(
        { name: 'Ed25519 KeyGen', iterations: 1000, warmup: 50 },
        () => {
          generateEd25519KeyPair();
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.KEY_GENERATION);

      console.log(
        `Ed25519 KeyGen: ${avgDuration.toFixed(3)}ms per operation, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );
    });

    it('should benchmark Noise key pair generation', async () => {
      const result = await runBenchmark(
        { name: 'Noise KeyGen', iterations: 1000, warmup: 50 },
        () => {
          generateNoiseKeyPair();
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.KEY_GENERATION);

      console.log(
        `Noise KeyGen: ${avgDuration.toFixed(3)}ms per operation, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );
    });
  });

  describe('Encryption Throughput', () => {
    const key = generateKey();
    const testSizes = [
      { name: '64B', size: 64 },
      { name: '1KB', size: 1024 },
      { name: '4KB', size: 4096 },
      { name: '64KB', size: 65536 },
      { name: '1MB', size: 1024 * 1024 },
    ];

    for (const { name: sizeName, size } of testSizes) {
      it(`should benchmark encryption throughput for ${sizeName}`, async () => {
        const testData = new Uint8Array(size);
        crypto.getRandomValues(testData);

        const result = await runBenchmark(
          { name: `Encrypt ${sizeName}`, iterations: size > 100000 ? 10 : 100, warmup: 5 },
          () => {
            encryptChaCha20Poly1305(testData, key);
          }
        );

        benchmarkResults.push(result);

        // Calculate throughput
        const totalBytes = size * result.operations;
        const throughputMBps = (totalBytes / result.duration / 1024).toFixed(2);

        console.log(
          `Encrypt ${sizeName}: ${(result.duration / result.operations).toFixed(3)}ms per op, ${throughputMBps} MB/s`
        );

        // For 1KB, should be under threshold
        if (size === 1024) {
          const avgDuration = result.duration / result.operations;
          expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.ENCRYPTION_1KB);
        }
      });
    }

    it('should benchmark encryption/decryption round-trip', async () => {
      const testData = new Uint8Array(1024);
      crypto.getRandomValues(testData);

      const result = await runBenchmark(
        { name: 'Encrypt+Decrypt 1KB', iterations: 100, warmup: 10 },
        () => {
          const { ciphertext, nonce } = encryptChaCha20Poly1305(testData, key);
          decryptChaCha20Poly1305(ciphertext, key, nonce);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Encrypt+Decrypt 1KB: ${avgDuration.toFixed(3)}ms per round-trip, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      // Round-trip should be under 2x encryption threshold
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.ENCRYPTION_1KB * 2);
    });

    it('should measure sustained encryption throughput', async () => {
      const throughput = await measureEncryptionThroughput(
        (data) => encryptChaCha20Poly1305(data, key).ciphertext,
        4096, // 4KB chunks
        100   // 100 iterations
      );

      const throughputMBps = (throughput / 1024 / 1024).toFixed(2);
      console.log(`Sustained encryption throughput: ${throughputMBps} MB/s`);

      // Should achieve at least 10 MB/s
      expect(throughput).toBeGreaterThan(10 * 1024 * 1024);
    });
  });

  describe('Digital Signatures', () => {
    const keyPair = generateEd25519KeyPair();
    const testMessage = new Uint8Array(256);
    crypto.getRandomValues(testMessage);

    it('should benchmark signing performance', async () => {
      const result = await runBenchmark(
        { name: 'Ed25519 Sign', iterations: 1000, warmup: 50 },
        () => {
          sign(testMessage, keyPair.privateKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Ed25519 Sign: ${avgDuration.toFixed(3)}ms per op, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(5); // < 5ms per signature
    });

    it('should benchmark verification performance', async () => {
      const { signature } = sign(testMessage, keyPair.privateKey);

      const result = await runBenchmark(
        { name: 'Ed25519 Verify', iterations: 1000, warmup: 50 },
        () => {
          verify(testMessage, signature, keyPair.publicKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Ed25519 Verify: ${avgDuration.toFixed(3)}ms per op, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(5); // < 5ms per verification
    });

    it('should benchmark sign+verify round-trip', async () => {
      const result = await runBenchmark(
        { name: 'Sign+Verify', iterations: 500, warmup: 25 },
        () => {
          const { signature } = sign(testMessage, keyPair.privateKey);
          verify(testMessage, signature, keyPair.publicKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Sign+Verify: ${avgDuration.toFixed(3)}ms per round-trip, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(10); // < 10ms per round-trip
    });

    it('should benchmark signing with various message sizes', async () => {
      const sizes = [32, 256, 1024, 4096];

      for (const size of sizes) {
        const message = new Uint8Array(size);
        crypto.getRandomValues(message);

        const timer = new Timer().start();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          sign(message, keyPair.privateKey);
        }

        timer.stop();
        const avgDuration = timer.elapsed() / iterations;

        console.log(`Sign ${size}B: ${avgDuration.toFixed(3)}ms per op`);

        // Signature time shouldn't vary much with message size
        expect(avgDuration).toBeLessThan(10);
      }
    });
  });

  describe('Noise Protocol Handshakes', () => {
    it('should benchmark complete XX handshake', async () => {
      const result = await runBenchmark(
        { name: 'Noise XX Handshake', iterations: 100, warmup: 10 },
        () => {
          const initiatorKey = generateNoiseKeyPair();
          const responderKey = generateNoiseKeyPair();
          performXXHandshake(initiatorKey, responderKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Noise XX Handshake: ${avgDuration.toFixed(3)}ms per handshake, ${result.opsPerSecond.toFixed(0)} handshakes/sec`
      );

      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.NOISE_HANDSHAKE);
    });

    it('should benchmark handshake with pre-generated keys', async () => {
      // Pre-generate keys
      const initiatorKey = generateNoiseKeyPair();
      const responderKey = generateNoiseKeyPair();

      const result = await runBenchmark(
        { name: 'Noise XX (pre-keyed)', iterations: 200, warmup: 20 },
        () => {
          performXXHandshake(initiatorKey, responderKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Noise XX (pre-keyed): ${avgDuration.toFixed(3)}ms per handshake, ${result.opsPerSecond.toFixed(0)} handshakes/sec`
      );
    });

    it('should benchmark individual handshake messages', async () => {
      const initiatorKey = generateNoiseKeyPair();
      const responderKey = generateNoiseKeyPair();

      const timer = new Timer();
      const iterations = 100;
      const messageTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const initiator = new NoiseSession({
          peerId: 'responder',
          role: NoiseRole.Initiator,
          localStaticKey: initiatorKey,
        });

        const responder = new NoiseSession({
          peerId: 'initiator',
          role: NoiseRole.Responder,
          localStaticKey: responderKey,
        });

        // Message 1: Initiator -> Responder
        timer.start();
        const msg1 = initiator.startHandshake();
        messageTimes.push(timer.elapsed());

        // Message 2: Responder processes and responds
        timer.start();
        const msg2 = responder.processHandshakeMessage(msg1);
        messageTimes.push(timer.elapsed());

        // Message 3: Initiator processes and responds
        timer.start();
        const msg3 = initiator.processHandshakeMessage(msg2!);
        messageTimes.push(timer.elapsed());

        // Final: Responder processes
        timer.start();
        responder.processHandshakeMessage(msg3!);
        messageTimes.push(timer.elapsed());
      }

      // Calculate averages for each message
      const msg1Avg = messageTimes.filter((_, i) => i % 4 === 0).reduce((a, b) => a + b, 0) / iterations;
      const msg2Avg = messageTimes.filter((_, i) => i % 4 === 1).reduce((a, b) => a + b, 0) / iterations;
      const msg3Avg = messageTimes.filter((_, i) => i % 4 === 2).reduce((a, b) => a + b, 0) / iterations;
      const msg4Avg = messageTimes.filter((_, i) => i % 4 === 3).reduce((a, b) => a + b, 0) / iterations;

      console.log('Handshake message breakdown:');
      console.log(`  Message 1 (e): ${msg1Avg.toFixed(3)}ms`);
      console.log(`  Message 2 (e,ee,s,es): ${msg2Avg.toFixed(3)}ms`);
      console.log(`  Message 3 (s,se): ${msg3Avg.toFixed(3)}ms`);
      console.log(`  Final processing: ${msg4Avg.toFixed(3)}ms`);
      console.log(`  Total: ${(msg1Avg + msg2Avg + msg3Avg + msg4Avg).toFixed(3)}ms`);
    });

    it('should benchmark post-handshake encryption', async () => {
      const initiatorKey = generateNoiseKeyPair();
      const responderKey = generateNoiseKeyPair();
      const { initiatorSession } = performXXHandshake(initiatorKey, responderKey);

      const testMessage = new Uint8Array(1024);
      crypto.getRandomValues(testMessage);

      const result = await runBenchmark(
        { name: 'Noise Transport Encrypt', iterations: 1000, warmup: 50 },
        () => {
          initiatorSession.encrypt(testMessage);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Noise Transport Encrypt: ${avgDuration.toFixed(3)}ms per op, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );
    });

    it('should benchmark post-handshake round-trip', async () => {
      const initiatorKey = generateNoiseKeyPair();
      const responderKey = generateNoiseKeyPair();
      const { initiatorSession, responderSession } = performXXHandshake(initiatorKey, responderKey);

      const testMessage = new Uint8Array(1024);
      crypto.getRandomValues(testMessage);

      const result = await runBenchmark(
        { name: 'Noise Round-trip', iterations: 500, warmup: 25 },
        () => {
          const encrypted = initiatorSession.encrypt(testMessage);
          responderSession.decrypt(encrypted);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Noise Round-trip: ${avgDuration.toFixed(3)}ms per message, ${result.opsPerSecond.toFixed(0)} messages/sec`
      );

      // Should support > 1000 messages/sec
      expect(result.opsPerSecond).toBeGreaterThan(1000);
    });
  });

  describe('Combined Operations (Message Send Simulation)', () => {
    it('should benchmark complete message send flow', async () => {
      // Simulate full message send: sign + encrypt
      const signingKey = generateEd25519KeyPair();
      const encryptionKey = generateKey();
      const messageContent = new TextEncoder().encode('Hello, this is a test message!');

      const result = await runBenchmark(
        { name: 'Full Message Send', iterations: 500, warmup: 25 },
        () => {
          // Step 1: Sign the message
          const { signature } = sign(messageContent, signingKey.privateKey);

          // Step 2: Combine message + signature
          const payload = new Uint8Array(messageContent.length + signature.length);
          payload.set(messageContent);
          payload.set(signature, messageContent.length);

          // Step 3: Encrypt
          encryptChaCha20Poly1305(payload, encryptionKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Full Message Send: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} msgs/sec`
      );

      // Must meet 100ms target
      assertDuration(avgDuration, PERFORMANCE_THRESHOLDS.MESSAGE_SEND, 'Message send exceeds 100ms target');
    });

    it('should benchmark message receive flow', async () => {
      // Pre-create encrypted message
      const signingKey = generateEd25519KeyPair();
      const encryptionKey = generateKey();
      const messageContent = new TextEncoder().encode('Hello, this is a test message!');
      const { signature } = sign(messageContent, signingKey.privateKey);

      const payload = new Uint8Array(messageContent.length + signature.length);
      payload.set(messageContent);
      payload.set(signature, messageContent.length);

      const { ciphertext, nonce } = encryptChaCha20Poly1305(payload, encryptionKey);

      const result = await runBenchmark(
        { name: 'Full Message Receive', iterations: 500, warmup: 25 },
        () => {
          // Step 1: Decrypt
          const decrypted = decryptChaCha20Poly1305(ciphertext, encryptionKey, nonce);

          // Step 2: Extract signature and verify
          const msg = decrypted.slice(0, messageContent.length);
          const sig = decrypted.slice(messageContent.length);
          verify(msg, sig, signingKey.publicKey);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Full Message Receive: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} msgs/sec`
      );

      // Must meet 100ms target
      assertDuration(avgDuration, PERFORMANCE_THRESHOLDS.MESSAGE_SEND, 'Message receive exceeds 100ms target');
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid sequential key generation', async () => {
      const timer = new Timer().start();
      const count = 10000;

      for (let i = 0; i < count; i++) {
        generateX25519KeyPair();
      }

      timer.stop();
      const avgDuration = timer.elapsed() / count;

      console.log(
        `Rapid KeyGen: ${count} keys in ${timer.elapsed().toFixed(0)}ms (${avgDuration.toFixed(3)}ms each)`
      );

      // Should maintain performance under load
      expect(avgDuration).toBeLessThan(1); // < 1ms each
    });

    it('should handle burst encryption', async () => {
      const key = generateKey();
      const messages: Uint8Array[] = [];

      // Create 100 random messages
      for (let i = 0; i < 100; i++) {
        const msg = new Uint8Array(Math.floor(Math.random() * 10000) + 100);
        crypto.getRandomValues(msg);
        messages.push(msg);
      }

      const timer = new Timer().start();

      // Encrypt all messages
      const encrypted = messages.map(msg => encryptChaCha20Poly1305(msg, key));

      timer.stop();

      const totalBytes = messages.reduce((sum, msg) => sum + msg.length, 0);
      const throughputMBps = (totalBytes / timer.elapsed() / 1024).toFixed(2);

      console.log(
        `Burst Encryption: ${encrypted.length} messages (${(totalBytes / 1024).toFixed(0)}KB) in ${timer.elapsed().toFixed(0)}ms (${throughputMBps} MB/s)`
      );

      // Should handle burst efficiently
      expect(timer.elapsed()).toBeLessThan(1000); // < 1s for all
    });
  });
});
