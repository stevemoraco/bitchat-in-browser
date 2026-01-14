/**
 * Symmetric Encryption Module
 *
 * Provides authenticated encryption using ChaCha20-Poly1305.
 * Uses XChaCha20-Poly1305 for extended nonce support.
 */

import { getSodium, ensureSodiumReady } from './init';
import type { EncryptedData} from './types';
import { CryptoConstants } from './types';

/**
 * Encrypt data using XChaCha20-Poly1305 authenticated encryption.
 *
 * @param data - Plaintext data to encrypt
 * @param key - 32-byte encryption key
 * @param nonce - 24-byte nonce (use generateNonce() if not provided)
 * @returns Encrypted data with ciphertext and nonce
 * @throws Error if sodium is not initialized or parameters are invalid
 */
export function encryptChaCha20Poly1305(
  data: Uint8Array,
  key: Uint8Array,
  nonce?: Uint8Array
): EncryptedData {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate key
  if (key.length !== CryptoConstants.CHACHA20_KEY_BYTES) {
    throw new Error(
      `Invalid key length: expected ${CryptoConstants.CHACHA20_KEY_BYTES} bytes, got ${key.length}`
    );
  }

  // Generate nonce if not provided
  const actualNonce = nonce ?? generateNonce();

  // Validate nonce
  if (actualNonce.length !== CryptoConstants.XCHACHA20_NONCE_BYTES) {
    throw new Error(
      `Invalid nonce length: expected ${CryptoConstants.XCHACHA20_NONCE_BYTES} bytes, got ${actualNonce.length}`
    );
  }

  // Encrypt with XChaCha20-Poly1305
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    data,
    null, // No additional authenticated data
    null, // No secret nonce (nsec)
    actualNonce,
    key
  );

  return {
    ciphertext,
    nonce: actualNonce,
  };
}

/**
 * Decrypt data using XChaCha20-Poly1305 authenticated encryption.
 *
 * @param ciphertext - Encrypted ciphertext with auth tag
 * @param key - 32-byte encryption key
 * @param nonce - 24-byte nonce used during encryption
 * @returns Decrypted plaintext
 * @throws Error if sodium is not initialized, parameters are invalid, or authentication fails
 */
export function decryptChaCha20Poly1305(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate key
  if (key.length !== CryptoConstants.CHACHA20_KEY_BYTES) {
    throw new Error(
      `Invalid key length: expected ${CryptoConstants.CHACHA20_KEY_BYTES} bytes, got ${key.length}`
    );
  }

  // Validate nonce
  if (nonce.length !== CryptoConstants.XCHACHA20_NONCE_BYTES) {
    throw new Error(
      `Invalid nonce length: expected ${CryptoConstants.XCHACHA20_NONCE_BYTES} bytes, got ${nonce.length}`
    );
  }

  // Validate ciphertext minimum length (must include auth tag)
  if (ciphertext.length < CryptoConstants.POLY1305_TAG_BYTES) {
    throw new Error(
      `Invalid ciphertext length: must be at least ${CryptoConstants.POLY1305_TAG_BYTES} bytes`
    );
  }

  try {
    // Decrypt with XChaCha20-Poly1305
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // No secret nonce (nsec)
      ciphertext,
      null, // No additional authenticated data
      nonce,
      key
    );
  } catch {
    throw new Error('Decryption failed: authentication tag mismatch');
  }
}

/**
 * Generate a cryptographically secure random nonce.
 *
 * @returns 24-byte random nonce for XChaCha20-Poly1305
 * @throws Error if sodium is not initialized
 */
export function generateNonce(): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.randombytes_buf(CryptoConstants.XCHACHA20_NONCE_BYTES);
}

/**
 * Generate a cryptographically secure random key.
 *
 * @returns 32-byte random key for ChaCha20-Poly1305
 * @throws Error if sodium is not initialized
 */
export function generateKey(): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.randombytes_buf(CryptoConstants.CHACHA20_KEY_BYTES);
}

/**
 * Encrypt data with XChaCha20-Poly1305 and encode the result.
 * Convenience function that returns a single combined buffer.
 *
 * @param data - Plaintext data to encrypt
 * @param key - 32-byte encryption key
 * @returns Combined nonce + ciphertext (nonce is first 24 bytes)
 * @throws Error if sodium is not initialized or parameters are invalid
 */
export function encryptCombined(data: Uint8Array, key: Uint8Array): Uint8Array {
  const { ciphertext, nonce } = encryptChaCha20Poly1305(data, key);

  // Combine nonce and ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return combined;
}

/**
 * Decrypt combined nonce + ciphertext buffer.
 *
 * @param combined - Combined buffer with nonce prefix
 * @param key - 32-byte encryption key
 * @returns Decrypted plaintext
 * @throws Error if sodium is not initialized, parameters are invalid, or authentication fails
 */
export function decryptCombined(
  combined: Uint8Array,
  key: Uint8Array
): Uint8Array {
  const minLength =
    CryptoConstants.XCHACHA20_NONCE_BYTES + CryptoConstants.POLY1305_TAG_BYTES;

  if (combined.length < minLength) {
    throw new Error(
      `Invalid combined data length: must be at least ${minLength} bytes`
    );
  }

  // Split nonce and ciphertext
  const nonce = combined.slice(0, CryptoConstants.XCHACHA20_NONCE_BYTES);
  const ciphertext = combined.slice(CryptoConstants.XCHACHA20_NONCE_BYTES);

  return decryptChaCha20Poly1305(ciphertext, key, nonce);
}

/**
 * Encrypt a string to base64-encoded combined format.
 *
 * @param text - String to encrypt
 * @param key - 32-byte encryption key
 * @returns Base64-encoded encrypted data
 * @throws Error if sodium is not initialized or parameters are invalid
 */
export function encryptString(text: string, key: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const data = sodium.from_string(text);
  const combined = encryptCombined(data, key);

  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
}

/**
 * Decrypt a base64-encoded string.
 *
 * @param encoded - Base64-encoded encrypted data
 * @param key - 32-byte encryption key
 * @returns Decrypted string
 * @throws Error if sodium is not initialized, parameters are invalid, or authentication fails
 */
export function decryptString(encoded: string, key: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const combined = sodium.from_base64(encoded, sodium.base64_variants.ORIGINAL);
  const decrypted = decryptCombined(combined, key);

  return sodium.to_string(decrypted);
}
