/**
 * Noise Protocol XX Implementation
 *
 * A complete implementation of the Noise Protocol Framework for end-to-end
 * encryption in BitChat. Compatible with iOS BitChat Noise implementation.
 *
 * ## Overview
 * The Noise Protocol Framework is a modern cryptographic framework designed
 * for building secure protocols. BitChat uses Noise to provide:
 * - Mutual authentication between peers
 * - Forward secrecy for all messages
 * - Protection against replay attacks
 * - Minimal round trips for connection establishment
 *
 * ## Implementation Details
 * This implementation follows the Noise specification exactly, using:
 * - **Pattern**: XX (most versatile, provides mutual authentication)
 * - **DH**: Curve25519 (X25519 key exchange)
 * - **Cipher**: ChaCha20-Poly1305 (AEAD encryption)
 * - **Hash**: SHA-256 (for key derivation and authentication)
 *
 * ## Handshake Flow (XX Pattern)
 * ```
 * Initiator                              Responder
 * ---------                              ---------
 * -> e                                   (ephemeral key)
 * <- e, ee, s, es                       (ephemeral, DH, static encrypted, DH)
 * -> s, se                              (static encrypted, DH)
 * ```
 */

import { getSodium, ensureSodiumReady } from './init';
import type {
  NoiseKeyPair,
  NoiseCipherState,
  TransportCiphers} from './noise-state';
import {
  NoiseConstants,
  NoisePattern,
  NoiseRole,
  NoiseSessionState,
  NoiseToken,
  NoiseError,
  NoiseErrorCode,
  NoiseSymmetricState,
  getMessagePatterns,
  getProtocolName,
  validatePublicKey,
} from './noise-state';
import { deriveSharedSecret, secureWipe } from './keys';

// Re-export types and utilities from noise-state
export {
  NoiseConstants,
  NoisePattern,
  NoiseRole,
  NoiseSessionState,
  NoiseToken,
  NoiseError,
  NoiseErrorCode,
  NoiseCipherState,
  NoiseSymmetricState,
  getMessagePatterns,
  getProtocolName,
  validatePublicKey,
} from './noise-state';

export type {
  NoiseKeyPair,
  TransportCiphers,
} from './noise-state';

// MARK: - Handshake State

/**
 * Orchestrates the complete Noise handshake process.
 * This is the main interface for establishing encrypted sessions between peers.
 */
export class NoiseHandshakeState {
  private readonly role: NoiseRole;
  private readonly pattern: NoisePattern;
  private symmetricState: NoiseSymmetricState;

  // Keys
  private localStaticPrivate: Uint8Array | null = null;
  private localStaticPublic: Uint8Array | null = null;
  private localEphemeralPrivate: Uint8Array | null = null;
  private localEphemeralPublic: Uint8Array | null = null;

  private remoteStaticPublic: Uint8Array | null = null;
  private remoteEphemeralPublic: Uint8Array | null = null;

  // Message patterns
  private messagePatterns: NoiseToken[][];
  private currentPattern: number = 0;

  // Test support: predetermined ephemeral keys for test vectors
  private predeterminedEphemeralKey: Uint8Array | null = null;
  private prologueData: Uint8Array;

  constructor(options: {
    role: NoiseRole;
    pattern: NoisePattern;
    localStaticKey?: NoiseKeyPair;
    remoteStaticKey?: Uint8Array;
    prologue?: Uint8Array;
    predeterminedEphemeralKey?: Uint8Array;
  }) {
    this.role = options.role;
    this.pattern = options.pattern;
    this.prologueData = options.prologue ?? new Uint8Array(0);
    this.predeterminedEphemeralKey = options.predeterminedEphemeralKey ?? null;

    // Initialize static keys
    if (options.localStaticKey) {
      this.localStaticPrivate = new Uint8Array(options.localStaticKey.privateKey);
      this.localStaticPublic = new Uint8Array(options.localStaticKey.publicKey);
    }

    if (options.remoteStaticKey) {
      this.remoteStaticPublic = new Uint8Array(options.remoteStaticKey);
    }

    // Initialize protocol name
    const protocolName = getProtocolName(this.pattern);
    this.symmetricState = new NoiseSymmetricState(protocolName);

    // Initialize message patterns
    this.messagePatterns = getMessagePatterns(this.pattern);

    // Mix pre-message keys
    this.mixPreMessageKeys();
  }

