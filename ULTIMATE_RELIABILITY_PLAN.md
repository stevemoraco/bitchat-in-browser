# BitChat Ultimate Reliability & Deployment Plan

## Overview

This document defines the complete plan for transforming BitChat In Browser into the most reliable decentralized application ever deployed. Every agent executing tasks from this plan must follow these principles rigorously.

---

## CRITICAL PRINCIPLES FOR ALL AGENTS

### 1. NO SHORTCUTS
- **DO NOT** write tests that simply pass without testing real functionality
- **DO NOT** mock away the thing you're supposed to test
- **DO NOT** use `skip`, `todo`, or placeholder tests
- **DO NOT** lower thresholds to make tests pass
- Every test must verify actual production behavior

### 2. PRODUCTION READY
- All code must be production-quality
- All error handling must be complete
- All edge cases must be considered
- All security implications must be addressed
- No `console.log` debugging left in code
- No `any` types unless absolutely necessary
- No disabled linting rules

### 3. REAL VERIFICATION
- Tests must fail when functionality is broken
- Tests must pass only when functionality works correctly
- Integration tests must use real services where possible
- E2E tests must simulate real user behavior
- Security tests must catch real vulnerabilities

### 4. TOKEN ESTIMATES ARE ROUGH GUIDANCE ONLY
- Token estimates in this plan are approximate
- Do not rush to fit within estimates
- Quality and correctness are the only metrics that matter
- Take whatever tokens are needed to do the job right

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BITCHAT ULTIMATE RELIABILITY STACK                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LAYER 7: USER DEVICE (Effective 100% Availability)                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Service Worker + IndexedDB + P2P Distribution                      │ │
│  │  → App works forever offline after first load                       │ │
│  │  → Users serve app to each other via QR/WebRTC                      │ │
│  │  → Messages queue offline, sync automatically                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 6: CONTENT DELIVERY (99.99%+ for new users)                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ENS: bitbrowse.eth → IPFS CID                                      │ │
│  │  Gateways: eth.limo → eth.link → dweb.link → ipfs.io → P2P         │ │
│  │  Client-side failover with automatic retry                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 5: IPFS PINNING (5x redundancy)                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Pinata + web3.storage + Filebase + Fleek + Self-hosted cluster    │ │
│  │  All providers must confirm pin before ENS update                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 4: CI/CD (Zero-trust, cryptographically verified)                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  GitHub Actions → Build → Test → Pin → Verify → ENS Update         │ │
│  │  100% E2E coverage gate, deterministic CIDs, atomic deploys        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 3: TESTING (100% critical path coverage)                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Unit tests + Integration tests + E2E tests + Security audits      │ │
│  │  Cross-platform compatibility (iOS/Android protocol parity)        │ │
│  │  Visual regression + Performance benchmarks + Chaos testing        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 2: PRIVACY-PRESERVING TELEMETRY (Zero user tracking)            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Client-side rollout selection (server never knows who)            │ │
│  │  Aggregate-only health signals with differential privacy           │ │
│  │  No IPs, no fingerprints, no identifiers ever                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LAYER 1: MONITORING (Proactive, not reactive)                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Synthetic canaries, gateway health checks, CID verification       │ │
│  │  Automated rollback on anomaly detection                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Wave 1: Build Fix & Stabilization

**Goal:** Fix all TypeScript errors and ensure clean production build.

**Token Estimate:** ~50K in, ~25K out (ROUGH GUIDANCE ONLY)

### Agent 1.1: TypeScript Error Resolution

**Priority:** CRITICAL - Blocks all other work

**Files to Examine and Fix:**
- `src/services/mesh/app-transfer.ts` - Known errors at lines 72-73
- Any other files with TypeScript errors

**Tasks:**
1. Run `npm run typecheck` and capture ALL errors
2. Fix each error properly (not by adding `any` or `@ts-ignore`)
3. Ensure fixes maintain type safety
4. Verify no new errors introduced

**Verification:**
```bash
npm run typecheck  # Must exit with code 0
npm run lint       # Must exit with code 0
```

