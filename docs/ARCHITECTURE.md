# Architecture

BitChat In Browser is a Progressive Web App that provides encrypted messaging through Nostr relays with offline-first capabilities.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BitChat In Browser                            │
│                   bitbrowse.eth.limo                             │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer: Preact + Tailwind CSS                                │
├─────────────────────────────────────────────────────────────────┤
│  State: Zustand (identity, channels, messages, peers)           │
├─────────────────────────────────────────────────────────────────┤
│  Services Layer                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Crypto  │ │  Nostr   │ │ Storage  │ │  WebRTC  │           │
│  │ Service  │ │  Client  │ │ Manager  │ │ (P2P)    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Storage: OPFS (primary) / IndexedDB (fallback)                 │
├─────────────────────────────────────────────────────────────────┤
│  Service Worker: Workbox (offline caching)                      │
└─────────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  Nostr Relays   │  │  WebRTC Peers   │
│   (20+ relays)  │  │  (via Trystero) │
└─────────────────┘  └─────────────────┘
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│                    (Router + Shell)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┬───────────┐
          ▼           ▼           ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Channels │ │   Chat   │ │  Peers   │ │ Settings │ │Onboarding│
    │   Page   │ │   View   │ │   Page   │ │   Page   │ │   Flow   │
    └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
         │            │            │            │            │
         └────────────┴────────────┴────────────┴────────────┘
                                   │
                      ┌────────────┼────────────┐
                      ▼            ▼            ▼
              ┌─────────────┐ ┌─────────┐ ┌─────────────┐
              │   Zustand   │ │Services │ │   Workers   │
              │   Stores    │ │  Layer  │ │     (SW)    │
              └─────────────┘ └─────────┘ └─────────────┘
```

## Directory Structure

```
src/
├── components/           # Preact UI components
│   ├── chat/             # Message display and input
│   ├── channels/         # Channel list and management
│   ├── layout/           # App shell, header, navigation
│   ├── onboarding/       # First-run setup wizard
│   ├── peers/            # Peer list and actions
│   ├── settings/         # Settings panels
│   ├── sharing/          # P2P app sharing
│   └── ui/               # Reusable primitives (Button, Modal, etc.)
├── services/             # Core business logic
│   ├── crypto/           # Cryptographic operations
│   ├── nostr/            # Nostr protocol implementation
│   ├── storage/          # Data persistence
│   └── webrtc/           # P2P connections
├── stores/               # Zustand state management
├── workers/              # Service Worker
└── types/                # TypeScript definitions
```

## Data Flow

### Message Send Flow

```
User Input
    │
    ▼
MessageInput (component)
    │
    ▼
MessagesStore.addMessage()     ─────────────► UI Update
    │
    ▼
NostrClient.publish()
    │
    ├── Online ───────────────────────────────► Nostr Relays
    │
    └── Offline ──► OutboxQueue.enqueue()
                            │
                            └──► (later) flush() ──► Nostr Relays
```

### Message Receive Flow

```
Nostr Relays
    │
    ▼
NostrClient.subscribe()
    │
    ▼
Event Handler
    │
    ├── Kind 20000 (Location) ─────► Process ephemeral event
    │
    └── Kind 1059 (NIP-17 DM) ─────► Unwrap gift wrap
                                            │
                                            ▼
                                     Decrypt seal
                                            │
                                            ▼
                                     Extract content
    │
    ▼
MessagesStore.addMessage()
    │
    ▼
