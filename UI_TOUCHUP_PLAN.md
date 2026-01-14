# BitChat In Browser - UI & Functionality Touchups Plan

## Executive Summary

This plan addresses two major areas:
1. **Offline-First Caching** - Fix Service Worker to load instantly from cache (airplane mode ready)
2. **iOS UI Parity** - Match the iOS native app layout and functionality exactly

**Note on Bluetooth:** Web Bluetooth is NOT supported on iOS (WebKit WONTFIX). The web version will remain "Nostr relay only" for connectivity. This is documented in the feature comparison and cannot be changed without native app distribution.

---

## Wave 1: Service Worker Cache-First Fix (1 Agent)

### Objective
Make the app load instantly from cache, with network as fallback. Currently the app goes to network first, which breaks airplane mode.

### Agent 1.1: Service Worker Overhaul

**Files to Modify:**
- `src/workers/sw.ts`

**Changes Required:**

1. **Remove Conflicting Fetch Handler (lines 306-350)**
   - The custom `self.addEventListener('fetch', ...)` conflicts with Workbox routing
   - Currently implements network-first which defeats offline-first

2. **Add Proper Navigation Route**
   ```typescript
   import { NavigationRoute, registerRoute } from 'workbox-routing';
   import { NetworkFirst, CacheFirst } from 'workbox-strategies';
   import { setCatchHandler } from 'workbox-routing';

   // All navigation requests serve cached index.html
   const navigationRoute = new NavigationRoute(
     new CacheFirst({
       cacheName: 'pages-cache',
     }),
     {
       // Allowlist patterns that should use this route
       allowlist: [/^\/$/],
       // Denylist API calls
       denylist: [/^\/api\//],
     }
   );
   registerRoute(navigationRoute);
   ```

3. **Fix Font Caching**
   - Change from `StaleWhileRevalidate` to `CacheFirst` for font files
   - Fonts don't change, no need to revalidate

4. **Add setCatchHandler for Offline Fallback**
   ```typescript
   setCatchHandler(async ({ event }) => {
     if (event.request.destination === 'document') {
       return caches.match('/index.html');
     }
     return Response.error();
   });
   ```

5. **Fix External Origin Matching**
   - Current regex too broad, matches unintended origins
   - Explicitly list: Nostr relays, Pinata gateway, dweb.link

**Verification:**
- Build app, install SW, go to airplane mode, reload - should load instantly
- Check Network tab shows "(ServiceWorker)" for all cached assets

---

## Wave 2: Core UI Structure - iOS Sheet Navigation (3 Agents)

### Objective
Replace page-based routing with iOS-style sheet modals over the main chat view.

### Agent 2.1: Sheet Component System

**Files to Create/Modify:**
- `src/components/layout/Sheet.tsx` (new)
- `src/components/layout/SheetStack.tsx` (new)
- `src/stores/navigation-store.ts` (new)

**Implementation:**
```typescript
// Sheet component with iOS-style slide-up animation
// Supports: half-sheet (50%), full-sheet, drag-to-dismiss
// Stack multiple sheets (Settings -> About)

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  height: 'half' | 'full' | 'auto';
  children: ComponentChildren;
}
```

**Navigation Store:**
```typescript
interface NavigationState {
  sheets: SheetConfig[];  // Stack of open sheets
  pushSheet: (sheet: SheetConfig) => void;
  popSheet: () => void;
  popToRoot: () => void;
}
```

### Agent 2.2: Convert Existing Views to Sheets

**Files to Modify:**
- `src/components/channels/ChannelList.tsx` → Sheet modal
- `src/components/settings/SettingsView.tsx` → Sheet modal
- `src/components/peers/PeerList.tsx` → Sheet modal
- `src/components/onboarding/OnboardingWizard.tsx` → Full sheet

**Pattern:**
- Main chat view (`MessageList` + `MessageInput`) is ALWAYS visible behind sheets
- Tapping channel name opens `ChannelList` as half-sheet
- Tapping people count opens `PeerList` as half-sheet
- Settings icon opens `SettingsView` as full sheet

### Agent 2.3: Update App Shell and Routing

**Files to Modify:**
- `src/components/layout/AppShell.tsx`
- `src/App.tsx`
- Remove: `src/pages/` directory (if exists)

**Changes:**
- Remove React Router / page-based navigation
- Main view is always the chat
- Sheets overlay via `SheetStack` component
- Tab bar at bottom: Chat (active), Channels, People, Settings

---

## Wave 3: Message Display - IRC Style (2 Agents)

### Objective
Replace bubble-style messages with iOS IRC-style inline text format.

### Agent 3.1: Message Component Redesign

**Files to Modify:**
- `src/components/chat/MessageList.tsx`
- `src/components/chat/MessageItem.tsx`
- `src/components/chat/MessageBubble.tsx` → Delete or repurpose

**iOS Format:**
```
[12:34] <alice> Hello everyone!
[12:35] <bob> Hey alice, what's up?
[12:35] * alice waves
[12:36] --> charlie has joined
[12:37] <-- dave has left
```

**Implementation:**
```typescript
// Single-line message format
<div class="message-line">
  <span class="timestamp text-gray-500">[{formatTime(msg.timestamp)}]</span>
  <span class="sender text-green-400">&lt;{msg.senderNick}&gt;</span>
  <span class="content text-gray-100">{msg.content}</span>
</div>

// System messages (joins, leaves, actions)
<div class="message-line system">
  <span class="timestamp">[{formatTime(msg.timestamp)}]</span>
  <span class="action text-yellow-400">* {msg.senderNick} {msg.action}</span>
</div>
```