### Agent 1.2: Build Verification

**Priority:** CRITICAL

**Tasks:**
1. Run `npm run build` and verify success
2. Verify `dist/` directory contains all expected files
3. Verify service worker is generated correctly
4. Verify bundle size is under 500KB
5. Test production build locally with `npm run preview`

**Verification:**
```bash
npm run build      # Must exit with code 0
ls -la dist/       # Must contain index.html, assets/, sw.js
```

---

## Wave 2: iOS/Android Protocol Compatibility

**Goal:** Ensure 100% interoperability with native BitChat apps.

**Token Estimate:** ~200K in, ~100K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 1 must complete first

### Agent 2.1: BitchatMessage Binary Protocol

**Files to Create:**
- `src/services/compat/bitchat-message.ts`
- `src/services/compat/__tests__/bitchat-message.test.ts`

**Requirements:**

The BitchatMessage binary format MUST match iOS/Android exactly:

```
Byte Layout:
- Flags:           1 byte (bit flags for optional fields)
- Timestamp:       8 bytes (milliseconds since epoch, BIG-ENDIAN)
- ID length:       1 byte
- ID:              variable (max 255 bytes, UTF-8)
- Sender length:   1 byte
- Sender:          variable (max 255 bytes, UTF-8)
- Content length:  2 bytes (BIG-ENDIAN)
- Content:         variable (max 65535 bytes, UTF-8)
- Optional fields: based on flags
```

**Flag Bits:**
- 0x01: relay flag
- 0x02: private message
- 0x04: has original sender
- 0x08: has recipient
- 0x10: has peer ID
- 0x20: has mentions
- 0x40: has channel
- 0x80: encrypted

**Test Requirements:**
- Test ALL 256 flag combinations
- Test boundary conditions (0, 1, max for each field)
- Test UTF-8 encoding with special characters
- Test round-trip: encode → decode → encode = same bytes
- Verify byte order is big-endian on multi-byte fields

### Agent 2.2: Nostr Event Compatibility

**Files to Create:**
- `src/services/compat/nostr-events.ts`
- `src/services/compat/__tests__/nostr-events.test.ts`

**Requirements:**

Event ID calculation MUST be deterministic:
```
id = SHA256(JSON.stringify([
  0,                    // Reserved
  pubkey,               // 32-byte hex
  created_at,           // Unix timestamp (seconds)
  kind,                 // Integer
  tags,                 // Array of arrays
  content               // String
]))
```

**JSON Serialization Rules:**
- NO spaces after colons or commas
- NO HTML escaping (< > & must NOT become entities)
- Keys in objects NOT sorted (arrays maintain order)
- Numbers as integers, not floats

**Supported Event Kinds:**
- 0: metadata
- 1: text_note (persistent channel messages)
- 13: seal (NIP-17)
- 14: dm rumor (NIP-17)
- 1059: gift_wrap (NIP-59)
- 20000: ephemeral_event (geohash channels)

**Test Requirements:**
- Verify event ID matches iOS/Android for same input
- Test Schnorr signature (BIP-340) verification
- Test with actual events from iOS/Android apps
- Test malformed event rejection

### Agent 2.3: NIP-17/NIP-44 Encryption Parity

**Files to Create:**
- `src/services/compat/nip44-compat.ts`
- `src/services/compat/__tests__/nip44-compat.test.ts`

**Requirements:**

NIP-44 v2 Encryption:
```
1. ECDH: shared_secret = sender_private * recipient_public (secp256k1)
2. Key derivation: HKDF-SHA256(shared_secret, salt="", info="nip44-v2", len=32)
3. Nonce: 24 random bytes
4. Encrypt: XChaCha20-Poly1305(plaintext, key, nonce)
5. Output: "v2:" + base64url(nonce || ciphertext || tag)
```

**X-Only Public Key Handling:**
- 32-byte pubkeys are x-only (no Y coordinate)
- Must try BOTH even-Y (0x02 prefix) and odd-Y (0x03 prefix)
- One will produce valid shared secret, other won't

