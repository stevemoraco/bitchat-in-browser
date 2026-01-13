# BitChat In Browser

Encrypted mesh-style messaging for the web. A Progressive Web App (PWA) that interoperates with the native BitChat iOS and Android apps through the Nostr protocol.

**Live:** [bitbrowse.eth.limo](https://bitbrowse.eth.limo)

## Features

- **Location Channels** - Join conversations based on your geographic location using geohash
- **Private DMs** - End-to-end encrypted direct messages with NIP-17 gift wrapping
- **Offline First** - Full functionality after initial load, with background sync
- **Cross-Platform** - Messages visible to iOS and Android BitChat users
- **Key Import** - Bring your existing Nostr identity (nsec)
- **P2P Sharing** - Share the app via WiFi hotspot to others nearby
- **Emergency Wipe** - Triple-tap logo to instantly clear all data
- **No Tracking** - Zero analytics, completely private
- **Decentralized Hosting** - IPFS + ENS for censorship resistance

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript type checking only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Format code with Prettier |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:headed` | Run E2E tests with browser UI |
| `npm run test:e2e:debug` | Debug E2E tests |
| `npm run test:all` | Run both unit and E2E tests |

### Security

| Command | Description |
|---------|-------------|
| `npm run test:security` | Run security test suite |
| `npm run security:scan` | Run security vulnerability scan |
| `npm run security:audit` | Full security audit |

### Performance

| Command | Description |
|---------|-------------|
| `npm run test:bench` | Run benchmark tests |
| `npm run analyze:bundle` | Analyze bundle size |
| `npm run perf:all` | Run all performance checks |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Preact + TypeScript |
| Build | Vite 5.x |
| Styling | Tailwind CSS (terminal aesthetic) |
| State | Zustand (persisted) |
| Storage | OPFS + IndexedDB fallback |
| Crypto | libsodium.js (XChaCha20-Poly1305, Ed25519, X25519) |
| Messaging | nostr-tools + Trystero (WebRTC) |
| Offline | Workbox Service Worker |
| Testing | Vitest + Playwright |

## Project Structure

```
src/
├── components/      # Preact UI components
│   ├── chat/        # Chat interface (MessageList, MessageInput)
│   ├── channels/    # Channel management
│   ├── layout/      # Shell, Header, Navigation
│   ├── onboarding/  # Setup wizard
│   ├── peers/       # Peer management
│   ├── settings/    # Settings views
│   └── sharing/     # P2P app sharing
├── services/        # Core business logic
│   ├── crypto/      # libsodium encryption, signing, hashing
│   ├── nostr/       # Nostr client, relays, events, NIP-17
│   ├── storage/     # OPFS/IndexedDB storage abstraction
│   └── webrtc/      # Trystero P2P connections
├── stores/          # Zustand state management
│   ├── identity-store.ts   # User identity (public key, fingerprint)
│   ├── messages-store.ts   # Chat messages by channel
│   ├── channels-store.ts   # Channel list and state
│   ├── peers-store.ts      # Known peers
│   └── settings-store.ts   # User preferences
├── workers/         # Service Worker (sw.ts)
└── types/           # TypeScript type definitions
```

## Deployment

BitChat In Browser is deployed to IPFS and served via ENS for decentralized, censorship-resistant hosting.

### Deploy to IPFS

```bash
# Build the project
npm run build

# Deploy (requires PINATA_JWT env var)
npm run deploy:ipfs

# Output: CID like bafybeig...
```

### Update ENS

After deployment, update the ENS content hash for `bitbrowse.eth`:

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect the wallet that owns `bitbrowse.eth`
3. Navigate to `bitbrowse.eth` > Records
4. Set Content Hash to: `ipfs://<CID>` (CID from deployment output)
5. Confirm transaction
6. Verify at [bitbrowse.eth.limo](https://bitbrowse.eth.limo)

### Environment Variables

For IPFS deployment, set in GitHub Secrets or `.env`:

```bash
PINATA_JWT=your_pinata_jwt_token
WEB3_STORAGE_TOKEN=your_web3_storage_token  # optional backup
```

### IPFS Gateways

After deployment, the app is accessible via:
- `https://bitbrowse.eth.limo` (primary, after ENS update)
- `https://<CID>.ipfs.dweb.link`
- `https://gateway.pinata.cloud/ipfs/<CID>`

## Native Apps

For full mesh networking capabilities including Bluetooth:

### iOS
- [App Store (Universal)](https://apps.apple.com/app/bitchat-mesh/id6748219622)

### Android
- [Google Play](https://play.google.com/store/apps/details?id=com.bitchat.droid)
- [APK Download](https://github.com/permissionlesstech/bitchat-android/releases/latest)

### Feature Comparison

| Feature | Web | iOS | Android |
|---------|-----|-----|---------|
| Location Channels | Yes | Yes | Yes |
| Private DMs (NIP-17) | Yes | Yes | Yes |
| Offline Storage | Yes | Yes | Yes |
| Offline Queue | Yes | Yes | Yes |
| Emergency Wipe | Yes | Yes | Yes |
| IRC Commands | Yes | Yes | Yes |
| @Mentions | Yes | Yes | Yes |
| BLE Mesh | No | Yes | Yes |
| Background BLE | No | Yes | Yes |
| Key Import | Yes | No | No |
| P2P App Sharing | Yes | No | No |

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core messaging | Yes | Yes | Yes | Yes |
| Service Worker | Yes | Yes | Yes | Yes |
| Add to Home Screen | Yes | Yes | Yes | Yes |
| Push Notifications | Yes | Yes | Limited | Yes |
| OPFS Storage | Yes | Yes | Yes | Yes |

**Note:** Bluetooth mesh networking is not available in browsers. Use native apps for BLE mesh.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and component overview
- [Development](docs/DEVELOPMENT.md) - Setup, coding standards, debugging
- [Protocol](docs/PROTOCOL.md) - Nostr protocol usage and NIP implementations
- [Privacy](docs/PRIVACY.md) - Data handling and privacy guarantees

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test:all`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- **Offline First:** All features must work offline after initial load
- **Bundle Size:** Keep initial bundle under 500KB
- **Compatibility:** Match BitChat native behavior exactly
- **No Analytics:** Zero tracking, completely private
- **Terminal Aesthetic:** Match iOS/Android app visual style

## License

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

See [UNLICENSE](https://unlicense.org) for details.

## Links

- **Web App:** [bitbrowse.eth.limo](https://bitbrowse.eth.limo)
- **iOS App:** [App Store](https://apps.apple.com/app/bitchat-mesh/id6748219622)
- **Android App:** [Play Store](https://play.google.com/store/apps/details?id=com.bitchat.droid)
- **GitHub:** [permissionlesstech/bitchat-in-browser](https://github.com/permissionlesstech/bitchat-in-browser)
