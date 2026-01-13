# Development Guide

Guide for setting up, developing, and testing BitChat In Browser.

## Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Modern browser (Chrome, Firefox, Safari, or Edge)

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/permissionlesstech/bitchat-in-browser.git
cd bitchat-in-browser
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Verify Setup

The app should:
- Load without errors
- Show onboarding if first run
- Connect to Nostr relays (check console)

## Project Structure

```
bitchat-in-browser/
├── src/
│   ├── components/      # Preact UI components
│   ├── services/        # Core business logic
│   │   ├── crypto/      # Encryption, signing, hashing
│   │   ├── nostr/       # Nostr protocol client
│   │   └── storage/     # OPFS/IndexedDB storage
│   ├── stores/          # Zustand state management
│   ├── workers/         # Service Worker
│   └── types/           # TypeScript definitions
├── e2e/                 # Playwright E2E tests
├── public/              # Static assets
├── scripts/             # Build and deploy scripts
└── docs/                # Documentation
```

## Code Style

### TypeScript

- Use strict mode (`"strict": true`)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
interface Message {
  id: string;
  content: string;
  timestamp: number;
}

function processMessage(msg: Message): string {
  return msg.content.toUpperCase();
}

// Avoid
type Message = {
  id: any;
  content: string;
  timestamp: number;
};
```

### Preact Components

- Use functional components with hooks
- Keep components small and focused
- Use custom hooks for reusable logic
- Prop types should be explicit interfaces

```typescript
interface MessageItemProps {
  message: Message;
  onDelete?: (id: string) => void;
}

export function MessageItem({ message, onDelete }: MessageItemProps) {
  return (
    <div class="message">
      <span>{message.content}</span>
      {onDelete && (
        <button onClick={() => onDelete(message.id)}>Delete</button>
      )}
    </div>
  );
}
```

### Zustand Stores

- One store per domain (messages, channels, peers, etc.)
- Use selectors for derived state
- Keep actions within the store
- Use immer-style updates for complex state

```typescript
// Good: Focused store with selectors
export const useMessagesStore = create<MessagesStore>()((set, get) => ({
  messages: {},
  addMessage: (message) => set((state) => ({
    messages: {
      ...state.messages,
      [message.channelId]: [...(state.messages[message.channelId] || []), message],
    },
  })),
}));

export const useChannelMessages = (channelId: string) =>
  useMessagesStore((state) => state.messages[channelId] || []);
```

### CSS / Tailwind

- Use Tailwind utility classes
- Follow terminal aesthetic (green text, dark background)
- Mobile-first responsive design
- Avoid custom CSS unless necessary

```tsx
// Good: Tailwind utilities
<div class="bg-black text-green-400 p-4 font-mono">
  <span class="text-sm opacity-75">{timestamp}</span>
  <p class="mt-1">{content}</p>
</div>
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `MessageList.tsx`)
- Services: `kebab-case.ts` (e.g., `nostr-client.ts`)
- Stores: `kebab-case-store.ts` (e.g., `messages-store.ts`)
- Types: `types.ts` in each directory
- Tests: `*.test.ts` or `*.spec.ts`

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npm run test -- src/services/crypto/encryption.test.ts
```

**Writing Unit Tests:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptString, decryptString } from './encryption';

describe('encryption', () => {
  let testKey: Uint8Array;

  beforeEach(async () => {
    await initSodium();
    testKey = generateKey();
  });

  it('should encrypt and decrypt string correctly', () => {
    const plaintext = 'Hello, BitChat!';
    const encrypted = encryptString(plaintext, testKey);
    const decrypted = decryptString(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption with wrong key', () => {
    const plaintext = 'Secret message';
    const encrypted = encryptString(plaintext, testKey);
    const wrongKey = generateKey();

    expect(() => decryptString(encrypted, wrongKey)).toThrow();
  });
});
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# With browser UI
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Mobile viewports
npm run test:e2e:mobile
```