  private mixPreMessageKeys(): void {
    // Mix prologue
    this.symmetricState.mixHash(this.prologueData);

    // For XX pattern, no pre-message keys
    // For IK/NK patterns, we'd mix the responder's static key here
    switch (this.pattern) {
      case NoisePattern.XX:
        // No pre-message keys
        break;
      case NoisePattern.IK:
      case NoisePattern.NK:
        if (this.role === NoiseRole.Initiator && this.remoteStaticPublic) {
          this.symmetricState.mixHash(this.remoteStaticPublic);
        }
        break;
    }
  }

  /**
   * Generate an ephemeral key pair.
   */
  private generateEphemeralKeyPair(): NoiseKeyPair {
    ensureSodiumReady();
    const sodium = getSodium();

    const keyPair = sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Perform Diffie-Hellman key exchange.
   */
  private dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    return deriveSharedSecret(privateKey, publicKey);
  }

  /**
   * Write a handshake message.
   *
   * @param payload - Optional payload to include in the message
   * @returns The handshake message to send
   */
  writeMessage(payload: Uint8Array = new Uint8Array(0)): Uint8Array {
    if (this.currentPattern >= this.messagePatterns.length) {
      throw new NoiseError(
        'Handshake already complete',
        NoiseErrorCode.HandshakeComplete
      );
    }

    const messageBuffer: number[] = [];
    const patterns = this.messagePatterns[this.currentPattern];

    for (const token of patterns) {
      switch (token) {
        case NoiseToken.E: {
          // Generate ephemeral key (or use predetermined key for tests)
          let ephemeralKeyPair: NoiseKeyPair;
          if (this.predeterminedEphemeralKey) {
            ensureSodiumReady();
            const sodium = getSodium();
            const privateKey = this.predeterminedEphemeralKey;
            const publicKey = sodium.crypto_scalarmult_base(privateKey);
            ephemeralKeyPair = { privateKey, publicKey };
            this.predeterminedEphemeralKey = null;
          } else {
            ephemeralKeyPair = this.generateEphemeralKeyPair();
          }

          this.localEphemeralPrivate = ephemeralKeyPair.privateKey;
          this.localEphemeralPublic = ephemeralKeyPair.publicKey;

          // Append public key to message
          for (const byte of this.localEphemeralPublic) {
            messageBuffer.push(byte);
          }
          this.symmetricState.mixHash(this.localEphemeralPublic);
          break;
        }

        case NoiseToken.S: {
          // Send static key (encrypted if cipher is initialized)
          if (!this.localStaticPublic) {
            throw new NoiseError(
              'Missing local static key',
              NoiseErrorCode.MissingLocalStaticKey
            );
          }
          const encrypted = this.symmetricState.encryptAndHash(this.localStaticPublic);
          for (const byte of encrypted) {
            messageBuffer.push(byte);
          }
          break;
        }

        case NoiseToken.EE: {
          // DH(local ephemeral, remote ephemeral)
          if (!this.localEphemeralPrivate || !this.remoteEphemeralPublic) {
            throw new NoiseError(
              'Missing keys for EE operation',
              NoiseErrorCode.MissingKeys
            );
          }
          const shared = this.dh(this.localEphemeralPrivate, this.remoteEphemeralPublic);
          this.symmetricState.mixKey(shared);
          secureWipe(shared);
          break;
        }

        case NoiseToken.ES: {
          // DH(ephemeral, static) - direction depends on role
          let shared: Uint8Array;
          if (this.role === NoiseRole.Initiator) {
            if (!this.localEphemeralPrivate || !this.remoteStaticPublic) {
              throw new NoiseError(
                'Missing keys for ES operation',
                NoiseErrorCode.MissingKeys
              );
            }
            shared = this.dh(this.localEphemeralPrivate, this.remoteStaticPublic);
          } else {
            if (!this.localStaticPrivate || !this.remoteEphemeralPublic) {
              throw new NoiseError(
                'Missing keys for ES operation',
                NoiseErrorCode.MissingKeys
              );
            }
            shared = this.dh(this.localStaticPrivate, this.remoteEphemeralPublic);
          }
          this.symmetricState.mixKey(shared);
          secureWipe(shared);
          break;
        }

        case NoiseToken.SE: {
          // DH(static, ephemeral) - direction depends on role
          let shared: Uint8Array;
          if (this.role === NoiseRole.Initiator) {
            if (!this.localStaticPrivate || !this.remoteEphemeralPublic) {
              throw new NoiseError(
                'Missing keys for SE operation',
                NoiseErrorCode.MissingKeys
              );
            }
            shared = this.dh(this.localStaticPrivate, this.remoteEphemeralPublic);
          } else {
            if (!this.localEphemeralPrivate || !this.remoteStaticPublic) {
              throw new NoiseError(
                'Missing keys for SE operation',
                NoiseErrorCode.MissingKeys
              );
            }
            shared = this.dh(this.localEphemeralPrivate, this.remoteStaticPublic);
          }
          this.symmetricState.mixKey(shared);
          secureWipe(shared);
          break;
        }

        case NoiseToken.SS: {
          // DH(static, static)
          if (!this.localStaticPrivate || !this.remoteStaticPublic) {
            throw new NoiseError(
              'Missing keys for SS operation',
              NoiseErrorCode.MissingKeys
            );
          }
          const shared = this.dh(this.localStaticPrivate, this.remoteStaticPublic);
          this.symmetricState.mixKey(shared);
          secureWipe(shared);
          break;
        }
      }
    }

    // Encrypt payload
    const encryptedPayload = this.symmetricState.encryptAndHash(payload);
    for (const byte of encryptedPayload) {
      messageBuffer.push(byte);
    }

    this.currentPattern++;
    return new Uint8Array(messageBuffer);
  }