**Styling:**
- Monospace font throughout
- No bubbles, no avatars
- Sender nick in color (consistent per user via hash)
- Timestamps in gray, 24-hour format
- System messages in yellow/orange

### Agent 3.2: Special Message Types

**Files to Create/Modify:**
- `src/components/chat/ImageMessage.tsx` (new)
- `src/components/chat/VoiceMessage.tsx` (new)
- `src/components/chat/PaymentChip.tsx` (new)

**Image Messages (iOS Style):**
- Inline blurred thumbnail
- Tap to reveal (prevents shoulder surfing)
- Long-press for save/share options

**Voice Messages:**
- Play button with waveform visualization
- Duration display
- Tap to play/pause

**Payment Chips:**
- Bitcoin/Lightning payment display
- Amount in sats with USD conversion
- Copy invoice/address on tap

---

## Wave 4: Header & Input Redesign (2 Agents)

### Objective
Match iOS header and input bar exactly.

### Agent 4.1: Header Redesign

**Files to Modify:**
- `src/components/layout/Header.tsx`
- `src/components/layout/ChannelBadge.tsx` (new)

**iOS Header Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Menu]  [Channel Badge ▼]  Your Nickname  [12 👤] [⚙️] │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- **Channel Badge**: Shows current geohash level (e.g., "9q8y" or "Local")
  - Tap to open channel selector sheet
  - Dropdown arrow indicator
- **Nickname**: Inline editable
  - Tap to edit directly in header
  - No modal, just text field
- **People Count**: Live count of peers in channel
  - Tap to open peer list sheet
  - Updates in real-time
- **Settings Gear**: Opens settings sheet

### Agent 4.2: Input Bar Redesign

**Files to Modify:**
- `src/components/chat/MessageInput.tsx`
- `src/components/chat/CommandAutocomplete.tsx` (new)
- `src/components/chat/MentionAutocomplete.tsx` (new)

**iOS Input Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [+] │ Type a message...                      │ [🎤] [➤] │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- **Plus Button**: Opens attachment picker (photos, files)
- **Voice Button**: Hold to record voice message
- **Send Button**: Only visible when text entered
- **Command Autocomplete**: Typing `/` shows command list
  - `/me`, `/nick`, `/join`, `/leave`, `/clear`, `/help`
- **Mention Autocomplete**: Typing `@` shows peer list
  - Filter as you type
  - Tab/tap to complete

---

## Wave 5: Missing Features & Polish (3 Agents)

### Objective
Implement remaining iOS features and polish.

### Agent 5.1: Voice Notes

**Files to Create:**
- `src/services/audio/voice-recorder.ts`
- `src/components/chat/VoiceRecorder.tsx`

**Implementation:**
- Use MediaRecorder API
- Opus codec for small file size
- Max 60 second recordings
- Waveform preview while recording
- Upload to IPFS, send CID in message

### Agent 5.2: Image Messages with Blur

**Files to Create:**
- `src/services/media/image-handler.ts`
- `src/components/chat/ImagePicker.tsx`
- `src/components/chat/BlurredImage.tsx`

**Implementation:**
- Compress images before upload
- Generate blurred thumbnail
- Upload to IPFS
- Receiver sees blur until tap-to-reveal
- Respects "Auto-reveal images" setting

### Agent 5.3: Payment Integration

**Files to Create:**
- `src/services/payments/lightning.ts`
- `src/components/chat/PaymentRequest.tsx`
- `src/components/chat/PaymentSent.tsx`

**Implementation:**
- Parse Lightning invoices in messages
- Display as payment chips
- Copy invoice on tap
- Show payment status (pending/complete)
- Integration with WebLN if available

---

## Wave 6: Final Polish & Testing (2 Agents)

### Agent 6.1: Animation & Transitions

**Files to Modify:**
- All sheet components
- All message components
- Navigation transitions

**Polish:**
- 60fps sheet animations
- Message fade-in on arrival
- Haptic feedback simulation (vibrate API)
- Smooth keyboard avoidance

### Agent 6.2: Comprehensive Testing

**Tests to Add/Update:**
- E2E tests for sheet navigation
- Offline mode tests
- Message rendering tests
- Voice/image upload tests

**Manual Testing Checklist:**
- [ ] App loads instantly in airplane mode
- [ ] All sheets animate smoothly
- [ ] Messages display in IRC format
- [ ] Voice recording works
- [ ] Image blur/reveal works
- [ ] Commands autocomplete
- [ ] Mentions autocomplete
- [ ] Header nickname editing
- [ ] Channel switching via badge
- [ ] Peer list accurate count

---

## Summary

| Wave | Focus | Agents | Key Deliverables |
|------|-------|--------|------------------|
| 1 | Offline-First | 1 | Cache-first SW, instant loading |
| 2 | Sheet Navigation | 3 | iOS-style modals, remove page routing |
| 3 | IRC Messages | 2 | Inline text format, special messages |
| 4 | Header/Input | 2 | iOS header, autocomplete |
| 5 | Missing Features | 3 | Voice, images, payments |
| 6 | Polish | 2 | Animations, testing |

**Total: 6 Waves, 13 Agent Tasks**

## Execution Order

Waves 1-2 are critical and should be done first:
1. Wave 1 (offline) unblocks airplane mode testing
2. Wave 2 (navigation) is the foundation for all UI work

Waves 3-5 can be parallelized after Wave 2 completes.

Wave 6 is cleanup after all features are in.