**Writing E2E Tests:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('[data-testid="chat-view"]');
  });

  test('should send a message', async ({ page }) => {
    const input = page.getByTestId('message-input');
    await input.fill('Hello world');
    await input.press('Enter');

    await expect(page.getByText('Hello world')).toBeVisible();
  });
});
```

### Security Tests

```bash
# Run security test suite
npm run test:security

# Full security audit
npm run security:audit
```

### Benchmarks

```bash
# All benchmarks
npm run test:bench

# Specific benchmark
npm run test:bench:crypto
npm run test:bench:storage
```

## Debugging

### Browser DevTools

1. **Console**: Check for errors and log messages
2. **Network**: Monitor WebSocket connections to relays
3. **Application**: Inspect localStorage, IndexedDB, Service Worker
4. **React DevTools**: Works with Preact via compatibility layer

### Debug Logging

Enable verbose logging by opening DevTools console and running:

```javascript
localStorage.setItem('debug', 'bitchat:*');
location.reload();
```

Disable with:

```javascript
localStorage.removeItem('debug');
location.reload();
```

### Common Debug Points

```typescript
// In NostrClient
console.log('[NostrClient] Connection status:', this.getConnectionStatus());

// In RelayPool
console.log('[RelayPool] Relay states:', this.getRelayStatuses());

// In StorageManager
const health = await storage.getHealth();
console.log('[Storage] Health:', health);
```

### Service Worker Debugging

1. Open DevTools > Application > Service Workers
2. Check "Update on reload" during development
3. Use "Unregister" to reset SW state
4. Check Cache Storage for cached resources

### Zustand DevTools

In development, Zustand stores are connected to Redux DevTools:

1. Install [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
2. Open DevTools > Redux tab
3. See state changes in real-time

## Common Issues

### Issue: Relay connections failing

**Symptoms:** No messages, "0 connected" in status

**Solutions:**
1. Check network connectivity
2. Some relays may be down - this is normal
3. Check browser WebSocket support
4. Look for CORS errors in console

```typescript
// Force reconnect
const client = getDefaultClient();
await client.resetConnections();
```

### Issue: Storage quota exceeded

**Symptoms:** Errors saving messages, storage health unhealthy

**Solutions:**
1. Check storage usage in DevTools > Application
2. Clear old messages:
   ```typescript
   // In console
   const store = useMessagesStore.getState();
   store.clearAll();
   ```
3. Request persistent storage:
   ```typescript
   await navigator.storage.persist();
   ```

### Issue: Service Worker not updating

**Symptoms:** Old version loads, changes not reflected

**Solutions:**
1. Hard refresh: Cmd/Ctrl + Shift + R
2. DevTools > Application > Service Workers > Unregister
3. Clear site data completely

### Issue: Crypto initialization failing

**Symptoms:** Encryption errors, "sodium not ready"

**Solutions:**
1. Ensure `initSodium()` called before crypto operations
2. Check libsodium-wrappers-sumo is installed
3. Wait for ready state:
   ```typescript
   await ensureSodiumReady();
   ```

### Issue: Messages not syncing with native apps

**Symptoms:** Messages sent from web not visible on iOS/Android

**Solutions:**
1. Verify same relay list is used
2. Check event kind is correct (20000 for location)
3. Verify geohash precision matches
4. Check event signature is valid

## Build and Deploy

### Local Build

```bash
# Production build
npm run build

# Preview locally
npm run preview
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run analyze:bundle
```

Target: Initial bundle < 500KB

### Deploy to IPFS

```bash
# Set environment variable
export PINATA_JWT=your_jwt_token

# Build and deploy
npm run build
npm run deploy:ipfs
```

Output will include the IPFS CID for ENS update.

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Error Translator

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Recommended Workflow

1. Create feature branch
2. Make changes
3. Run `npm run lint` and fix issues
4. Run `npm run test` for unit tests
5. Run `npm run test:e2e` for E2E tests
6. Run `npm run build` to verify build
7. Submit PR

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [Protocol](PROTOCOL.md) - Nostr implementation
- [Privacy](PRIVACY.md) - Privacy guarantees