  /**
   * Read and process a handshake message.
   *
   * @param message - The received handshake message
   * @returns The decrypted payload
   */
  readMessage(message: Uint8Array): Uint8Array {
    if (this.currentPattern >= this.messagePatterns.length) {
      throw new NoiseError(
        'Handshake already complete',
        NoiseErrorCode.HandshakeComplete
      );
    }

    let buffer = message;
    const patterns = this.messagePatterns[this.currentPattern];

    for (const token of patterns) {
      switch (token) {
        case NoiseToken.E: {
          // Read ephemeral key
          if (buffer.length < NoiseConstants.DH_LEN) {
            throw new NoiseError(
              'Message too short for ephemeral key',
              NoiseErrorCode.InvalidMessage
            );
          }
          const ephemeralData = buffer.slice(0, NoiseConstants.DH_LEN);
          buffer = buffer.slice(NoiseConstants.DH_LEN);

          if (!validatePublicKey(ephemeralData)) {
            throw new NoiseError(
              'Invalid ephemeral public key',
              NoiseErrorCode.InvalidPublicKey
            );
          }

          this.remoteEphemeralPublic = ephemeralData;
          this.symmetricState.mixHash(ephemeralData);
          break;
        }

        case NoiseToken.S: {
          // Read static key (may be encrypted)
          const keyLength = this.symmetricState.hasCipherKey()
            ? NoiseConstants.DH_LEN + NoiseConstants.TAG_LEN
            : NoiseConstants.DH_LEN;

          if (buffer.length < keyLength) {
            throw new NoiseError(
              'Message too short for static key',
              NoiseErrorCode.InvalidMessage
            );
          }

          const staticData = buffer.slice(0, keyLength);
          buffer = buffer.slice(keyLength);

          try {
            const decrypted = this.symmetricState.decryptAndHash(staticData);
            if (!validatePublicKey(decrypted)) {
              throw new NoiseError(
                'Invalid static public key',
                NoiseErrorCode.InvalidPublicKey
              );
            }
            this.remoteStaticPublic = decrypted;
          } catch (error) {
            if (error instanceof NoiseError) throw error;
            throw new NoiseError(
              'Authentication failure during static key decryption',
              NoiseErrorCode.AuthenticationFailure
            );
          }
          break;
        }

        case NoiseToken.EE:
        case NoiseToken.ES:
        case NoiseToken.SE:
        case NoiseToken.SS:
          this.performDHOperation(token);
          break;
      }
    }

    // Decrypt payload
    const payload = this.symmetricState.decryptAndHash(buffer);
    this.currentPattern++;

    return payload;
  }