**NIP-17 Gift Wrap Flow:**
```
1. Create Rumor: kind=14, unsigned, has ["p", recipient] tag
2. Create Seal: kind=13, encrypt rumor with ephemeral key, randomize timestamp ±15min
3. Create Gift Wrap: kind=1059, encrypt seal with new ephemeral key
```

**Test Requirements:**
- Encrypt with web, decrypt with iOS test vector
- Decrypt iOS-generated ciphertext with web
- Verify timestamp randomization in seals
- Test both Y-parity recovery paths

### Agent 2.4: Geohash Encoding Parity

**Files to Create:**
- `src/services/compat/geohash.ts`
- `src/services/compat/__tests__/geohash.test.ts`

**Requirements:**

Base32 Alphabet: `0123456789bcdefghjkmnpqrstuvwxyz`
- Note: NO 'a', 'i', 'l', 'o' (avoid confusion with numbers)

Precision: 8 characters = ~19m x 18m cell

**Functions Required:**
```typescript
encode(lat: number, lon: number, precision: number): string
decode(geohash: string): { lat: number; lon: number }
decodeBounds(geohash: string): { minLat, maxLat, minLon, maxLon }
neighbors(geohash: string): string[] // 8 neighbors
```

**Test Requirements:**
- Known test vectors: San Francisco "9q8yyk8y", NYC "dr5regw3"
- Edge cases: North/South poles, date line, equator
- Neighbor calculation at boundaries
- Round-trip: encode → decode → encode = same (within precision)

---

## Wave 3: Critical Security Tests

**Goal:** 100% test coverage on security-critical code paths.

**Token Estimate:** ~180K in, ~90K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 2 must complete first

### Agent 3.1: Encryption E2E Tests

**Files to Create:**
- `e2e/security/nip17-encryption.spec.ts`
- `e2e/security/key-derivation.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Full NIP-17 Round Trip:**
   - Create new identity with fresh keypair
   - Generate DM message content
   - Create rumor (kind 14)
   - Create seal with encryption
   - Create gift wrap with encryption
   - Unwrap gift wrap
   - Decrypt seal
   - Verify rumor content matches original
   - Verify signature chain is valid

2. **Cross-Platform Decryption:**
   - Use hardcoded iOS-generated gift wrap
   - Decrypt with web implementation
   - Verify content matches expected

3. **Key Derivation Verification:**
   - Generate keypair from known seed
   - Verify public key matches expected
   - Verify fingerprint matches expected
   - Verify derived addresses match

4. **Signature Verification:**
   - Verify valid signature passes
   - Verify tampered content fails
   - Verify wrong pubkey fails

### Agent 3.2: Key Management Tests

**Files to Create:**
- `src/services/crypto/__tests__/keys.test.ts`
- `src/services/identity/__tests__/import.test.ts`
- `e2e/security/key-import.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Key Generation:**
   - Verify entropy source is crypto.getRandomValues
   - Verify generated keys are valid secp256k1
   - Verify no two generated keys are the same (statistical test)

2. **nsec Import:**
   - Valid nsec imports correctly
   - Invalid checksum rejected
   - Wrong prefix rejected
   - Too short/long rejected
   - Non-bech32 characters rejected

3. **Key Material Security:**
   - Private key never appears in logs
   - Private key never in error messages
   - Private key never in localStorage as plaintext
   - Memory cleared after use (where possible)

### Agent 3.3: Storage Security Tests

**Files to Create:**
- `src/services/storage/__tests__/security.test.ts`
- `e2e/security/storage-isolation.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Encryption at Rest:**
   - Verify OPFS data is encrypted
   - Verify IndexedDB data is encrypted
   - Verify encryption key is derived from user secret

2. **Isolation:**
   - Different origins cannot access each other's data
   - Incognito mode starts fresh
   - Data cleared on emergency wipe

---

## Wave 4: Integration Tests

**Goal:** Test all external service integrations.

**Token Estimate:** ~240K in, ~120K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 3 must complete first

### Agent 4.1: Nostr Relay Integration

**Files to Create:**
- `e2e/integration/nostr-client.spec.ts`
- `src/services/nostr/__tests__/relay-pool.test.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Connection Management:**
   - Connect to multiple relays simultaneously
   - Handle relay disconnection gracefully
   - Reconnect with exponential backoff
   - Maintain subscriptions across reconnects

