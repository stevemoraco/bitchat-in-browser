# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BitChat In Browser** is a Progressive Web App (PWA) that provides encrypted mesh-style messaging via web browsers. It interoperates with the native BitChat iOS and Android apps through the Nostr protocol.

- **Live URL:** bitbrowse.eth.limo
- **Hosting:** IPFS + ENS (decentralized, censorship-resistant)
- **Related repos:** `../bitchat` (iOS), `../bitchat-android` (Android)

## Build Commands

```bash
# Install dependencies
npm install

# Development server (port 5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

### Testing Commands

```bash
# Unit tests (Vitest)
npm run test
npm run test:watch
npm run test:coverage
npm run test:coverage:report

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:ui
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
npm run test:e2e:mobile

# All tests
npm run test:all
npm run test:ci

# Specific test file
npm run test -- src/services/crypto/__tests__/encryption.test.ts
```

### Security and Performance

```bash
# Security tests
npm run test:security
npm run security:scan
npm run security:audit

# Benchmarks
npm run test:bench
npm run test:bench:crypto
npm run test:bench:storage
npm run test:bench:rendering

# Bundle analysis
npm run analyze:bundle
npm run perf:all
```

### Deployment

```bash
# Build and deploy to IPFS
npm run build
npm run deploy:ipfs

# Generate PWA assets
npm run generate:icons
npm run generate:splash
npm run generate:pwa-assets
```

## Architecture

### Tech Stack

- **Framework:** Preact + TypeScript
- **Build:** Vite 5.x
- **Styling:** Tailwind CSS (terminal aesthetic)
- **State:** Zustand (persisted to localStorage)
- **Storage:** OPFS (primary) + IndexedDB (fallback)
- **Crypto:** libsodium-wrappers-sumo
- **Messaging:** nostr-tools + Trystero (WebRTC)
- **Offline:** Workbox Service Worker
- **Testing:** Vitest (unit) + Playwright (E2E)

### Key Directories

```
src/
├── components/     # Preact UI components
│   ├── chat/       # Message display and input
│   ├── channels/   # Channel list and management
│   ├── layout/     # App shell, header, navigation
│   ├── onboarding/ # First-run setup wizard
│   ├── peers/      # Peer list and actions
│   ├── settings/   # Settings panels
│   ├── sharing/    # P2P app sharing
│   └── ui/         # Reusable primitives
├── services/       # Core business logic
│   ├── crypto/     # libsodium encryption, signing, hashing
│   ├── nostr/      # Nostr client, relays, events, NIP-17
│   ├── storage/    # OPFS/IndexedDB storage abstraction
│   └── webrtc/     # Trystero P2P connections
├── stores/         # Zustand state management
│   ├── identity-store.ts   # User identity (public key, fingerprint)
│   ├── messages-store.ts   # Chat messages by channel
│   ├── channels-store.ts   # Channel list and state
│   ├── peers-store.ts      # Known peers
│   └── settings-store.ts   # User preferences
├── workers/        # Service Worker (sw.ts)
├── test/           # Test utilities and mocks
└── types/          # TypeScript type definitions
```

### Services

#### Crypto Service (`src/services/crypto/`)

- `init.ts` - Initializes libsodium, ensures ready before use
- `keys.ts` - Key generation (Ed25519 for signing, X25519 for encryption)
- `encryption.ts` - XChaCha20-Poly1305 authenticated encryption
- `signing.ts` - Ed25519 message signing and verification
- `hash.ts` - SHA-256 hashing, fingerprint derivation

#### Nostr Service (`src/services/nostr/`)

- `client.ts` - High-level NostrClient interface with connection management
- `relays.ts` - RelayPool with exponential backoff reconnection
- `queue.ts` - OutboxQueue for offline event storage and retry
- `types.ts` - Nostr event, filter, and status types (NIP-01)

#### Storage Service (`src/services/storage/`)

- `storage-manager.ts` - Unified storage API with automatic backend selection
- `opfs-storage.ts` - Origin Private File System adapter (preferred)
- `indexeddb-storage.ts` - IndexedDB fallback adapter
- Handles persistent storage requests, health monitoring, export/import

### Compatibility with Native Apps

Web client interoperates with iOS/Android via Nostr protocol:

- Same default relay list (20+ relays)
- Same event kinds (kind 20000 for location channels)
- Same geohash format for location channels
- NIP-17 for encrypted DMs (gift wrap + seal)

**Cannot do:** BLE mesh (browser limitation)

## Testing

```bash
# Unit tests (Vitest)
npm run test
npm run test:watch
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:headed  # with browser UI

# Specific test file
npm run test -- src/services/crypto/__tests__/encryption.test.ts
```

## Deployment

### To IPFS

```bash
npm run build
npm run deploy:ipfs
# Outputs CID - provide to owner for ENS update
```

### ENS Update (manual)

1. Go to app.ens.domains
2. Select bitbrowse.eth
3. Update Content Hash to new IPFS CID
4. Verify at bitbrowse.eth.limo

## Key Features

### P2P App Sharing

Users can share the app via WiFi hotspot. See `src/services/sharing/`.

### Key Import

Users can import existing Nostr nsec. Validates and derives public key.

### Emergency Wipe

Triple-tap logo to wipe all data. Clears all stores and storage.

### Offline Queue

Messages queued when offline, automatically flushed on reconnection.

## Development Guidelines

1. **Offline First:** All features must work offline after initial load
2. **Bundle Size:** Keep initial bundle under 500KB
3. **Compatibility:** Match BitChat native behavior exactly
4. **No Analytics:** Zero tracking, completely private
5. **Terminal Aesthetic:** Match iOS/Android app visual style

## Documentation

- [README.md](README.md) - Project overview and quick start
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design and component structure
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Setup guide and coding standards
- [docs/PROTOCOL.md](docs/PROTOCOL.md) - Nostr implementation details
- [docs/PRIVACY.md](docs/PRIVACY.md) - Privacy guarantees and data handling