  private performDHOperation(token: NoiseToken): void {
    let shared: Uint8Array;

    switch (token) {
      case NoiseToken.EE:
        if (!this.localEphemeralPrivate || !this.remoteEphemeralPublic) {
          throw new NoiseError('Missing keys for EE', NoiseErrorCode.MissingKeys);
        }
        shared = this.dh(this.localEphemeralPrivate, this.remoteEphemeralPublic);
        break;

      case NoiseToken.ES:
        if (this.role === NoiseRole.Initiator) {
          if (!this.localEphemeralPrivate || !this.remoteStaticPublic) {
            throw new NoiseError('Missing keys for ES', NoiseErrorCode.MissingKeys);
          }
          shared = this.dh(this.localEphemeralPrivate, this.remoteStaticPublic);
        } else {
          if (!this.localStaticPrivate || !this.remoteEphemeralPublic) {
            throw new NoiseError('Missing keys for ES', NoiseErrorCode.MissingKeys);
          }
          shared = this.dh(this.localStaticPrivate, this.remoteEphemeralPublic);
        }
        break;

      case NoiseToken.SE:
        if (this.role === NoiseRole.Initiator) {
          if (!this.localStaticPrivate || !this.remoteEphemeralPublic) {
            throw new NoiseError('Missing keys for SE', NoiseErrorCode.MissingKeys);
          }
          shared = this.dh(this.localStaticPrivate, this.remoteEphemeralPublic);
        } else {
          if (!this.localEphemeralPrivate || !this.remoteStaticPublic) {
            throw new NoiseError('Missing keys for SE', NoiseErrorCode.MissingKeys);
          }
          shared = this.dh(this.localEphemeralPrivate, this.remoteStaticPublic);
        }
        break;

      case NoiseToken.SS:
        if (!this.localStaticPrivate || !this.remoteStaticPublic) {
          throw new NoiseError('Missing keys for SS', NoiseErrorCode.MissingKeys);
        }
        shared = this.dh(this.localStaticPrivate, this.remoteStaticPublic);
        break;

      default:
        return;
    }

    this.symmetricState.mixKey(shared);
    secureWipe(shared);
  }

  /**
   * Check if the handshake is complete.
   */
  isHandshakeComplete(): boolean {
    return this.currentPattern >= this.messagePatterns.length;
  }

  /**
   * Get transport ciphers after handshake completion.
   *
   * @param useExtractedNonce - Whether to prepend nonce to ciphertext
   * @returns Transport ciphers for sending and receiving
   */
  getTransportCiphers(useExtractedNonce: boolean): TransportCiphers {
    if (!this.isHandshakeComplete()) {
      throw new NoiseError(
        'Handshake not complete',
        NoiseErrorCode.HandshakeNotComplete
      );
    }

    const [c1, c2] = this.symmetricState.split(useExtractedNonce);

    // Initiator uses c1 for sending, c2 for receiving
    // Responder uses c2 for sending, c1 for receiving
    return this.role === NoiseRole.Initiator
      ? { send: c1, receive: c2 }
      : { send: c2, receive: c1 };
  }

  /**
   * Get the remote party's static public key.
   */
  getRemoteStaticPublicKey(): Uint8Array | null {
    return this.remoteStaticPublic ? new Uint8Array(this.remoteStaticPublic) : null;
  }

  /**
   * Get the handshake hash for channel binding.
   */
  getHandshakeHash(): Uint8Array {
    return this.symmetricState.getHandshakeHash();
  }

  /**
   * Clear sensitive data from memory.
   */
  clear(): void {
    if (this.localStaticPrivate) secureWipe(this.localStaticPrivate);
    if (this.localEphemeralPrivate) secureWipe(this.localEphemeralPrivate);
    if (this.predeterminedEphemeralKey) secureWipe(this.predeterminedEphemeralKey);
    this.symmetricState.clear();
  }
}

// MARK: - Noise Session

/**
 * Manages a complete Noise session including handshake and transport.
 * This is the main class for establishing and using encrypted channels.
 */
export class NoiseSession {
  readonly peerId: string;
  readonly role: NoiseRole;

  private state: NoiseSessionState = NoiseSessionState.Uninitialized;
  private handshakeState: NoiseHandshakeState | null = null;
  private sendCipher: NoiseCipherState | null = null;
  private receiveCipher: NoiseCipherState | null = null;

  // Keys
  private localStaticKey: NoiseKeyPair;
  private remoteStaticPublicKey: Uint8Array | null = null;

  // Handshake hash for channel binding
  private handshakeHash: Uint8Array | null = null;

  constructor(options: {
    peerId: string;
    role: NoiseRole;
    localStaticKey: NoiseKeyPair;
    remoteStaticKey?: Uint8Array;
  }) {
    this.peerId = options.peerId;
    this.role = options.role;
    this.localStaticKey = options.localStaticKey;
    this.remoteStaticPublicKey = options.remoteStaticKey ?? null;
  }