2. **Event Publishing:**
   - Publish event to all connected relays
   - Handle partial relay failures
   - Queue events when offline
   - Retry queued events on reconnect

3. **Event Subscription:**
   - Subscribe with filters (kinds, authors, tags)
   - Receive matching events
   - Handle EOSE correctly
   - Unsubscribe cleans up

### Agent 4.2: WebRTC Mesh Integration

**Files to Create:**
- `e2e/integration/webrtc-mesh.spec.ts`
- `src/services/mesh/__tests__/peer-connection.test.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Peer Discovery:**
   - Discover peers via Nostr signaling
   - Discover peers via cached peer list
   - Handle no peers found gracefully

2. **Connection Establishment:**
   - Create offer with ICE candidates
   - Accept offer and create answer
   - Complete ICE negotiation
   - Establish data channel

3. **Data Transfer:**
   - Send message over data channel
   - Receive message over data channel
   - Handle large messages (chunking)
   - Handle connection loss mid-transfer

### Agent 4.3: Storage Backend Integration

**Files to Create:**
- `e2e/integration/storage-backends.spec.ts`
- `src/services/storage/__tests__/fallback.test.ts`

**Test Scenarios (ALL REQUIRED):**

1. **OPFS Primary:**
   - Detect OPFS availability
   - Store and retrieve data
   - Handle quota limits
   - Persist across page reloads

2. **IndexedDB Fallback:**
   - Detect when OPFS unavailable
   - Automatically fall back to IndexedDB
   - Same API works for both backends
   - Data integrity maintained

3. **Migration:**
   - Migrate from old storage format
   - Handle partial migration failure
   - Verify data integrity after migration

### Agent 4.4: Service Worker Integration

**Files to Create:**
- `e2e/integration/service-worker.spec.ts`
- `src/workers/__tests__/sw-lifecycle.test.ts`

**Test Scenarios (ALL REQUIRED):**

1. **Registration:**
   - SW registers on first visit
   - SW activates correctly
   - SW claims all clients

2. **Caching:**
   - All app assets cached
   - Cache-first serving works
   - Cache updates in background

3. **Offline:**
   - App loads when offline
   - Offline queue works
   - Background sync triggers on reconnect

---

## Wave 5: Component Unit Tests

**Goal:** Unit test coverage for all UI components.

**Token Estimate:** ~300K in, ~150K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 1 (can run parallel with Waves 2-4)

### Agent 5.1: Chat Components

**Files to Create:**
- `src/components/chat/__tests__/MessageBubble.test.tsx`
- `src/components/chat/__tests__/MessageInput.test.tsx`
- `src/components/chat/__tests__/ChatView.test.tsx`
- `src/components/chat/__tests__/IRCMessage.test.tsx`
- `src/components/chat/__tests__/VoiceMessage.test.tsx`
- `src/components/chat/__tests__/ImageMessage.test.tsx`
- `src/components/chat/__tests__/PaymentChip.test.tsx`
- `src/components/chat/__tests__/VoiceRecorder.test.tsx`
- `src/components/chat/__tests__/AutocompletePopup.test.tsx`

**Test Requirements:**
- Render with various props combinations
- User interaction (clicks, keyboard)
- Accessibility (ARIA, keyboard navigation)
- Error states
- Loading states
- Empty states

### Agent 5.2: Layout Components

**Files to Create:**
- `src/components/layout/__tests__/Shell.test.tsx`
- `src/components/layout/__tests__/Header.test.tsx`
- `src/components/layout/__tests__/SheetRenderer.test.tsx`
- `src/components/layout/__tests__/MainLayout.test.tsx`
- `src/components/layout/__tests__/ChannelBadge.test.tsx`

**Test Requirements:**
- Responsive behavior
- Navigation state
- Sheet opening/closing
- Header interactions

### Agent 5.3: Channels & Peers Components

**Files to Create:**
- `src/components/channels/__tests__/ChannelList.test.tsx`
- `src/components/channels/__tests__/ChannelItem.test.tsx`
- `src/components/channels/__tests__/ChannelCreate.test.tsx`
- `src/components/peers/__tests__/PeerList.test.tsx`
- `src/components/peers/__tests__/PeerProfile.test.tsx`
- `src/components/peers/__tests__/PeerActions.test.tsx`

**Test Requirements:**
- List rendering with various data
- Selection behavior
- Empty states
- Error handling

### Agent 5.4: Settings & Onboarding Components

**Files to Create:**
- `src/components/settings/__tests__/SettingsPanel.test.tsx`
- `src/components/settings/__tests__/SettingsItem.test.tsx`
- `src/components/onboarding/__tests__/OnboardingFlow.test.tsx`
- `src/components/onboarding/__tests__/IdentityCreation.test.tsx`
- `src/components/onboarding/__tests__/KeyImport.test.tsx`
- `src/components/onboarding/__tests__/WelcomeScreen.test.tsx`

**Test Requirements:**
- Multi-step flow navigation
- Form validation
- State persistence
- Error recovery

---

## Wave 6: Hook & Service Tests

**Goal:** 100% coverage for hooks and remaining services.

**Token Estimate:** ~180K in, ~90K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 1 (can run parallel with Waves 2-5)

### Agent 6.1: Custom Hooks Tests

**Files to Create:**
- `src/hooks/__tests__/useApp.test.ts`
- `src/hooks/__tests__/useNavigation.test.ts`
- `src/hooks/__tests__/useServiceWorker.test.ts`
- `src/hooks/__tests__/useEmergencyWipe.test.ts`
- `src/hooks/__tests__/useKeyboardHeight.test.ts`
- `src/hooks/__tests__/useTouchGestures.test.ts`
- `src/hooks/__tests__/useNotifications.test.ts`
- `src/hooks/__tests__/useMediaQuery.test.ts`

**Test Requirements:**
- Hook behavior in isolation
- State changes
- Side effects
- Cleanup on unmount
- Error handling

### Agent 6.2: Payment & Media Services

**Files to Create:**
- `src/services/payments/__tests__/lightning.test.ts`
- `src/services/media/__tests__/voice-recorder.test.ts`
- `src/services/media/__tests__/image-handler.test.ts`

**Test Requirements:**
- BOLT11 invoice parsing (valid and invalid)
- Amount extraction
- WebLN detection
- Voice recording lifecycle
- Image compression
- Blur generation

### Agent 6.3: Remaining Services

**Files to Create:**
- `src/services/notifications/__tests__/index.test.ts`
- `src/services/sharing/__tests__/local-server.test.ts`
- `src/services/updates/__tests__/checker.test.ts`
- `src/services/errors/__tests__/handler.test.ts`
- `src/services/geo/__tests__/location.test.ts`

**Test Requirements:**
- Service initialization
- Error handling
- Edge cases
- Cleanup

---

## Wave 7: Advanced E2E Scenarios

**Goal:** Complex multi-device and edge case testing.

**Token Estimate:** ~280K in, ~140K out (ROUGH GUIDANCE ONLY)

**Dependency:** Waves 3-4 must complete first

### Agent 7.1: Multi-Device Messaging

**Files to Create:**
- `e2e/scenarios/multi-device-messaging.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. Two browser contexts (simulating two devices)
2. Each with separate identity
3. Send encrypted DM from A to B
4. Verify B receives and decrypts
5. Send reply from B to A
6. Verify A receives and decrypts
7. Verify message ordering correct
8. Test with 10+ rapid messages

