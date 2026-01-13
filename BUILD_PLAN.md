# BitChat In Browser - Complete Build Plan

## Project Overview

**Name:** BitChat In Browser
**Domain:** bitbrowse.eth.limo
**Repo:** bitchat-in-browser
**Goal:** Production-ready PWA with maximum feature parity to iOS & Android apps

## Key Decisions

- **Analytics:** None - completely analytics-free
- **Relay List:** Same as native BitChat apps
- **Key Import:** Yes - users can import existing Nostr nsec
- **Branding:** "BitChat In Browser"
- **App Store Links:** Include ALL countries' App Store and Play Store links
- **P2P Sharing:** Users can share app via WiFi tethering (local web server)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  BitChat In Browser                          │
│                 bitbrowse.eth.limo                           │
├─────────────────────────────────────────────────────────────┤
│  Hosting: IPFS (Pinata + web3.storage) + ENS                │
├─────────────────────────────────────────────────────────────┤
│  UI: Preact + Tailwind (terminal aesthetic)                 │
│  State: Zustand (persisted to storage)                      │
│  Storage: wa-sqlite/OPFS + IndexedDB fallback               │
│  Crypto: libsodium.js (Noise, X25519, Ed25519, ChaCha20)    │
│  Messaging: nostr-tools + Trystero (WebRTC P2P)             │
│  Offline: Workbox Service Worker                            │
│  Testing: Vitest (unit) + Playwright (E2E)                  │
│  CI/CD: GitHub Actions → IPFS → ENS                         │
├─────────────────────────────────────────────────────────────┤
│  Special Features:                                           │
│  - P2P App Sharing (serve PWA to others on same WiFi)       │
│  - Key Import (nsec for existing Nostr users)               │
│  - All-Country App Store Links                              │
│  - Emergency Wipe (triple-tap)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Preact 10.x + TypeScript 5.x |
| Build | Vite 5.x |
| Styling | Tailwind CSS 3.x |
| State | Zustand 4.x |
| Storage | wa-sqlite (OPFS) + Dexie.js (IndexedDB fallback) |
| Crypto | libsodium-wrappers-sumo |
| Nostr | nostr-tools 2.x |
| WebRTC | Trystero |
| Service Worker | Workbox 7.x |
| Testing | Vitest + Playwright |
| Linting | ESLint + Prettier |

---

## Feature Parity Matrix

| Feature | iOS | Android | Web | Notes |
|---------|-----|---------|-----|-------|
| Location Channels | ✅ | ✅ | ✅ | Geohash-based |
| Public Chat | ✅ | ✅ | ✅ | Via Nostr relays |
| Private DMs (NIP-17) | ✅ | ✅ | ✅ | Gift-wrapped |
| Offline Storage | ✅ | ✅ | ✅ | SQLite/IndexedDB |
| Offline Queue | ✅ | ✅ | ✅ | Sync on reconnect |
| Emergency Wipe | ✅ | ✅ | ✅ | Triple-tap |
| IRC Commands | ✅ | ✅ | ✅ | /join, /msg, etc. |
| @Mentions | ✅ | ✅ | ✅ | With autocomplete |
| BLE Mesh | ✅ | ✅ | ❌ | Browser limitation |
| Background BLE | ✅ | ✅ | ❌ | Browser limitation |
| Push Notifications | ✅ | ✅ | ⚠️ | PWA push (limited iOS) |
| P2P App Sharing | ❌ | ❌ | ✅ | NEW - WiFi tethering |
| Key Import | ❌ | ❌ | ✅ | NEW - Import nsec |

---

## P2P App Sharing Feature (NEW)

### How It Works

When a user has internet access, they can become a local distribution point:

