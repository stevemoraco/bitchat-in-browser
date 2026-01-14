/**
 * Digital Signature Module
 *
 * Provides Ed25519 digital signature operations for message
 * authentication and Nostr event signing.
 */

import { getSodium, ensureSodiumReady } from './init';
import type { Signature} from './types';
import { CryptoConstants } from './types';

/**
 * Sign a message using Ed25519.
 *
 * @param message - Message to sign (as bytes)
 * @param privateKey - Ed25519 private key (64 bytes)
 * @returns Signature object containing 64-byte signature
 * @throws Error if sodium is not initialized or private key is invalid
 */
export function sign(message: Uint8Array, privateKey: Uint8Array): Signature {
  ensureSodiumReady();
  const sodium = getSodium();

  if (privateKey.length !== CryptoConstants.ED25519_PRIVATE_KEY_BYTES) {
    throw new Error(
      `Invalid private key length: expected ${CryptoConstants.ED25519_PRIVATE_KEY_BYTES} bytes, got ${privateKey.length}`
    );
  }

  const signature = sodium.crypto_sign_detached(message, privateKey);

  return { signature };
}

/**
 * Verify an Ed25519 signature.
 *
 * @param message - Original message that was signed
 * @param signature - 64-byte signature to verify
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns True if signature is valid, false otherwise
 * @throws Error if sodium is not initialized or keys are invalid
 */
export function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  ensureSodiumReady();
  const sodium = getSodium();

  if (publicKey.length !== CryptoConstants.ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Invalid public key length: expected ${CryptoConstants.ED25519_PUBLIC_KEY_BYTES} bytes, got ${publicKey.length}`
    );
  }

  if (signature.length !== CryptoConstants.ED25519_SIGNATURE_BYTES) {
    throw new Error(
      `Invalid signature length: expected ${CryptoConstants.ED25519_SIGNATURE_BYTES} bytes, got ${signature.length}`
    );
  }

  try {
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
  } catch {
    // Invalid signature format
    return false;
  }
}

/**
 * Sign a string message.
 *
 * @param message - String message to sign
 * @param privateKey - Ed25519 private key (64 bytes)
 * @returns Signature object containing 64-byte signature
 * @throws Error if sodium is not initialized or private key is invalid
 */
export function signString(
  message: string,
  privateKey: Uint8Array
): Signature {
  ensureSodiumReady();
  const sodium = getSodium();

  const messageBytes = sodium.from_string(message);
  return sign(messageBytes, privateKey);
}

/**
 * Verify a signature on a string message.
 *
 * @param message - Original string message
 * @param signature - 64-byte signature to verify
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns True if signature is valid, false otherwise
 * @throws Error if sodium is not initialized or keys are invalid
 */
export function verifyString(
  message: string,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  ensureSodiumReady();
  const sodium = getSodium();

  const messageBytes = sodium.from_string(message);
  return verify(messageBytes, signature, publicKey);
}

/**
 * Sign a message and return hex-encoded signature.
 * Commonly used for Nostr event signing.
 *
 * @param message - Message to sign (as bytes)
 * @param privateKey - Ed25519 private key (64 bytes)
 * @returns Hex-encoded signature (128 characters)
 * @throws Error if sodium is not initialized or private key is invalid
 */
export function signToHex(message: Uint8Array, privateKey: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const { signature } = sign(message, privateKey);
  return sodium.to_hex(signature);
}

/**
 * Verify a hex-encoded signature.
 *
 * @param message - Original message that was signed
 * @param signatureHex - Hex-encoded signature (128 characters)
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns True if signature is valid, false otherwise
 * @throws Error if sodium is not initialized or parameters are invalid
 */
export function verifyHex(
  message: Uint8Array,
  signatureHex: string,
  publicKey: Uint8Array
): boolean {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate hex string
  if (!/^[0-9a-f]+$/i.test(signatureHex)) {
    throw new Error('Invalid signature hex: contains non-hex characters');
  }

  if (signatureHex.length !== CryptoConstants.ED25519_SIGNATURE_BYTES * 2) {
    throw new Error(
      `Invalid signature hex length: expected ${CryptoConstants.ED25519_SIGNATURE_BYTES * 2} characters, got ${signatureHex.length}`
    );
  }

  const signature = sodium.from_hex(signatureHex);
  return verify(message, signature, publicKey);
}

/**
 * Create a signed message (signature concatenated with message).
 *
 * @param message - Message to sign
 * @param privateKey - Ed25519 private key (64 bytes)
 * @returns Signed message (signature + original message)
 * @throws Error if sodium is not initialized or private key is invalid
 */
export function signCombined(
  message: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (privateKey.length !== CryptoConstants.ED25519_PRIVATE_KEY_BYTES) {
    throw new Error(
      `Invalid private key length: expected ${CryptoConstants.ED25519_PRIVATE_KEY_BYTES} bytes, got ${privateKey.length}`
    );
  }

  return sodium.crypto_sign(message, privateKey);
}

/**
 * Open (verify and extract) a signed message.
 *
 * @param signedMessage - Combined signature + message
 * @param publicKey - Ed25519 public key (32 bytes)
 * @returns Original message if signature is valid
 * @throws Error if sodium is not initialized, keys are invalid, or signature fails
 */
export function openSigned(
  signedMessage: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (publicKey.length !== CryptoConstants.ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Invalid public key length: expected ${CryptoConstants.ED25519_PUBLIC_KEY_BYTES} bytes, got ${publicKey.length}`
    );
  }

  if (signedMessage.length < CryptoConstants.ED25519_SIGNATURE_BYTES) {
    throw new Error(
      `Invalid signed message length: must be at least ${CryptoConstants.ED25519_SIGNATURE_BYTES} bytes`
    );
  }

  try {
    return sodium.crypto_sign_open(signedMessage, publicKey);
  } catch {
    throw new Error('Signature verification failed');
  }
}