UI Update (reactive)
```

## Services

### Crypto Service (`src/services/crypto/`)

Provides all cryptographic operations using libsodium.js.

| File | Purpose |
|------|---------|
| `init.ts` | Sodium initialization, ready state management |
| `keys.ts` | Key generation (Ed25519, X25519) |
| `signing.ts` | Ed25519 signatures for Nostr events |
| `encryption.ts` | XChaCha20-Poly1305 symmetric encryption |
| `hash.ts` | SHA-256 hashing, fingerprint derivation |
| `types.ts` | Crypto constants and type definitions |

**Key Types:**
- **Identity Key (Ed25519)** - Nostr signing, generates npub/nsec
- **Encryption Key (X25519)** - Derived from identity for NIP-17 DMs

**Crypto Constants:**
- `CHACHA20_KEY_BYTES`: 32 bytes
- `XCHACHA20_NONCE_BYTES`: 24 bytes
- `POLY1305_TAG_BYTES`: 16 bytes

### Nostr Service (`src/services/nostr/`)

Handles all Nostr protocol operations.

| File | Purpose |
|------|---------|
| `client.ts` | High-level NostrClient API |
| `relays.ts` | RelayPool with connection management |
| `queue.ts` | OutboxQueue for offline storage |
| `types.ts` | Nostr event, filter, and status types |

**NostrClient Features:**
- Connects to 20+ default relays (same as native apps)
- Automatic reconnection with exponential backoff
- Offline queue with localStorage persistence
- Subscription management with EOSE tracking
- Connection status listeners

**RelayPool Features:**
- Connection state tracking per relay
- Message send/receive counting
- Backoff configuration (1s initial, 5m max, 2x multiplier)
- Max 20 reconnection attempts per relay

**Default Relays (partial list):**
```
wss://relay.damus.io
wss://nos.lol
wss://relay.primal.net
wss://offchain.pub
wss://nostr21.com
wss://relay.nostr.band
wss://nostr.wine
...
```

### Storage Service (`src/services/storage/`)

Unified storage abstraction with automatic backend selection.

| File | Purpose |
|------|---------|
| `storage-manager.ts` | High-level storage API, orchestration |
| `opfs-storage.ts` | Origin Private File System adapter |
| `indexeddb-storage.ts` | IndexedDB fallback adapter |
| `types.ts` | Storage interfaces and table definitions |

**Backend Selection:**
1. Check OPFS availability
2. If available, use OPFS (better performance)
3. Otherwise, fall back to IndexedDB
4. Request persistent storage from browser

**Tables:**
- `messages` - Chat messages by ID
- `channels` - Channel metadata
- `peers` - Known peer information
- `settings` - App configuration
- `queue` - Offline message queue

**StorageManager API:**
```typescript
// Get/set operations
await storage.get('messages', 'msg_123');
await storage.set('messages', 'msg_123', messageData);
await storage.delete('messages', 'msg_123');

// Health monitoring
const health = await storage.getHealth();
// { isHealthy, backendType, usageBytes, quotaBytes, usagePercent }

// Data export/import
const backup = await storage.exportData();
await storage.importData(backup.data);