### Agent 7.2: Offline Resilience

**Files to Create:**
- `e2e/scenarios/offline-resilience.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. Load app, go offline
2. Send 10 messages while offline
3. Verify all queued in storage
4. Go online with throttled connection
5. Verify messages sent in order
6. Verify no duplicates
7. Verify no data loss
8. Test queue with 100+ messages

### Agent 7.3: Emergency Wipe

**Files to Create:**
- `e2e/scenarios/emergency-wipe.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. Create identity, send messages, join channels
2. Verify data exists in all storage locations
3. Trigger emergency wipe (triple-tap)
4. Verify confirmation dialog
5. Complete wipe
6. Verify ALL data cleared:
   - IndexedDB empty
   - OPFS cleared
   - LocalStorage cleared
   - SessionStorage cleared
   - SW cache cleared
7. Verify app shows onboarding
8. Verify no way to recover data

### Agent 7.4: Cross-Platform Protocol

**Files to Create:**
- `e2e/scenarios/cross-platform.spec.ts`

**Test Scenarios (ALL REQUIRED):**

1. Generate Nostr event, verify matches iOS format
2. Parse Android-generated event
3. Create NIP-17 gift wrap, verify iOS can decrypt
4. Subscribe to geohash channel, verify format matches
5. Test relay subscription filters match native apps

