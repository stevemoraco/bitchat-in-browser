# Privacy Architecture

BitChat In Browser is designed with privacy as a core principle. This document details what data is stored, transmitted, and our no-tracking guarantee.

## Privacy Principles

1. **No Analytics** - Zero tracking, telemetry, or usage metrics
2. **No Accounts** - No server-side accounts or data collection
3. **Local First** - All data stored locally on your device
4. **E2E Encryption** - Direct messages encrypted end-to-end
5. **Decentralized** - No central server controls the network

## No Tracking Guarantee

BitChat In Browser contains:

- **No analytics scripts** (Google Analytics, Mixpanel, etc.)
- **No tracking pixels**
- **No telemetry collection**
- **No crash reporting to external services**
- **No user behavior monitoring**
- **No advertising SDKs**
- **No third-party cookies**

The app is hosted on IPFS and served via ENS, with no server-side code that could track users.

## Data Storage

### What is Stored Locally

| Data | Storage | Purpose |
|------|---------|---------|
| Public key | localStorage | Identity restoration |
| Fingerprint | localStorage | Display identifier |
| Settings | localStorage | User preferences |
| Messages | IndexedDB/OPFS | Message history |
| Channels | localStorage | Channel list |
| Peers | localStorage | Known contacts |
| Offline queue | localStorage | Pending messages |

### What is NOT Stored

| Data | Reason |
|------|--------|
| Private keys (persisted) | Security - memory only |
| Browsing history | Not needed |
| Location history | Not tracked |
| Usage patterns | Not collected |
| Crash reports | Not sent anywhere |

### Storage Isolation

All data is isolated by browser origin:

```
bitbrowse.eth.limo
├── localStorage (settings, identity)
├── IndexedDB (messages, channels)
└── OPFS (if available, messages)
```

Other websites cannot access this data.

### Data Retention

- Messages: Up to 1000 per channel (oldest automatically removed)
- Peers: Kept until manually deleted
- Settings: Kept until app is wiped

## Private Key Handling

### Memory-Only Storage

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Lifecycle                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Key Generation/Import                                    │
│     └── Private key loaded into JavaScript memory            │
│                                                              │
│  2. Active Use                                               │
│     └── Key used for signing events                         │
│     └── Key used for decrypting DMs                         │
│                                                              │
│  3. Session End / Wipe                                       │
│     └── Key cleared from memory                             │
│     └── No trace in storage                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Persisted

```typescript
// Only public data is persisted
{
  identity: {
    publicKey: "abc123...",    // Persisted
    fingerprint: "AB:CD:EF",   // Persisted
    npub: "npub1...",          // Persisted
    isKeyLoaded: false,        // NOT persisted (runtime only)
    // privateKey: NEVER       // Never stored
  }
}
```

### Emergency Wipe

Triple-tap the logo to instantly clear:

1. All Zustand stores (in-memory state)
2. All localStorage data
3. All IndexedDB/OPFS data
4. Private key from memory

```typescript
// What gets cleared
localStorage.removeItem('bitchat-messages');
localStorage.removeItem('bitchat-channels');
localStorage.removeItem('bitchat-peers');
localStorage.removeItem('bitchat-settings');
localStorage.removeItem('bitchat-identity');

// IndexedDB tables cleared
await storage.clearAllData();

// Memory state reset
useIdentityStore.getState().clearIdentity();
```

## Network Transmission

### What is Transmitted

| Data | Destination | Encryption |
|------|-------------|------------|
| Public key | Nostr relays | None (public) |
| Location messages | Nostr relays | None (ephemeral) |
| Direct messages | Nostr relays | NIP-17 E2E |
| WebRTC signals | Trystero/peers | DTLS |

### What is NOT Transmitted

- Private keys (never leave the browser)
- Browsing behavior
- Device identifiers
- Location data (beyond chosen channels)
- Usage metrics

### Relay Communication

```
┌─────────────┐                    ┌─────────────────┐
│   Browser   │ ◄──── WSS/TLS ────► │  Nostr Relay   │
│             │                    │                 │
│ Private Key │                    │ Sees:           │
│ (memory)    │                    │ - Public key    │
│             │                    │ - Event kind    │
│ Messages    │                    │ - Timestamp     │
│ (encrypted) │                    │ - Encrypted     │
│             │                    │   content (DMs) │
└─────────────┘                    └─────────────────┘
```

### DM Privacy (NIP-17)

Direct messages use gift wrapping:

