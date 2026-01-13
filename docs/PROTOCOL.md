# Protocol Documentation

BitChat In Browser uses the Nostr protocol for decentralized messaging. This document covers the protocol implementation details.

## Nostr Protocol Overview

Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol for social networking and messaging. It uses:

- **Public key cryptography** for identity (secp256k1)
- **Relays** for message distribution (WebSocket servers)
- **Events** as the fundamental data unit (JSON)

Reference: [Nostr Protocol](https://github.com/nostr-protocol/nostr)

## Event Structure

All Nostr events follow NIP-01:

```typescript
interface NostrEvent {
  id: string;         // 32-byte hex SHA256 of serialized event
  pubkey: string;     // 32-byte hex public key of author
  created_at: number; // Unix timestamp in seconds
  kind: number;       // Event type identifier
  tags: string[][];   // Array of tag arrays
  content: string;    // Event content (may be encrypted)
  sig: string;        // 64-byte hex Schnorr signature
}
```

### Event ID Calculation

```typescript
// Serialize event for hashing
const serialized = JSON.stringify([
  0,                    // Reserved
  event.pubkey,         // Author pubkey
  event.created_at,     // Timestamp
  event.kind,           // Event kind
  event.tags,           // Tags array
  event.content,        // Content
]);

// SHA256 hash
const id = sha256(serialized);
```

### Event Signing

Events are signed using Schnorr signatures (BIP-340):

```typescript
const signature = schnorr.sign(eventId, privateKey);
```

## Event Kinds Used

BitChat uses specific event kinds for different message types:

| Kind | Name | Usage | Persistence |
|------|------|-------|-------------|
| 0 | Metadata | User profile info | Replaceable |
| 1 | Text Note | Public channel messages | Persistent |
| 4 | Encrypted DM | Legacy DMs (not used) | Persistent |
| 13 | Seal | Inner DM content | Ephemeral |
| 14 | Direct Message | Unwrapped DM | Ephemeral |
| 1059 | Gift Wrap | Encrypted DM container | Persistent |
| 20000 | Ephemeral | Location channel messages | Ephemeral |

### Kind 20000: Location Channels

Location channels use ephemeral events (kind 20000-29999 range):

```typescript
const locationEvent = {
  kind: 20000,
  pubkey: userPublicKey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['g', geohash],           // Geohash tag
    ['p', geohash.slice(0, 6)], // Precision indicator
  ],
  content: 'Hello from this location!',
  // id and sig added after signing
};
```

**Geohash Precision:**
- Precision 4: ~39km (country/region)
- Precision 5: ~5km (city)
- Precision 6: ~1.2km (neighborhood)
- Precision 7: ~150m (block)
- Precision 8: ~40m (building)

### Kind 1059: Gift Wrapped DMs (NIP-17)

Private messages use NIP-17 gift wrapping:

```
┌─────────────────────────────────────────────┐
│              Gift Wrap (1059)                │
│  pubkey: random_pubkey                       │
│  content: encrypted_seal                     │
│  tags: [['p', recipient_pubkey]]            │
├─────────────────────────────────────────────┤
│              Seal (kind 13)                  │
│  pubkey: sender_pubkey                       │
│  content: encrypted_dm                       │
├─────────────────────────────────────────────┤
│         Direct Message (kind 14)             │
│  pubkey: sender_pubkey                       │
│  content: plaintext_message                  │
│  tags: [['p', recipient_pubkey]]            │
└─────────────────────────────────────────────┘
```

## NIP Implementations

### NIP-01: Basic Protocol

Core event structure and relay communication.

**Implementation:** `src/services/nostr/types.ts`

### NIP-04: Encrypted Direct Messages (Legacy)

**Status:** Not used (superseded by NIP-17)

NIP-04 has known vulnerabilities:
- Metadata leakage (timestamps, sender/recipient visible)
- No forward secrecy

### NIP-17: Private Direct Messages

Secure DM implementation using gift wrapping.

**Implementation:** `src/services/nostr/nip17.ts` (if present)

**Encryption Layers:**

1. **Inner DM (kind 14):** Contains actual message
2. **Seal (kind 13):** Encrypts inner DM, signed by sender
3. **Gift Wrap (kind 1059):** Encrypts seal, uses random key

**Key Exchange:**
- X25519 (Curve25519) Diffie-Hellman
- Shared secret derived using NIP-44 algorithm

**Encryption:**
- XChaCha20-Poly1305 (NIP-44 v2)
- 24-byte random nonce per message

### NIP-19: Bech32 Encoding

Human-readable key encoding.

| Prefix | Data Type |
|--------|-----------|
| `npub` | Public key |
| `nsec` | Private key |
| `note` | Event ID |
| `nprofile` | Profile + relays |
| `nevent` | Event + relays |

```typescript
import { nip19 } from 'nostr-tools';

// Encode public key
const npub = nip19.npubEncode(publicKeyHex);
// npub1abc123...

// Decode nsec (for key import)
const { data: privateKey } = nip19.decode(nsecString);
```

### NIP-44: Versioned Encryption

Encryption algorithm for NIP-17 messages.

**Version 2 (current):**
- Key derivation: HKDF-SHA256
- Cipher: XChaCha20-Poly1305
- Padding: Variable length padding

## Relay Communication

### Connection

```typescript
const ws = new WebSocket('wss://relay.damus.io');

ws.onopen = () => {
  console.log('Connected to relay');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleRelayMessage(message);
};
```

### Client Messages

Messages sent from client to relay:

```typescript
// Subscribe to events
['REQ', subscriptionId, filter1, filter2, ...]

// Publish event
['EVENT', signedEvent]

// Close subscription
['CLOSE', subscriptionId]
```

### Relay Messages

Messages sent from relay to client:

```typescript
// Event matching subscription
['EVENT', subscriptionId, event]

// Event acceptance/rejection
['OK', eventId, success, message]

// End of stored events
['EOSE', subscriptionId]

// Subscription closed
['CLOSED', subscriptionId, reason]

// Relay notice
['NOTICE', message]
```

### Filters

Subscription filters for querying events:

```typescript
interface NostrFilter {
  ids?: string[];       // Event IDs
  authors?: string[];   // Author pubkeys
  kinds?: number[];     // Event kinds
  since?: number;       // After timestamp
  until?: number;       // Before timestamp
  limit?: number;       // Max events
  '#e'?: string[];      // Event references
  '#p'?: string[];      // Pubkey references
  '#g'?: string[];      // Geohash tags
}
```

**Example: Location Channel Subscription**

```typescript
const filter = {
  kinds: [20000],
  '#g': ['u4pru'],     // Geohash prefix
  since: Math.floor(Date.now() / 1000) - 3600, // Last hour
  limit: 100,
};
```

## Default Relay List

BitChat connects to the same relays as native apps:

```typescript
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub',
  'wss://nostr21.com',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.fmt.wiz.biz',
  // ... more relays
];
```

## Key Import (nsec)

Users can import existing Nostr identities:

```typescript
import { nip19, getPublicKey } from 'nostr-tools';

function importNostrKey(input: string): {
  publicKey: string;
  privateKey: Uint8Array;
} {
  let privateKeyHex: string;

  if (input.startsWith('nsec')) {
    // Bech32-encoded private key
    const decoded = nip19.decode(input);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec');
    }
    privateKeyHex = decoded.data;
  } else if (/^[0-9a-f]{64}$/i.test(input)) {
    // Raw hex private key
    privateKeyHex = input.toLowerCase();
  } else {
    throw new Error('Invalid key format');
  }

  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = getPublicKey(privateKey);

  return { publicKey, privateKey };
}
```

## Compatibility Notes

### Native App Interoperability

To ensure messages are visible across all BitChat clients:

1. **Same relay list** - All clients connect to the same relays
2. **Same event kinds** - Kind 20000 for location channels
3. **Same geohash format** - Standard precision levels
4. **Same encryption** - NIP-17 for DMs

### Web-Specific Limitations

| Feature | Web | Native |
|---------|-----|--------|
| Nostr relays | Yes | Yes |
| NIP-17 DMs | Yes | Yes |
| BLE mesh | No | Yes |
| Background sync | Limited | Yes |

### Event Ordering

Events are ordered by `created_at` timestamp. When displaying:

1. Sort by `created_at` ascending (oldest first)
2. Handle clock skew (accept events within reasonable time window)
3. Deduplicate by event `id`

## Security Considerations

### Key Security

- Private keys stored in memory only (never persisted)
- Keys cleared on logout/wipe
- No key backup to servers

### Message Security

| Message Type | Encryption | Metadata Protection |
|--------------|------------|---------------------|
| Location channels | None | Geohash visible |
| Public channels | None | Fully public |
| NIP-17 DMs | XChaCha20-Poly1305 | Sender/recipient hidden |

### Relay Trust

- Relays see event metadata (pubkey, kind, timestamp)
- Relays cannot read NIP-17 encrypted content
- Multiple relays provide redundancy
- No single point of failure

## References

- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-17: Private DMs](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-19: Bech32 Encoding](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [nostr-tools Library](https://github.com/nbd-wtf/nostr-tools)