---

## Wave 8: Privacy-Preserving Rollout System

**Goal:** Implement staged rollouts with zero user tracking.

**Token Estimate:** ~180K in, ~90K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 1

### Agent 8.1: Client-Side Rollout Selection

**Files to Create:**
- `src/services/rollout/client-selector.ts`
- `src/services/rollout/__tests__/client-selector.test.ts`

**Implementation:**
```typescript
/**
 * Determines if this client should use a feature based on rollout percentage.
 *
 * PRIVACY GUARANTEE: The server NEVER knows which bucket a client is in.
 * The local seed is generated on first run and never transmitted.
 */
export function shouldEnableFeature(featureId: string, percentage: number): boolean {
  const localSeed = getOrCreateLocalSeed();
  const hash = sha256(localSeed + featureId);
  const bucket = parseInt(hash.substring(0, 8), 16) % 10000;
  return bucket < (percentage * 100);
}

function getOrCreateLocalSeed(): string {
  const key = 'bitchat_rollout_seed';
  let seed = localStorage.getItem(key);
  if (!seed) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    seed = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, seed);
  }
  return seed;
}
```

**Test Requirements:**
- Same seed + feature = same result (deterministic)
- Different seeds = different results (distributed)
- Distribution is uniform across buckets
- Seed never appears in network requests

### Agent 8.2: Version Manifest System

**Files to Create:**
- `src/services/rollout/version-manifest.ts`
- `src/services/rollout/manifest-fetcher.ts`
- `src/services/rollout/__tests__/version-manifest.test.ts`

**Implementation:**
```typescript
interface VersionManifest {
  versions: VersionEntry[];
  timestamp: number;
  signature: string;
}

interface VersionEntry {
  cid: string;
  percentage: number;
  minVersion?: string;
  features?: string[];
}
```

**Flow:**
1. Fetch manifest from known IPFS CID
2. Verify signature against known public key
3. Client selects version based on local seed
4. Load app from selected CID

### Agent 8.3: Aggregate Health Signals

**Files to Create:**
- `src/services/rollout/health-reporter.ts`
- `src/services/rollout/__tests__/health-reporter.test.ts`

**Implementation:**
- Metrics stored locally only
- Optional aggregate reporting with differential privacy
- k-anonymity enforcement (min group size 100)
- No individual data ever transmitted

---

## Wave 9: CI/CD Pipeline

**Goal:** Automated build, test, deploy pipeline.

**Token Estimate:** ~240K in, ~120K out (ROUGH GUIDANCE ONLY)

**Dependency:** Waves 1-7 must complete first

### Agent 9.1: GitHub Actions Workflow - CI

**Files to Create:**
- `.github/workflows/ci.yml`

**Workflow:**
```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:security
      - run: npm audit --audit-level=high

  build:
    needs: [lint, typecheck, unit-tests, e2e-tests, security-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

### Agent 9.2: GitHub Actions Workflow - Deploy

**Files to Create:**
- `.github/workflows/deploy.yml`

**Workflow:**
```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      skip_ens:
        description: 'Skip ENS update'
        type: boolean
        default: false

