# BitChat In Browser - Final UI & Mesh Touchup Plan

## Executive Summary

This plan transforms BitChat In Browser into a **self-propagating, offline-first mesh network** that can spread through a disaster zone via QR codes alone, while matching the iOS app's UI pixel-for-pixel.

**Total: 7 Waves, 24 Agent Tasks**

---

## Pre-Existing Infrastructure (What We Have)

### Already Built:
- **TrysteroService** (`src/services/webrtc/trystero.ts`) - Full WebRTC P2P with Nostr relay signaling
- **LocalServerService** (`src/services/sharing/local-server.ts`) - IP detection, cache verification
- **Service Worker** (`src/workers/sw.ts`) - Workbox caching (needs fix)
- **223 TypeScript files** - Complete app with stores, services, components

### Key Finding - Service Worker Bug:
Lines 310-350 in `sw.ts` have a custom `fetch` handler that:
1. Tries network first for navigation
2. Falls back to cache only on network failure
3. **This conflicts with Workbox's NavigationRoute on line 184**
4. Result: App goes to network on every load instead of serving cached instantly

---

## Wave 1: Offline-First Fix (2 Agents)

**Goal:** App loads instantly from cache, works perfectly in airplane mode.

### Agent 1.1: Service Worker Cache-First Fix

**File:** `src/workers/sw.ts`

**Changes:**
1. **Remove conflicting fetch handler** (lines 310-350)
2. **Add proper setCatchHandler** for offline fallback:
```typescript
import { setCatchHandler } from 'workbox-routing';

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/index.html') || caches.match('/offline.html');
  }
  return Response.error();
});
```
3. **Change fonts from StaleWhileRevalidate to CacheFirst** (lines 277-301)
4. **Fix API route matching** - too broad, catches unintended requests

### Agent 1.2: IndexedDB App Storage System

**Files to Create:**
- `src/services/storage/app-bundle-store.ts`

**Purpose:** Store received app bundles for P2P distribution and SW serving.

```typescript
interface AppBundle {
  version: string;
  hash: string;
  timestamp: number;
  assets: Map<string, { content: Uint8Array; mimeType: string }>;
}

// Service Worker can read from this to serve app
// WebRTC can write to this when receiving updates
```

---

## Wave 2: Auto-Mesh Foundation (4 Agents)

**Goal:** App automatically forms mesh on launch without user action.

### Agent 2.1: Mesh Auto-Discovery Service

**Files to Create:**
- `src/services/mesh/auto-discovery.ts`
- `src/services/mesh/types.ts`

**Logic:**
```typescript
async function autoMesh() {
  // Parallel attempts - don't wait for failures
  const results = await Promise.allSettled([
    tryNostrRelays(),      // Internet available
    tryCachedPeers(),      // Previously known peers
    tryLocalNetwork(),     // mDNS on same WiFi
  ]);

  // Use first successful connection
  // Continue trying others in background
}
```

**On App Launch:**
1. Load from SW cache (instant)
2. Start autoMesh() in background
3. Show mesh status in header
4. No "Create Mesh" button - it's automatic

### Agent 2.2: Direct WebRTC Connection Manager

**Files to Create:**
- `src/services/mesh/direct-connection.ts`

**Purpose:** Manage direct WebRTC connections without Trystero signaling.

**Features:**
- Create offers/answers for QR code exchange
- Handle ICE candidate exchange
- Manage connection lifecycle
- Support multiple simultaneous peers

### Agent 2.3: Peer Introduction Protocol

**Files to Create:**
- `src/services/mesh/peer-introduction.ts`

**Purpose:** When A is connected to B and C, introduce B↔C.

**Protocol:**
```typescript
// Hub (A) receives connection from new peer (C)
// A has existing connections to [B, D, E]
// A sends to C: { type: 'peer-list', peers: [B, D, E] }
// A sends to B, D, E: { type: 'new-peer', offer: C's offer }
// B, D, E send answers back through A
// C receives answers, connects directly
// Full mesh formed
```