  /**
   * Start the handshake process.
   *
   * @returns The first handshake message (empty for responder in XX)
   */
  startHandshake(): Uint8Array {
    if (this.state !== NoiseSessionState.Uninitialized) {
      throw new NoiseError(
        'Session already started',
        NoiseErrorCode.InvalidState
      );
    }

    this.handshakeState = new NoiseHandshakeState({
      role: this.role,
      pattern: NoisePattern.XX,
      localStaticKey: this.localStaticKey,
      remoteStaticKey: this.remoteStaticPublicKey ?? undefined,
    });

    this.state = NoiseSessionState.Handshaking;

    // Only initiator writes the first message
    if (this.role === NoiseRole.Initiator) {
      return this.handshakeState.writeMessage();
    } 
      // Responder doesn't send first message in XX pattern
      return new Uint8Array(0);
    
  }

  /**
   * Process a received handshake message.
   *
   * @param message - The received handshake message
   * @returns The response message (null if handshake is complete)
   */
  processHandshakeMessage(message: Uint8Array): Uint8Array | null {
    // Initialize handshake state if needed (for responders)
    if (this.state === NoiseSessionState.Uninitialized && this.role === NoiseRole.Responder) {
      this.handshakeState = new NoiseHandshakeState({
        role: this.role,
        pattern: NoisePattern.XX,
        localStaticKey: this.localStaticKey,
      });
      this.state = NoiseSessionState.Handshaking;
    }

    if (this.state !== NoiseSessionState.Handshaking || !this.handshakeState) {
      throw new NoiseError(
        'Invalid session state for handshake',
        NoiseErrorCode.InvalidState
      );
    }

    // Process incoming message
    this.handshakeState.readMessage(message);

    // Check if handshake is complete after reading
    if (this.handshakeState.isHandshakeComplete()) {
      this.finalizeHandshake();
      return null;
    }

    // Generate response
    const response = this.handshakeState.writeMessage();

    // Check if handshake is complete after writing
    if (this.handshakeState.isHandshakeComplete()) {
      this.finalizeHandshake();
    }

    return response;
  }

  private finalizeHandshake(): void {
    if (!this.handshakeState) return;

    // Get transport ciphers
    const { send, receive } = this.handshakeState.getTransportCiphers(true);
    this.sendCipher = send;
    this.receiveCipher = receive;

    // Store remote static key
    this.remoteStaticPublicKey = this.handshakeState.getRemoteStaticPublicKey();

    // Store handshake hash for channel binding
    this.handshakeHash = this.handshakeState.getHandshakeHash();

    // Clear handshake state
    this.handshakeState.clear();
    this.handshakeState = null;

    this.state = NoiseSessionState.Established;
  }

  /**
   * Encrypt a message for transport.
   *
   * @param plaintext - The message to encrypt
   * @returns The encrypted message
   */
  encrypt(plaintext: Uint8Array): Uint8Array {
    if (this.state !== NoiseSessionState.Established || !this.sendCipher) {
      throw new NoiseError(
        'Session not established',
        NoiseErrorCode.NotEstablished
      );
    }

    return this.sendCipher.encrypt(plaintext);
  }

  /**
   * Decrypt a received message.
   *
   * @param ciphertext - The encrypted message
   * @returns The decrypted message
   */
  decrypt(ciphertext: Uint8Array): Uint8Array {
    if (this.state !== NoiseSessionState.Established || !this.receiveCipher) {
      throw new NoiseError(
        'Session not established',
        NoiseErrorCode.NotEstablished
      );
    }

    return this.receiveCipher.decrypt(ciphertext);
  }

  /**
   * Get the current session state.
   */
  getState(): NoiseSessionState {
    return this.state;
  }

  /**
   * Check if the session is established.
   */
  isEstablished(): boolean {
    return this.state === NoiseSessionState.Established;
  }

  /**
   * Get the remote party's static public key.
   */
  getRemoteStaticPublicKey(): Uint8Array | null {
    return this.remoteStaticPublicKey ? new Uint8Array(this.remoteStaticPublicKey) : null;
  }

  /**
   * Get the handshake hash for channel binding.
   */
  getHandshakeHash(): Uint8Array | null {
    return this.handshakeHash ? new Uint8Array(this.handshakeHash) : null;
  }

  /**
   * Reset the session to uninitialized state.
   */
  reset(): void {
    // Clear ciphers
    if (this.sendCipher) {
      this.sendCipher.clear();
      this.sendCipher = null;
    }
    if (this.receiveCipher) {
      this.receiveCipher.clear();
      this.receiveCipher = null;
    }

    // Clear handshake state
    if (this.handshakeState) {
      this.handshakeState.clear();
      this.handshakeState = null;
    }

    // Clear handshake hash
    if (this.handshakeHash) {
      secureWipe(this.handshakeHash);
      this.handshakeHash = null;
    }

    this.remoteStaticPublicKey = null;
    this.state = NoiseSessionState.Uninitialized;
  }