```
┌─────────────────────────────────────────────────────────────┐
│                    P2P SHARING MODE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User A (has the app)                                        │
│  ┌──────────────┐                                           │
│  │ BitChat PWA  │ ──→ Enables "Share App" mode              │
│  │              │ ──→ Creates WiFi hotspot                  │
│  │              │ ──→ Serves PWA on local HTTP server       │
│  └──────────────┘                                           │
│         │                                                    │
│         │ WiFi Hotspot: "BitChat-Share"                     │
│         │ URL: http://192.168.43.1:8080                     │
│         ▼                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   User B     │  │   User C     │  │   User D     │      │
│  │ (no app yet) │  │ (no app yet) │  │ (no app yet) │      │
│  │              │  │              │  │              │      │
│  │ 1. Connect   │  │ 1. Connect   │  │ 1. Connect   │      │
│  │    to WiFi   │  │    to WiFi   │  │    to WiFi   │      │
│  │ 2. Open URL  │  │ 2. Open URL  │  │ 2. Open URL  │      │
│  │ 3. PWA loads │  │ 3. PWA loads │  │ 3. PWA loads │      │
│  │ 4. Add to HS │  │ 4. Add to HS │  │ 4. Add to HS │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

On Android (primary scenario):
1. User enables mobile hotspot (manual - OS level)
2. App displays QR code with local URL + hotspot name
3. Service Worker serves cached app to local network
4. New users connect, scan QR, get full PWA

On iOS:
1. Personal Hotspot (limited - requires cellular)
2. Or: Use WebRTC to share app data directly

### UI Flow

```
Settings → Share App
├── "Share BitChat with nearby people"
├── [Enable Sharing] button
├── Instructions:
│   1. Turn on WiFi Hotspot
│   2. Share this QR code
│   3. Others connect & scan
├── QR Code displaying: http://192.168.43.1:8080
└── Connected users counter
```

---

## App Store Links (All Countries)

### iOS App Store

```javascript
const APP_STORE_LINKS = {
  // Main link (auto-redirects based on user's store)
  universal: "https://apps.apple.com/app/bitchat-mesh/id6748219622",

  // Country-specific (for VPN users)
  us: "https://apps.apple.com/us/app/bitchat-mesh/id6748219622",
  gb: "https://apps.apple.com/gb/app/bitchat-mesh/id6748219622",
  de: "https://apps.apple.com/de/app/bitchat-mesh/id6748219622",
  fr: "https://apps.apple.com/fr/app/bitchat-mesh/id6748219622",
  ca: "https://apps.apple.com/ca/app/bitchat-mesh/id6748219622",
  au: "https://apps.apple.com/au/app/bitchat-mesh/id6748219622",
  jp: "https://apps.apple.com/jp/app/bitchat-mesh/id6748219622",
  kr: "https://apps.apple.com/kr/app/bitchat-mesh/id6748219622",
  cn: "https://apps.apple.com/cn/app/bitchat-mesh/id6748219622",
  tw: "https://apps.apple.com/tw/app/bitchat-mesh/id6748219622",
  hk: "https://apps.apple.com/hk/app/bitchat-mesh/id6748219622",
  sg: "https://apps.apple.com/sg/app/bitchat-mesh/id6748219622",
  in: "https://apps.apple.com/in/app/bitchat-mesh/id6748219622",
  br: "https://apps.apple.com/br/app/bitchat-mesh/id6748219622",
  mx: "https://apps.apple.com/mx/app/bitchat-mesh/id6748219622",
  es: "https://apps.apple.com/es/app/bitchat-mesh/id6748219622",
  it: "https://apps.apple.com/it/app/bitchat-mesh/id6748219622",
  nl: "https://apps.apple.com/nl/app/bitchat-mesh/id6748219622",
  se: "https://apps.apple.com/se/app/bitchat-mesh/id6748219622",
  no: "https://apps.apple.com/no/app/bitchat-mesh/id6748219622",
  dk: "https://apps.apple.com/dk/app/bitchat-mesh/id6748219622",
  fi: "https://apps.apple.com/fi/app/bitchat-mesh/id6748219622",
  pl: "https://apps.apple.com/pl/app/bitchat-mesh/id6748219622",
  tr: "https://apps.apple.com/tr/app/bitchat-mesh/id6748219622",
  ru: "https://apps.apple.com/ru/app/bitchat-mesh/id6748219622",
  ua: "https://apps.apple.com/ua/app/bitchat-mesh/id6748219622",
  il: "https://apps.apple.com/il/app/bitchat-mesh/id6748219622",
  ae: "https://apps.apple.com/ae/app/bitchat-mesh/id6748219622",
  sa: "https://apps.apple.com/sa/app/bitchat-mesh/id6748219622",
  za: "https://apps.apple.com/za/app/bitchat-mesh/id6748219622",
  ng: "https://apps.apple.com/ng/app/bitchat-mesh/id6748219622",
  eg: "https://apps.apple.com/eg/app/bitchat-mesh/id6748219622",
  pk: "https://apps.apple.com/pk/app/bitchat-mesh/id6748219622",
  id: "https://apps.apple.com/id/app/bitchat-mesh/id6748219622",
  my: "https://apps.apple.com/my/app/bitchat-mesh/id6748219622",
  th: "https://apps.apple.com/th/app/bitchat-mesh/id6748219622",
  vn: "https://apps.apple.com/vn/app/bitchat-mesh/id6748219622",
  ph: "https://apps.apple.com/ph/app/bitchat-mesh/id6748219622",
  nz: "https://apps.apple.com/nz/app/bitchat-mesh/id6748219622",
  ar: "https://apps.apple.com/ar/app/bitchat-mesh/id6748219622",
  cl: "https://apps.apple.com/cl/app/bitchat-mesh/id6748219622",
  co: "https://apps.apple.com/co/app/bitchat-mesh/id6748219622",
  pe: "https://apps.apple.com/pe/app/bitchat-mesh/id6748219622",
  at: "https://apps.apple.com/at/app/bitchat-mesh/id6748219622",
  ch: "https://apps.apple.com/ch/app/bitchat-mesh/id6748219622",
  be: "https://apps.apple.com/be/app/bitchat-mesh/id6748219622",
  pt: "https://apps.apple.com/pt/app/bitchat-mesh/id6748219622",
  gr: "https://apps.apple.com/gr/app/bitchat-mesh/id6748219622",
  cz: "https://apps.apple.com/cz/app/bitchat-mesh/id6748219622",
  ro: "https://apps.apple.com/ro/app/bitchat-mesh/id6748219622",
  hu: "https://apps.apple.com/hu/app/bitchat-mesh/id6748219622",
  ie: "https://apps.apple.com/ie/app/bitchat-mesh/id6748219622",
};
```

### Google Play Store

```javascript
const PLAY_STORE_LINKS = {
  // Main link
  universal: "https://play.google.com/store/apps/details?id=com.bitchat.droid",

  // Direct APK (for regions where Play is blocked)
  apk: "https://github.com/permissionlesstech/bitchat-android/releases/latest",

  // F-Droid (future)
  fdroid: "https://f-droid.org/packages/com.bitchat.droid/",
};
```

---

## Key Import Feature

### UI Flow

```
Settings → Identity → Import Existing Key
├── "Use your existing Nostr identity"
├── Warning: "This will replace your current identity"
├── Input field: "Enter your nsec or hex private key"
├── [Import] button
├── Validation feedback
└── Success: "Identity imported! You are now @yourname"
```

### Implementation

```typescript
// src/services/identity/import.ts
import { nip19 } from 'nostr-tools';