### Agent 2.4: Mesh State Store

**Files to Create:**
- `src/stores/mesh-store.ts`

**State:**
```typescript
interface MeshState {
  status: 'disconnected' | 'connecting' | 'connected';
  peers: MeshPeer[];
  localPeerId: string;
  isHub: boolean;
  connectionMethod: 'nostr' | 'direct' | 'hybrid';

  // Actions
  addPeer: (peer: MeshPeer) => void;
  removePeer: (peerId: string) => void;
  setStatus: (status: MeshStatus) => void;
}
```

---

## Wave 3: P2P App Distribution (3 Agents)

**Goal:** App updates spread through the mesh without internet.

### Agent 3.1: App Bundle Packaging

**Files to Create:**
- `src/services/mesh/app-packager.ts`

**Features:**
- Collect all cached assets from Service Worker
- Package into transferable format
- Generate hash for integrity verification
- Compress with gzip for transfer

**Bundle Format:**
```typescript
interface TransferableBundle {
  version: string;
  hash: string;
  totalSize: number;
  chunks: Array<{
    index: number;
    path: string;
    mimeType: string;
    data: string; // base64
  }>;
}
```

### Agent 3.2: Version Negotiation & Transfer

**Files to Create:**
- `src/services/mesh/app-transfer.ts`

**Protocol:**
```
1. On peer connect, exchange: { version, hash }
2. If peer has newer version:
   a. Request bundle: { type: 'request-bundle' }
   b. Receive chunks over data channel
   c. Verify hash matches
   d. Store in IndexedDB
   e. Notify SW to use new version
3. On next page load, SW serves from IndexedDB
```

### Agent 3.3: Service Worker IndexedDB Integration

**Files to Modify:**
- `src/workers/sw.ts`

**Add capability to serve from IndexedDB:**
```typescript
// Check IndexedDB for app bundle before cache
async function getFromStorage(request: Request): Promise<Response | null> {
  const db = await openDB('bitchat-app-bundle');
  const asset = await db.get('assets', request.url);
  if (asset) {
    return new Response(asset.content, {
      headers: { 'Content-Type': asset.mimeType }
    });
  }
  return null;
}
```

---

## Wave 4: QR Bootstrapper (2 Agents)

**Goal:** Someone with no app can scan a QR and join the mesh.

### Agent 4.1: Bootstrapper Generator

**Files to Create:**
- `src/services/mesh/bootstrapper-generator.ts`
- `src/components/mesh/QRCodeDisplay.tsx`

**Generate ~2KB bootstrapper that fits in QR:**
```html
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BitChat</title></head><body>
<div id="s">Connecting...</div>
<script>
// Minified WebRTC connection + app loader
// Embedded offer from hub
// On connect: receive app, store in localStorage, render
// On refresh: load from localStorage immediately
const O="OFFER_HERE";
(async()=>{
  // Check localStorage first
  const a=localStorage.getItem('bitchat');
  if(a){document.open();document.write(a);document.close();return}

  // Connect to hub
  const p=new RTCPeerConnection();
  const d=p.createDataChannel('b');
  let chunks=[];
  d.onmessage=e=>{
    if(e.data==='END'){
      const app=chunks.join('');
      localStorage.setItem('bitchat',app);
      localStorage.setItem('bitchat-v','VERSION');
      document.open();document.write(app);document.close();
    }else{chunks.push(e.data)}
  };
  await p.setRemoteDescription({type:'offer',sdp:atob(O)});
  const ans=await p.createAnswer();
  await p.setLocalDescription(ans);
  // Display answer for manual exchange or use embedded response
})();
</script></body></html>
```

### Agent 4.2: QR Handshake Flow

**Files to Create:**
- `src/services/mesh/qr-handshake.ts`
- `src/components/mesh/JoinMeshModal.tsx`