jobs:
  deploy-ipfs:
    runs-on: ubuntu-latest
    environment: production
    outputs:
      cid: ${{ steps.pin.outputs.cid }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build

      # Pin to Pinata
      - name: Pin to Pinata
        id: pin
        env:
          PINATA_JWT: ${{ secrets.PINATA_JWT }}
        run: |
          CID=$(npx tsx scripts/deploy-ipfs.ts --pinata)
          echo "cid=$CID" >> $GITHUB_OUTPUT

      # Verify on multiple gateways
      - name: Verify deployment
        run: |
          for gateway in dweb.link ipfs.io cloudflare-ipfs.com; do
            curl --fail --retry 5 "https://$gateway/ipfs/${{ steps.pin.outputs.cid }}"
          done

  update-ens:
    needs: deploy-ipfs
    if: ${{ !inputs.skip_ens }}
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Update ENS
        env:
          ENS_PRIVATE_KEY: ${{ secrets.ENS_DEPLOYER_PRIVATE_KEY }}
          RPC_URL: ${{ secrets.ETHEREUM_RPC_URL }}
          CID: ${{ needs.deploy-ipfs.outputs.cid }}
        run: npx tsx scripts/update-ens.ts
```

### Agent 9.3: IPFS Multi-Provider Deployment Script

**Files to Create:**
- `scripts/deploy-multi-provider.ts`

**Implementation:**
- Pin to Pinata (primary)
- Pin to web3.storage (backup)
- Pin to Filebase (backup)
- Verify all return same CID
- Only proceed if 2+ providers succeed

### Agent 9.4: ENS Update Script

**Files to Create:**
- `scripts/update-ens.ts`
- `docs/DEPLOYMENT_WALLET_SETUP.md`

**Wallet Setup Documentation:**
1. Create new Ethereum wallet (hardware recommended)
2. Fund with 0.02 ETH (enough for ~20 updates)
3. Go to ENS app, set new wallet as Manager of bitbrowse.eth
4. Export private key, add to GitHub Secrets
5. NEVER use this wallet for anything else

**Script Implementation:**
- Read CID from environment
- Encode as IPFS contenthash
- Submit transaction to ENS resolver
- Wait for confirmation
- Verify update successful

---

## Wave 10: Monitoring & Alerting

**Goal:** Proactive monitoring with automatic rollback.

**Token Estimate:** ~180K in, ~90K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 9

### Agent 10.1: Gateway Health Monitoring

**Files to Create:**
- `scripts/monitor-gateways.ts`
- `.github/workflows/monitor.yml`

**Implementation:**
- Check eth.limo, eth.link, dweb.link, ipfs.io every 5 minutes
- Alert via GitHub Issues if <2 gateways responding
- Track availability history
- Generate weekly report

### Agent 10.2: Synthetic Canary Testing

**Files to Create:**
- `scripts/synthetic-canary.ts`
- `.github/workflows/canary.yml`

**Implementation:**
- Run headless browser test every 15 minutes
- Full user journey: load → identity → message
- Alert on any failure
- Track success rate over time

### Agent 10.3: Automatic Rollback System

**Files to Create:**
- `scripts/rollback.ts`
- `.github/workflows/rollback.yml`
- `deployment-history.json`

**Implementation:**
- Maintain last 10 CIDs
- Rollback triggers:
  - Canary failure >5%
  - Gateway availability <50%
  - Manual trigger
- Rollback = update ENS to previous CID

---

## Wave 11: Visual Regression & Performance

**Goal:** Catch UI regressions and performance degradation.

**Token Estimate:** ~180K in, ~90K out (ROUGH GUIDANCE ONLY)

**Dependency:** Wave 5

### Agent 11.1: Visual Regression Tests

**Files to Create:**
- `e2e/visual/screenshots.spec.ts`
- `e2e/visual/baseline/` (directory for baseline images)

**Test Requirements:**
- Screenshot all major views
- Compare against committed baselines
- Fail on >1% pixel difference
- Generate visual diff report

### Agent 11.2: Performance Benchmarks

**Files to Create:**
- `e2e/performance/benchmarks.spec.ts`
- `scripts/performance-report.ts`

**Metrics (with thresholds):**
- Time to First Byte: <500ms
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Bundle size: <500KB
- Memory usage: <50MB

### Agent 11.3: Lighthouse CI

**Files to Create:**
- `.github/workflows/lighthouse.yml`
- `lighthouserc.js`

**Thresholds:**
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- PWA: >95

---

## Wave 12: Chaos Engineering & Final Polish

**Goal:** Prove resilience under failure conditions.

**Token Estimate:** ~240K in, ~120K out (ROUGH GUIDANCE ONLY)

**Dependency:** Waves 1-11

### Agent 12.1: Chaos Testing Suite

**Files to Create:**
- `e2e/chaos/network-failures.spec.ts`
- `e2e/chaos/storage-corruption.spec.ts`
- `e2e/chaos/resource-exhaustion.spec.ts`

**Test Scenarios:**
1. Random network disconnection during send
2. Storage quota exhaustion
3. Service worker crash
4. All relays down
5. 2G network simulation
6. Memory pressure

### Agent 12.2: Coverage Enforcement

**Files to Create:**
- `scripts/coverage-gate.ts`
- Update `vitest.config.ts`

**Requirements:**
- Overall coverage >80%
- Critical paths 100%
- Block deploy if coverage drops

### Agent 12.3: Security Audit Automation

**Files to Create:**
- `.github/workflows/security-audit.yml`
- `scripts/security-scan.ts`

**Checks:**
- npm audit
- CodeQL analysis
- Secret scanning
- Dependency license check

### Agent 12.4: Documentation

**Files to Create:**
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/ARCHITECTURE.md` (update existing)

---

## Execution Order

```
Wave 1  ────────────────────────────────────────────────────────────────────►
          │
          ├──► Wave 2 ──► Wave 3 ──► Wave 4 ──► Wave 7 ──────────────────────►
          │                                              │
          ├──► Wave 5 ──────────────────────────────────►├──► Wave 11 ───────►
          │                                              │
          ├──► Wave 6 ──────────────────────────────────►│
          │                                              │
          └──► Wave 8 ──────────────────────────────────►├──► Wave 9 ────────►
                                                         │       │
                                                         │       └──► Wave 10 ►
                                                         │
                                                         └──► Wave 12 ────────►
```

---

## Success Criteria

Before deployment, ALL of the following must be true:

- [ ] `npm run build` exits with code 0
- [ ] `npm run typecheck` exits with code 0
- [ ] `npm run lint` exits with code 0
- [ ] `npm run test` passes with >80% coverage
- [ ] `npm run test:e2e` passes 100%
- [ ] `npm run test:security` passes 100%
- [ ] All critical paths have E2E coverage
- [ ] Cross-platform compatibility verified
- [ ] Visual regression tests pass
- [ ] Performance benchmarks met
- [ ] Lighthouse scores meet thresholds
- [ ] CI/CD pipeline fully operational
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures tested
- [ ] Documentation complete

---

## Availability Guarantees

| Scenario | Target | Mechanism |
|----------|--------|-----------|
| Returning user (offline) | 100% | Service worker cache-first |
| Returning user (online) | 100% | Cache + background update |
| New user (all gateways up) | 99.99% | 5x gateway redundancy |
| New user (partial outage) | 99.9% | Client-side failover |
| New user (total outage) | 99% | P2P app distribution |
| Message delivery | 99.99% | Nostr relay redundancy |
| Data durability | 99.999% | 5x IPFS pinning |

---

## Privacy Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No user identification | No IDs, no fingerprints |
| No IP tracking | No server-side logging |
| No version tracking | Client-side rollout selection |
| Aggregate-only metrics | Differential privacy |
| Forward secrecy | Ephemeral keys in NIP-17 |

---

**END OF PLAN**