```
What relays see:
┌─────────────────────────────────────┐
│  Gift Wrap Event                     │
│  - Random pubkey (not sender)        │
│  - Recipient pubkey (in tags)        │
│  - Encrypted blob (unreadable)       │
│  - Timestamp (not original)          │
└─────────────────────────────────────┘

What relays DON'T see:
- Actual sender identity
- Message content
- Original timestamp
```

### Location Channel Privacy

Location channels are public by design:

- Geohash is visible in event tags
- Message content is plaintext
- Sender public key is visible
- Use for public conversation, not private

## Third-Party Services

### Services Used

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Nostr relays | Message relay | Events (see above) |
| IPFS | App hosting | None |
| ENS | Domain resolution | None |

### Services NOT Used

- No Google services
- No Facebook/Meta services
- No Amazon AWS
- No Microsoft Azure
- No analytics providers
- No advertising networks
- No user tracking services

## Browser Permissions

### Required Permissions

| Permission | Purpose | Optional |
|------------|---------|----------|
| Storage | Save messages | No |
| WebSocket | Relay connection | No |

### Optional Permissions

| Permission | Purpose | When Requested |
|------------|---------|----------------|
| Notifications | Message alerts | User opts in |
| Location | Join location channels | User opts in |
| Clipboard | Copy fingerprint | On action |

### Denied Permissions

BitChat never requests:
- Camera
- Microphone
- Contacts
- Calendar
- Device motion
- Bluetooth (not available in browsers)

## Metadata Protection

### Protected Metadata

| Metadata | Protection |
|----------|------------|
| DM sender | Hidden via gift wrap |
| DM recipient | Revealed to relays (necessary) |
| DM timing | Randomized within window |
| Message content | E2E encrypted |

### Exposed Metadata

| Metadata | Visibility | Notes |
|----------|------------|-------|
| Public key | Public | Your Nostr identity |
| Location channel | Public | Geohash you join |
| Online status | Relays | WebSocket connection |
| IP address | Relays, ISP | Use Tor for protection |

### IP Address Protection

To protect your IP address:

1. Use a VPN
2. Use Tor Browser (limited SW support)
3. Use a privacy-focused DNS

## Audit Trail

### What We Log (Client-Side Only)

```typescript
// Development only logs (not in production build)
console.log('[NostrClient] Connection status:', status);
console.log('[StorageManager] Using OPFS storage');
```

### What We Don't Log

- User actions
- Message content
- Private keys
- Personal information
- Error reports to external services

## Security Practices

### Encryption Standards

| Use Case | Algorithm |
|----------|-----------|
| Event signing | Schnorr (BIP-340) |
| DM encryption | XChaCha20-Poly1305 |
| Key exchange | X25519 |
| Hashing | SHA-256 |

### Security Headers

The app is served with:

```
Content-Security-Policy: default-src 'self'; connect-src wss: https:
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

## Comparison with Native Apps

| Privacy Aspect | Web | iOS | Android |
|----------------|-----|-----|---------|
| No analytics | Yes | Yes | Yes |
| Local storage | Yes | Yes | Yes |
| E2E DMs | Yes | Yes | Yes |
| Memory-only keys | Yes | Yes | Yes |
| Emergency wipe | Yes | Yes | Yes |
| BLE mesh | No | Yes | Yes |

## Questions and Concerns

### "How do I know there's no tracking?"

1. The source code is open source - audit it
2. Use browser DevTools Network tab - no tracking requests
3. The app runs on IPFS - no server to collect data
4. Build from source to verify

### "What if a relay is malicious?"

- Relays can see public metadata (pubkey, timestamps)
- Relays cannot read encrypted DM content
- Multiple relays provide redundancy
- You can choose which relays to use

### "Can my ISP see my messages?"

- ISP sees you connecting to relay domains
- ISP cannot see WebSocket content (TLS encrypted)
- ISP cannot read DM content (E2E encrypted)
- Use VPN/Tor for maximum privacy

### "What happens if I lose my device?"

- Data is local only - it's gone with the device
- Export your nsec (private key) for backup
- Import nsec on new device to restore identity
- Messages are not backed up automatically

## Summary

BitChat In Browser is designed to minimize data collection and maximize user privacy:

- **No tracking** - We don't want your data
- **Local storage** - Your data stays on your device
- **E2E encryption** - DMs are private
- **Memory-only keys** - Private keys never touch storage
- **Emergency wipe** - Instant data deletion
- **Open source** - Verify our claims yourself