export async function importNostrKey(input: string): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  let privateKeyHex: string;

  // Handle nsec format
  if (input.startsWith('nsec')) {
    const decoded = nip19.decode(input);
    if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
    privateKeyHex = decoded.data;
  }
  // Handle hex format
  else if (/^[0-9a-f]{64}$/i.test(input)) {
    privateKeyHex = input.toLowerCase();
  }
  else {
    throw new Error('Invalid key format');
  }

  // Derive public key and return
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = getPublicKey(privateKey);

  return { publicKey, privateKey };
}
```

---

## Relay List (Same as Native)

From BitChat iOS/Android `relays/` folder - use the exact same list.

---

## Wave Execution Plan

### Wave 1: Foundation (10 Agents)

| # | Agent | Creates | Depends On |
|---|-------|---------|------------|
| 1.1 | Project Scaffold | Vite + Preact + TS project structure | - |
| 1.2 | TypeScript Config | tsconfig, eslint, prettier | 1.1 |
| 1.3 | Tailwind Theme | Terminal color palette, fonts | 1.1 |
| 1.4 | Test Infrastructure | Vitest, Playwright setup | 1.1 |
| 1.5 | Storage Layer | OPFS + IndexedDB abstraction | 1.1 |
| 1.6 | Crypto Foundation | libsodium init, key utils | 1.1 |
| 1.7 | Nostr Client Base | nostr-tools, relay pool | 1.1 |
| 1.8 | Service Worker | Workbox, cache strategies | 1.1 |
| 1.9 | State Management | Zustand stores | 1.1 |
| 1.10 | CI/CD Skeleton | GitHub Actions workflows | 1.1 |

### Wave 2: Core Services (10 Agents)

| # | Agent | Creates | Depends On |
|---|-------|---------|------------|
| 2.1 | Identity Service | Key gen, storage, fingerprints | 1.5, 1.6 |
| 2.2 | Noise Protocol | XX handshake, sessions | 1.6 |
| 2.3 | Nostr Events | Event creation, signing | 1.7, 2.1 |
| 2.4 | NIP-17 DMs | Gift wrap, seal, encryption | 2.3 |
| 2.5 | Location Channels | Geohash, channel names | 2.3 |
| 2.6 | SQLite Schema | Tables, migrations | 1.5 |
| 2.7 | Data Models | Message, Channel, Peer types | - |
| 2.8 | Offline Queue | Queue, retry, sync | 1.5, 2.3 |
| 2.9 | Relay Manager | Health, failover, pool | 1.7 |
| 2.10 | WebRTC Setup | Trystero, data channels | 1.7 |

### Wave 3: Features & UI (10 Agents)

| # | Agent | Creates | Depends On |
|---|-------|---------|------------|
| 3.1 | App Shell | Layout, sidebar, main view | 1.3 |
| 3.2 | Chat Interface | Messages, input, scroll | 3.1, 2.7 |
| 3.3 | Channel UI | List, switching, headers | 3.1, 2.5 |
| 3.4 | Peer UI | List, details, actions | 3.1, 2.7 |
| 3.5 | Command System | Parser, processor, autocomplete | 3.2 |
| 3.6 | Settings View | All settings, key import | 3.1, 2.1 |
| 3.7 | Onboarding | Wizard, nickname, permissions | 3.1, 2.1 |
| 3.8 | Notifications | Toasts, modals, UI primitives | 3.1 |
| 3.9 | Emergency Wipe | Triple-tap, confirmation | 3.1, 1.5 |
| 3.10 | Message Format | @mentions, links, actions | 3.2 |

### Wave 4: Special Features (10 Agents)

| # | Agent | Creates | Depends On |
|---|-------|---------|------------|
| 4.1 | P2P Sharing | Local server, QR code | 1.8, 3.1 |
| 4.2 | Key Import | nsec import, validation | 2.1, 3.6 |
| 4.3 | App Store Links | All countries, UI | 3.6 |
| 4.4 | PWA Manifest | Icons, splash, meta tags | 1.8 |
| 4.5 | Auto-Update | Version check, update UI | 1.8 |
| 4.6 | Unit Tests Crypto | All crypto tests | 2.1, 2.2 |
| 4.7 | Unit Tests Nostr | All Nostr tests | 2.3, 2.4 |
| 4.8 | Unit Tests Storage | All storage tests | 1.5, 2.6 |
| 4.9 | E2E Tests Core | Main user flows | All Wave 3 |
| 4.10 | E2E Tests Edge | Offline, errors | All Wave 3 |

### Wave 5: Polish & Deploy (10 Agents)

| # | Agent | Creates | Depends On |
|---|-------|---------|------------|
| 5.1 | Protocol Compat | Test vectors from native | 2.3, 2.4 |
| 5.2 | Performance | Bundle size, lazy load | All |
| 5.3 | Accessibility | A11y, keyboard nav | All UI |
| 5.4 | Error Handling | Boundaries, recovery | All |
| 5.5 | Security Audit | CSP, XSS, storage | All |
| 5.6 | IPFS Deploy | Build, pin, verify | All |
| 5.7 | Documentation | CLAUDE.md, README, docs | All |
| 5.8 | Interop Testing | Test with iOS/Android | 5.1 |
| 5.9 | Final QA | Full test suite green | All |
| 5.10 | Go Live | Deploy, ENS hash, verify | All |

---

## File Structure

```
bitchat-in-browser/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── test.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── COMPATIBILITY.md
├── e2e/
│   ├── core/
│   ├── edge-cases/
│   └── interop/
├── public/
│   ├── icons/
│   ├── splash/
│   └── manifest.json
├── scripts/
│   ├── deploy-ipfs.ts
│   ├── update-ens.ts
│   └── generate-icons.ts
├── src/
│   ├── components/
│   │   ├── chat/
│   │   ├── channels/
│   │   ├── layout/
│   │   ├── onboarding/
│   │   ├── peers/
│   │   ├── settings/
│   │   ├── sharing/
│   │   └── ui/
│   ├── hooks/
│   ├── services/
│   │   ├── commands/
│   │   ├── crypto/
│   │   │   └── noise/
│   │   ├── identity/
│   │   ├── location/
│   │   ├── nostr/
│   │   │   ├── events/
│   │   │   ├── nip17/
│   │   │   └── relays/
│   │   ├── sharing/
│   │   ├── storage/
│   │   │   └── schema/
│   │   ├── sync/
│   │   ├── updates/
│   │   └── webrtc/
│   ├── stores/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── workers/
│   │   └── sw.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
├── BUILD_PLAN.md
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## Success Criteria