// Emergency wipe
await storage.clearAllData();
```

## Stores

Zustand stores manage application state with persistence to localStorage.

### Identity Store (`identity-store.ts`)

```typescript
interface Identity {
  publicKey: string;      // Hex-encoded Nostr pubkey
  fingerprint: string;    // 8-char short display identifier
  npub?: string;          // Bech32-encoded pubkey
  nip05?: string;         // NIP-05 identifier if set
  isKeyLoaded: boolean;   // Runtime: is private key in memory
  createdAt: number;      // Unix timestamp
}
```

**Security:** Private keys are NEVER stored in this store. Key material is held in memory only and cleared on logout/wipe. The `isKeyLoaded` field is runtime-only and never persisted.

### Channels Store (`channels-store.ts`)

```typescript
interface Channel {
  id: string;                  // Unique channel ID
  name: string;                // Display name
  type: 'location' | 'dm' | 'public';
  geohash?: string;            // Location channels only
  geohashPrecision?: number;   // Precision level (1-12)
  dmPeerFingerprint?: string;  // DM channels only
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  lastMessageAt: number;
  createdAt: number;
}
```

**Channel Types:**
- `location` - Geohash-based channels using kind 20000
- `dm` - Direct messages using NIP-17 (kind 1059)
- `public` - Public channels using kind 1 events

### Messages Store (`messages-store.ts`)

```typescript
interface Message {
  id: string;              // Nostr event ID
  channelId: string;       // Parent channel
  senderId: string;        // Sender public key
  senderNickname: string;  // Display name
  content: string;         // Decrypted content
  timestamp: number;       // Unix timestamp (seconds)
  status: 'sending' | 'sent' | 'failed';
  isOwn: boolean;          // Sent by current user
  isRead: boolean;         // Read status
  mentions?: string[];     // Mentioned fingerprints
}
```

Messages are stored in a `Record<channelId, Message[]>` structure with:
- Automatic deduplication by event ID
- Sorted by timestamp
- Max 1000 messages per channel (oldest trimmed)

### Peers Store (`peers-store.ts`)

```typescript
interface Peer {
  publicKey: string;
  fingerprint: string;
  nickname?: string;
  lastSeenAt?: number;
  status: 'online' | 'offline' | 'away';
  source: 'nostr' | 'webrtc' | 'ble';
  isBlocked: boolean;
  isTrusted: boolean;
}
```

### Settings Store (`settings-store.ts`)

```typescript
interface Settings {
  nickname: string;
  theme: 'dark' | 'light' | 'system';
  notificationLevel: 'all' | 'mentions' | 'none';
  soundEnabled: boolean;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  devMode: boolean;
}
```

## Service Worker

The Service Worker (`src/workers/sw.ts`) provides offline functionality using Workbox.

### Caching Strategies

| Resource | Strategy | TTL |
|----------|----------|-----|
| App shell (HTML, JS, CSS) | Precache | Until update |
| Fonts | Cache first | 1 year |
| Images | Cache first | 30 days |
| API calls | Network first | N/A |

### Offline Capabilities

- Full app loads from cache after first visit
- Messages queued locally when offline
- Automatic sync when connection restored
- Update notification when new version available

### Registration

```typescript
// src/workers/sw-registration.ts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    await navigator.serviceWorker.register('/sw.js');
  });
}
```

## Native App Interoperability

The web client maintains compatibility with iOS and Android BitChat apps:

| Aspect | Implementation |
|--------|----------------|
| Relay list | Same default relays |
| Event kinds | Kind 20000 (location channels), kind 1059 (NIP-17 DMs) |
| Geohash format | Standard precision levels (matching native) |
| DM encryption | NIP-17 (gift wrap + seal) |
| Key format | Standard Nostr secp256k1 |

**Limitation:** Bluetooth mesh is not available in browsers. Use native apps for BLE mesh networking.

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Security                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BitChat In Browser                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Private keys: Memory only (cleared on wipe)        │   │
│  │  Public keys: localStorage (for session restore)    │   │
│  │  Messages: OPFS/IndexedDB (origin-isolated)         │   │
│  │  Network: TLS to relays, E2E encryption for DMs    │   │
│  │  CSP: Strict Content Security Policy               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

See [PRIVACY.md](PRIVACY.md) for detailed privacy architecture.

## Performance Targets

| Metric | Target |
|--------|--------|
| Initial bundle | < 500KB |
| Time to interactive | < 3s on 3G |
| Message latency | < 500ms |
| Storage limit | 1000 messages/channel |
| Relay connections | 20+ simultaneous |

## Browser Compatibility

### Required APIs

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| Service Worker | 40+ | 44+ | 11.1+ | 17+ |
| IndexedDB | 23+ | 16+ | 10+ | 12+ |
| OPFS | 86+ | 111+ | 15.2+ | 86+ |
| WebSocket | 16+ | 11+ | 6+ | 12+ |
| crypto.subtle | 37+ | 34+ | 11+ | 12+ |

### Fallback Strategy

1. **OPFS unavailable**: Use IndexedDB
2. **Persistent storage denied**: Continue with non-persistent
3. **Service Worker unavailable**: App still works, no offline
4. **Push notifications unavailable**: Graceful degradation