**Flow:**
1. Hub shows QR with data URL bootstrapper + embedded offer
2. Joiner scans, bootstrapper runs
3. Bootstrapper shows QR with answer (or uses embedded response channel)
4. Hub scans answer QR (or receives via response channel)
5. Connection established
6. Hub sends app bundle
7. Joiner has full app, persisted in localStorage

**Improvement - Two-Way QR:**
- QR contains offer + response instructions
- Joiner's device can show answer QR
- Hub can scan answer QR to complete handshake
- No typing needed - all visual

---

## Wave 5: iOS UI Parity - Navigation (3 Agents)

**Goal:** Replace page-based routing with iOS-style sheet modals.

### Agent 5.1: Sheet Component System

**Files to Create:**
- `src/components/ui/Sheet.tsx`
- `src/components/ui/SheetStack.tsx`

**Features:**
- Slide-up animation (iOS style)
- Half-sheet (50% height) and full-sheet modes
- Drag-to-dismiss gesture
- Stack multiple sheets
- Backdrop blur

### Agent 5.2: Navigation Store

**Files to Create:**
- `src/stores/navigation-store.ts`

**Replace React Router with sheet stack:**
```typescript
interface NavigationState {
  sheets: SheetConfig[];
  pushSheet: (config: SheetConfig) => void;
  popSheet: () => void;
  popToRoot: () => void;
  replaceSheet: (config: SheetConfig) => void;
}
```

### Agent 5.3: Convert Views to Sheets

**Files to Modify:**
- `src/components/channels/ChannelList.tsx` → half-sheet
- `src/components/settings/*` → full-sheet stack
- `src/components/peers/PeerList.tsx` → half-sheet
- `src/App.tsx` → remove router, add SheetStack

**Result:** Main chat view always visible, sheets overlay.

---

## Wave 6: iOS UI Parity - Messages & Header (4 Agents)

**Goal:** IRC-style messages, iOS-identical header.

### Agent 6.1: IRC Message Format

**Files to Modify:**
- `src/components/chat/MessageList.tsx`
- `src/components/chat/MessageItem.tsx`

**Format:**
```
[12:34] <alice> Hello everyone!
[12:35] <bob> Hey alice, what's up?
[12:35] * alice waves
[12:36] --> charlie has joined
```

**Styling:**
- Monospace font
- No bubbles, no avatars
- Timestamp in gray
- Sender nick in consistent color (hash-based)
- System messages in yellow

### Agent 6.2: Header Redesign

**Files to Modify:**
- `src/components/layout/Header.tsx`

**iOS Header Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [≡]  [Channel ▼]   YourNickname    [12 👤]  [●]  [⚙]   │
└──────────────────────────────────────────────────────────┘
```

- **Channel Badge:** Tap opens channel sheet, shows geohash
- **Nickname:** Inline editable (tap to edit, no modal)
- **Peer Count:** Live count, tap opens peer sheet
- **Mesh Indicator:** Green dot = connected, yellow = connecting
- **Settings Gear:** Opens settings sheet

### Agent 6.3: Input Bar Redesign

**Files to Modify:**
- `src/components/chat/MessageInput.tsx`

**iOS Input Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [+] │ Type a message...                       │ [🎤] [➤] │
└──────────────────────────────────────────────────────────┘
```

- **Plus Button:** Attachment picker
- **Voice Button:** Hold to record
- **Send Button:** Only visible when text entered

### Agent 6.4: Autocomplete Systems

**Files to Create:**
- `src/components/chat/CommandAutocomplete.tsx`
- `src/components/chat/MentionAutocomplete.tsx`

**Commands:** `/me`, `/nick`, `/join`, `/leave`, `/clear`, `/help`, `/mesh`
**Mentions:** `@` triggers peer list, filter as you type

---

## Wave 7: Rich Media & Polish (6 Agents)

**Goal:** Voice notes, image blur, payments, final polish.

### Agent 7.1: Voice Notes

**Files to Create:**
- `src/services/media/voice-recorder.ts`
- `src/components/chat/VoiceRecorder.tsx`
- `src/components/chat/VoiceMessage.tsx`