  /**
   * Clear all sensitive data from memory.
   */
  clear(): void {
    this.reset();
    if (this.localStaticKey.privateKey) {
      secureWipe(this.localStaticKey.privateKey);
    }
  }
}

// MARK: - Session Manager

/**
 * Manages multiple Noise sessions.
 */
export class NoiseSessionManager {
  private sessions: Map<string, NoiseSession> = new Map();
  private localStaticKey: NoiseKeyPair;

  constructor(localStaticKey: NoiseKeyPair) {
    this.localStaticKey = localStaticKey;
  }

  /**
   * Get or create a session for a peer.
   *
   * @param peerId - The peer identifier
   * @param role - The role in the handshake
   * @returns The noise session
   */
  getOrCreateSession(peerId: string, role: NoiseRole): NoiseSession {
    let session = this.sessions.get(peerId);

    if (!session) {
      session = new NoiseSession({
        peerId,
        role,
        localStaticKey: this.localStaticKey,
      });
      this.sessions.set(peerId, session);
    }

    return session;
  }

  /**
   * Get an existing session.
   */
  getSession(peerId: string): NoiseSession | undefined {
    return this.sessions.get(peerId);
  }

  /**
   * Remove a session.
   */
  removeSession(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (session) {
      session.clear();
      this.sessions.delete(peerId);
    }
  }

  /**
   * Reset a session for re-handshake.
   */
  resetSession(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (session) {
      session.reset();
    }
  }

  /**
   * Get all established sessions.
   */
  getEstablishedSessions(): NoiseSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.isEstablished());
  }

  /**
   * Clear all sessions.
   */
  clearAll(): void {
    for (const session of this.sessions.values()) {
      session.clear();
    }
    this.sessions.clear();
  }
}

// MARK: - Utility Functions

/**
 * Generate a new X25519 key pair for Noise protocol.
 */
export function generateNoiseKeyPair(): NoiseKeyPair {
  ensureSodiumReady();
  const sodium = getSodium();

  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Create a key pair from an existing private key.
 */
export function keyPairFromPrivateKey(privateKey: Uint8Array): NoiseKeyPair {
  ensureSodiumReady();
  const sodium = getSodium();

  if (privateKey.length !== NoiseConstants.DH_LEN) {
    throw new NoiseError(
      `Invalid private key length: expected ${NoiseConstants.DH_LEN}, got ${privateKey.length}`,
      NoiseErrorCode.InvalidPublicKey
    );
  }

  const publicKey = sodium.crypto_scalarmult_base(privateKey);
  return {
    publicKey,
    privateKey: new Uint8Array(privateKey),
  };
}

/**
 * Perform a complete XX handshake between two parties.
 * Useful for testing.
 */
export function performXXHandshake(
  initiatorStaticKey: NoiseKeyPair,
  responderStaticKey: NoiseKeyPair
): {
  initiatorSession: NoiseSession;
  responderSession: NoiseSession;
} {
  const initiatorSession = new NoiseSession({
    peerId: 'responder',
    role: NoiseRole.Initiator,
    localStaticKey: initiatorStaticKey,
  });

  const responderSession = new NoiseSession({
    peerId: 'initiator',
    role: NoiseRole.Responder,
    localStaticKey: responderStaticKey,
  });

  // Message 1: Initiator -> Responder
  const msg1 = initiatorSession.startHandshake();

  // Message 2: Responder -> Initiator
  const msg2 = responderSession.processHandshakeMessage(msg1);
  if (!msg2) {
    throw new NoiseError('Expected response from responder', NoiseErrorCode.InvalidState);
  }

  // Message 3: Initiator -> Responder
  const msg3 = initiatorSession.processHandshakeMessage(msg2);
  if (!msg3) {
    throw new NoiseError('Expected response from initiator', NoiseErrorCode.InvalidState);
  }

  // Final: Responder processes msg3
  const finalResponse = responderSession.processHandshakeMessage(msg3);
  if (finalResponse !== null) {
    throw new NoiseError('Expected null response', NoiseErrorCode.InvalidState);
  }

  if (!initiatorSession.isEstablished() || !responderSession.isEstablished()) {
    throw new NoiseError('Handshake did not complete', NoiseErrorCode.HandshakeNotComplete);
  }

  return { initiatorSession, responderSession };
}
