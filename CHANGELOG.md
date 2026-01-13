# Changelog

All notable changes to BitChat In Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-12

### Added

#### Core Features
- **Location-based channels** - Join geohash-based channels to chat with nearby users
- **Private encrypted DMs** - NIP-17 compliant gift-wrapped direct messages
- **Nostr protocol support** - Full interoperability with iOS and Android BitChat apps
- **Offline-first architecture** - Complete functionality after initial load with Service Worker caching

#### Security
- **End-to-end encryption** - libsodium-based cryptography (X25519, Ed25519, ChaCha20)
- **Noise Protocol** - XX handshake for secure session establishment
- **Emergency wipe** - Triple-tap logo to instantly clear all data
- **Zero analytics** - No tracking, completely private

#### PWA Capabilities
- **Installable** - Add to Home Screen on iOS and Android
- **Offline mode** - Works without internet after first visit
- **Service Worker** - Workbox-powered caching strategies
- **Share target** - Receive shared content from other apps
- **Protocol handler** - Handle web+nostr:// URLs

#### User Experience
- **Terminal aesthetic** - Matching iOS/Android BitChat visual style
- **IRC-style commands** - /join, /msg, /help, and more
- **@mentions** - Tag other users with autocomplete
- **P2P app sharing** - Share the app via WiFi hotspot
- **Key import** - Import existing Nostr nsec identity

#### Storage
- **OPFS + IndexedDB** - Dual storage layer with automatic fallback
- **Dexie.js** - Robust IndexedDB wrapper
- **Encrypted storage** - All sensitive data encrypted at rest
- **Offline queue** - Messages queued when offline, synced on reconnect

#### Deployment
- **IPFS hosting** - Decentralized, censorship-resistant hosting
- **ENS domain** - Accessible at bitbrowse.eth.limo
- **Multi-provider** - Pinata and web3.storage for redundancy
- **GitHub Actions** - Automated CI/CD pipeline

#### Developer Experience
- **Preact + TypeScript** - Type-safe component development
- **Vite** - Fast development server and optimized builds
- **Vitest** - Unit testing with coverage
- **Playwright** - End-to-end testing across browsers
- **ESLint + Prettier** - Code quality and formatting

### Known Limitations

#### Browser Constraints
- **No BLE mesh** - Bluetooth Low Energy not available in browsers
- **No background BLE** - Cannot run mesh networking in background
- **Limited push notifications** - iOS Safari has restricted PWA push support
- **CORS restrictions** - Some relay connections may require proxy

#### Platform Differences
- **iOS Add to Home Screen** - Requires Safari, not supported in other browsers
- **SharedArrayBuffer** - Requires specific server headers (COOP/COEP)
- **OPFS availability** - Some browsers may fall back to IndexedDB only

#### Feature Parity
- **Voice messages** - Not yet implemented (planned for v1.1)
- **File attachments** - Not yet implemented (planned for v1.1)
- **Group DMs** - Not yet implemented (planned for v1.2)

### Security Considerations

- All private keys stored encrypted in browser storage
- Session data cleared on browser close (configurable)
- No server-side data persistence
- All relay connections use WSS (secure WebSockets)
- Content Security Policy enforced

### Compatibility

| Platform | Browser | Status |
|----------|---------|--------|
| iOS | Safari | Full support |
| iOS | Chrome | Limited (no PWA install) |
| Android | Chrome | Full support |
| Android | Firefox | Full support |
| Desktop | Chrome | Full support |
| Desktop | Firefox | Full support |
| Desktop | Safari | Full support |
| Desktop | Edge | Full support |

### Native App Interoperability

BitChat In Browser is fully compatible with:
- BitChat iOS (App Store)
- BitChat Android (Play Store)

All platforms share:
- Same relay network (290+ relays)
- Same event kinds and formats
- Same geohash encoding for location channels
- Same NIP-17 implementation for encrypted DMs

---

## [Unreleased]

### Planned for v1.1.0
- Voice message support
- File/image attachments
- Improved offline sync
- Dark/light theme toggle

### Planned for v1.2.0
- Group DMs (NIP-17 extension)
- Channel moderation tools
- Custom relay configuration
- Export/backup functionality

---

[1.0.0]: https://github.com/permissionlesstech/bitchat-in-browser/releases/tag/v1.0.0
[Unreleased]: https://github.com/permissionlesstech/bitchat-in-browser/compare/v1.0.0...HEAD