**Features:**
- MediaRecorder API with Opus codec
- Waveform visualization while recording
- Max 60 seconds
- Store locally, share CID over mesh

### Agent 7.2: Image Messages with Blur

**Files to Create:**
- `src/services/media/image-handler.ts`
- `src/components/chat/ImageMessage.tsx`

**Features:**
- Compress before sending
- Generate blurred thumbnail
- Tap-to-reveal (prevents shoulder surfing)
- Respects "Auto-reveal" setting

### Agent 7.3: Payment Chips

**Files to Create:**
- `src/services/payments/lightning.ts`
- `src/components/chat/PaymentChip.tsx`

**Features:**
- Detect Lightning invoices in messages
- Display as payment chips
- Show amount in sats + USD estimate
- Copy invoice on tap
- WebLN integration if available

### Agent 7.4: Animations & Transitions

**Files to Modify:**
- All sheet components
- All message components

**Polish:**
- 60fps sheet animations
- Message fade-in on arrival
- Haptic feedback (Vibration API)
- Smooth keyboard avoidance

### Agent 7.5: Mesh Status UI

**Files to Create:**
- `src/components/mesh/MeshStatusIndicator.tsx`
- `src/components/mesh/MeshDebugPanel.tsx`

**Features:**
- Header indicator (dot color)
- Peer count with tap to expand
- Debug panel showing:
  - Connection method (Nostr/Direct/Hybrid)
  - Per-peer latency
  - App version comparison
  - Transfer progress

### Agent 7.6: Comprehensive Testing

**Files to Create/Modify:**
- `e2e/mesh.spec.ts`
- `e2e/offline.spec.ts`
- `src/services/mesh/__tests__/*.ts`

**Test Scenarios:**
- [ ] App loads instantly in airplane mode
- [ ] Mesh forms automatically when online
- [ ] QR bootstrapper works end-to-end
- [ ] App transfers correctly over WebRTC
- [ ] Sheets animate smoothly
- [ ] Messages display in IRC format
- [ ] Voice recording works
- [ ] Image blur/reveal works

---

## Execution Summary

| Wave | Focus | Agents | Parallelizable |
|------|-------|--------|----------------|
| 1 | Offline-First | 2 | Yes |
| 2 | Auto-Mesh | 4 | Partially (2.1-2.2 parallel, 2.3-2.4 after) |
| 3 | P2P Distribution | 3 | Yes |
| 4 | QR Bootstrap | 2 | Yes |
| 5 | iOS Navigation | 3 | Yes |
| 6 | iOS Messages/Header | 4 | Yes |
| 7 | Rich Media & Polish | 6 | Yes |

**Total: 24 Agents across 7 Waves**

**Critical Path:**
1. Wave 1 (offline) - Blocks all testing
2. Wave 2 (auto-mesh) - Core functionality
3. Waves 3-7 can run with more parallelism

---

## Finalized Decisions

| Decision | Choice | Details |
|----------|--------|---------|
| **Mesh Topology** | Smart auto-switch + slider | Full mesh up to 10, auto-switch to hub-spoke, user slider shows tradeoffs |
| **Bundle Security** | Trust-on-first-use | First bundle sets trusted hash, warn on mismatch |
| **QR Handshake** | Two QR codes | Hub shows offer, joiner shows answer - fully offline |
| **Rich Media** | All three | Voice notes, image blur/reveal, payment chips |
| **UI Fidelity** | Functional match | Same UX patterns, web-appropriate adaptations |

### Mesh Slider Implementation
```
Connections: [======|----] 15 peers
             Full Mesh ←→ Hub-Spoke

Full Mesh (current):
- Connections: 105 (15×14÷2)
- Latency: ~50ms (direct)
- Battery: Higher

Hub-Spoke:
- Connections: 14 (you → hub)
- Latency: ~100ms (via hub)
- Battery: Lower
```

---

## Execution Status

**Status: LAUNCHING**

Waves will be executed with maximum parallelism where dependencies allow.