### Must Have (Launch Blockers)
- [ ] PWA loads at bitbrowse.eth.limo
- [ ] Works offline after first load
- [ ] Can send/receive messages in location channels
- [ ] Messages visible to iOS/Android users in same channel
- [ ] NIP-17 DMs work cross-platform
- [ ] Emergency wipe works
- [ ] Add to Home Screen works (iOS + Android)
- [ ] All tests pass
- [ ] Bundle size < 500KB initial

### Should Have
- [ ] P2P app sharing via WiFi
- [ ] Key import (nsec)
- [ ] All country app store links
- [ ] WebRTC P2P messaging
- [ ] Command autocomplete

### Nice to Have
- [ ] Push notifications
- [ ] Animated transitions
- [ ] Dark/light theme toggle

---

## Deployment Checklist

### IPFS Setup
1. Create Pinata account (free tier: 1GB)
2. Create web3.storage account (free tier: 5GB)
3. Get API keys
4. Add to GitHub Secrets:
   - `PINATA_JWT`
   - `WEB3_STORAGE_TOKEN`

### ENS Setup
1. Access wallet with bitbrowse.eth
2. After build, receive content hash from deployment
3. Update ENS contenthash via ENS Manager app
4. Verify at bitbrowse.eth.limo

### Final Verification
1. Open in Safari iOS
2. Open in Chrome Android
3. Open in Desktop Chrome/Firefox/Safari
4. Test Add to Home Screen
5. Test offline mode
6. Test message send/receive
7. Verify iOS/Android interop

---

## Agent Instructions

Each agent should:
1. Read this BUILD_PLAN.md first
2. Check their specific task assignment
3. Create all required files
4. Write tests for their code
5. Ensure TypeScript compiles without errors
6. Follow the established patterns from earlier agents

When in doubt:
- Match BitChat native app behavior
- Prioritize offline functionality
- Keep bundle size minimal
- Write defensive code with error handling
