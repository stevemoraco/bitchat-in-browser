/**
 * Security Test Suite Index
 *
 * This module provides an overview of security tests for BitChat In Browser.
 *
 * Test Categories:
 * - XSS (Cross-Site Scripting) Prevention
 * - Cryptographic Security
 * - Storage Security
 * - Network Security
 * - Content Security Policy (CSP)
 *
 * Run all security tests:
 *   npm run test:security
 *
 * Run security scan:
 *   npm run security:scan
 *
 * Run full security audit:
 *   npm run security:all
 *
 * @module __security__
 */

export const SECURITY_TEST_SUITES = {
  xss: {
    file: 'xss.test.ts',
    description: 'Tests for XSS prevention and content sanitization',
    categories: [
      'Message content sanitization',
      'URL parsing safety',
      'HTML injection prevention',
      'Script injection prevention',
    ],
  },
  crypto: {
    file: 'crypto.test.ts',
    description: 'Tests for cryptographic security',
    categories: [
      'Key material never logged',
      'Keys cleared from memory after use',
      'Secure random number generation',
      'No weak crypto algorithms',
    ],
  },
  storage: {
    file: 'storage.test.ts',
    description: 'Tests for storage security',
    categories: [
      'Private keys encrypted at rest',
      'No plaintext secrets in localStorage',
      'Proper key derivation for encryption',
      'Emergency wipe completeness',
    ],
  },
  network: {
    file: 'network.test.ts',
    description: 'Tests for network security',
    categories: [
      'No sensitive data in URLs',
      'WebSocket messages encrypted',
      'No tracking/analytics calls',
      'CORS headers correct',
    ],
  },
  csp: {
    file: 'csp.test.ts',
    description: 'Tests for Content Security Policy',
    categories: [
      'CSP headers present',
      'No inline scripts',
      'No eval usage',
      'Strict source restrictions',
    ],
  },
};

/**
 * Security best practices enforced by these tests:
 *
 * 1. CRYPTOGRAPHY
 *    - Use libsodium for all crypto operations
 *    - XChaCha20-Poly1305 for symmetric encryption
 *    - Ed25519 for signatures
 *    - X25519 for key exchange
 *    - Argon2id for password hashing
 *
 * 2. KEY MANAGEMENT
 *    - Never log key material
 *    - Wipe keys from memory after use
 *    - Encrypt private keys at rest
 *    - Use secure random for key generation
 *
 * 3. XSS PREVENTION
 *    - Sanitize all user input
 *    - Use Content Security Policy
 *    - No inline scripts or eval()
 *    - Escape HTML entities
 *
 * 4. NETWORK SECURITY
 *    - Use WSS (secure WebSocket) only
 *    - Encrypt all message content
 *    - No tracking or analytics
 *    - Strict CORS policy
 *
 * 5. PRIVACY
 *    - Zero analytics
 *    - No third-party resources
 *    - Minimal metadata exposure
 *    - Emergency wipe capability
 */
