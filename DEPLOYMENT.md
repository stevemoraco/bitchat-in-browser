# BitChat In Browser - Deployment Guide

This guide covers deploying BitChat In Browser to IPFS and updating the ENS content hash for `bitbrowse.eth`.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Automated Deployment (GitHub Actions)](#automated-deployment-github-actions)
4. [Manual Deployment](#manual-deployment)
5. [Getting API Keys](#getting-api-keys)
6. [Updating ENS Content Hash](#updating-ens-content-hash)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A Pinata account (free) and/or web3.storage account (free)
- For ENS updates: Ethereum wallet that controls `bitbrowse.eth`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# 3. Deploy to IPFS (requires PINATA_JWT or WEB3_STORAGE_TOKEN)
export PINATA_JWT=your_jwt_token_here
npm run deploy:ipfs

# 4. Verify deployment
npx tsx scripts/verify-deployment.ts <CID>

# 5. Update ENS (manual via app.ens.domains - see instructions below)
```

---

## Automated Deployment (GitHub Actions)

The repository includes a GitHub Actions workflow that automatically deploys on push to `main`.

### Setup

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Add the following secrets:
   - `PINATA_JWT` - Your Pinata JWT token
   - `WEB3_STORAGE_TOKEN` - Your web3.storage token (optional backup)

### Workflow Behavior

- **Trigger:** Push to `main` branch or manual workflow dispatch
- **Tests:** Runs linting, type checking, and unit tests before deployment
- **Deployment:** Uploads to Pinata (primary) and web3.storage (backup)
- **Verification:** Checks that content is accessible via IPFS gateways
- **Summary:** Creates a deployment summary with CID and gateway URLs

### Manual Trigger

1. Go to **Actions** > **Deploy to IPFS**
2. Click **Run workflow**
3. Optionally check "Skip tests before deployment"
4. Click **Run workflow**

---

## Manual Deployment

### Option 1: Using the Deploy Script

```bash
# Set environment variables
export PINATA_JWT=your_pinata_jwt
export WEB3_STORAGE_TOKEN=your_web3storage_token  # optional

# Build and deploy
npm run build
npm run deploy:ipfs

# Or deploy to specific provider
npx tsx scripts/deploy-ipfs.ts --pinata
npx tsx scripts/deploy-ipfs.ts --web3storage
```

### Option 2: Using IPFS Desktop

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Install IPFS Desktop:**
   - Download from: https://docs.ipfs.tech/install/ipfs-desktop/
   - Or use the CLI: `npm install -g ipfs`

3. **Add the dist folder:**
   ```bash
   ipfs add -r --cid-version=1 dist/
   ```
   This outputs a CID like `bafybeie...`

4. **Pin the content:**
   The content is now on your local node. To ensure persistence, pin it to a service.

### Option 3: Using Pinata Web UI

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Go to Pinata:** https://app.pinata.cloud

3. **Click "Upload"** > **"Folder"**

4. **Select the `dist` folder** from your project

5. **Give it a name** (e.g., "bitchat-in-browser-v1.0.0")

6. **Click "Upload"** and copy the CID

### Option 4: Using web3.storage Web UI

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Go to web3.storage:** https://web3.storage

3. **Sign in** and go to **Files**

4. **Click "Upload Files"**

5. **Select all files in the `dist` folder**
   Note: You may need to upload as a CAR file for directory structures

6. **Copy the CID** from the uploaded content

---

## Getting API Keys

### Pinata API Key

1. **Sign up:** https://app.pinata.cloud/register

2. **Navigate to API Keys:**
   - Click on your profile (top right)
   - Select "API Keys"

3. **Create New Key:**
   - Click "New Key"
   - Enable "pinFileToIPFS" permission
   - Give it a name (e.g., "bitchat-deployment")
   - Click "Create Key"

4. **Copy the JWT:**
   - Copy the JWT token (not the API key/secret)
   - Store it securely

5. **Set as environment variable:**
   ```bash
   export PINATA_JWT=eyJhbGciOiJIUzI1NiIs...
   ```

### web3.storage Token

1. **Sign up:** https://web3.storage

2. **Create a token:**
   - Go to Account > Create an API token
   - Give it a name
   - Click "Create"

3. **Copy the token** and store it securely

4. **Set as environment variable:**
   ```bash
   export WEB3_STORAGE_TOKEN=eyJhbGciOiJIUzI1NiIs...
   ```

---

## Updating ENS Content Hash

After deploying to IPFS, you need to update the ENS content hash for `bitbrowse.eth`.

### Method 1: ENS Manager App (Recommended)

1. **Go to:** https://app.ens.domains

2. **Connect your wallet** (must be the controller of `bitbrowse.eth`)

3. **Search for:** `bitbrowse.eth`

4. **Click on the name** to view details

5. **Go to "Records" tab**

6. **Click "Edit Records"**

7. **Find "Content Hash"** field

8. **Enter:** `ipfs://YOUR_CID_HERE`
   - Example: `ipfs://bafybeie7xh3zqqtzfqz4qwu7q7j7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u`

9. **Click "Confirm"** and sign the transaction

10. **Wait for confirmation** (usually 1-2 minutes)

11. **Verify at:** https://bitbrowse.eth.limo

### Method 2: Using the ENS Update Script

```bash
# Show instructions and verify CID
npx tsx scripts/update-ens.ts YOUR_CID_HERE

# Programmatically update (requires ENS_PRIVATE_KEY)
export ENS_PRIVATE_KEY=0x...
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY  # optional
npx tsx scripts/update-ens.ts YOUR_CID_HERE --update
```

### Method 3: Etherscan (Advanced)

1. **Go to the ENS Public Resolver contract:**
   https://etherscan.io/address/0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63#writeContract

2. **Connect your wallet** via "Connect to Web3"

3. **Find `setContenthash` function**

4. **Enter parameters:**
   - `node`: The namehash of `bitbrowse.eth`
   - `hash`: The encoded IPFS content hash

5. **Submit transaction**

---

## Verification

### Verify IPFS Deployment

```bash
# Basic verification
npx tsx scripts/verify-deployment.ts YOUR_CID_HERE

# Verbose output
npx tsx scripts/verify-deployment.ts YOUR_CID_HERE --verbose

# JSON output (for CI)
npx tsx scripts/verify-deployment.ts YOUR_CID_HERE --json
```

### Manual Verification

Check these URLs after deployment:

1. **IPFS Gateways:**
   - https://YOUR_CID.ipfs.dweb.link
   - https://YOUR_CID.ipfs.cf-ipfs.com
   - https://gateway.pinata.cloud/ipfs/YOUR_CID

2. **ENS Gateway (after content hash update):**
   - https://bitbrowse.eth.limo
   - https://bitbrowse.eth.link

### Verification Checklist

- [ ] Index.html loads correctly
- [ ] PWA manifest is accessible
- [ ] Service worker is present
- [ ] JavaScript assets load
- [ ] CSS assets load
- [ ] App is functional after install

---

## Troubleshooting

### "CID not found" on gateways

**Possible causes:**
- Content hasn't propagated yet (wait 1-5 minutes)
- Content wasn't pinned to any persistent storage
- Gateway is having issues

**Solutions:**
1. Wait a few minutes and retry
2. Try a different gateway
3. Verify the content is pinned on Pinata or web3.storage dashboard
4. Re-upload the content

### "PINATA_JWT not set" error

**Solution:**
```bash
# Check if variable is set
echo $PINATA_JWT

# Set it
export PINATA_JWT=your_token_here

# Or add to .env file
cp .env.example .env
# Edit .env and add your token
```

### ENS update not reflecting

**Possible causes:**
- Transaction hasn't been mined yet
- ENS resolver cache hasn't updated
- DNS cache on eth.limo side

**Solutions:**
1. Check transaction status on Etherscan
2. Wait up to 10 minutes for propagation
3. Clear browser cache
4. Try eth.link instead of eth.limo

### Build failures

**Solutions:**
```bash
# Clean install
rm -rf node_modules
npm install

# Clear build cache
rm -rf dist
npm run build

# Check for TypeScript errors
npm run typecheck

# Check for linting errors
npm run lint
```

### Large bundle size

**Solutions:**
1. Run bundle analysis: `npm run analyze:bundle`
2. Check for duplicate dependencies
3. Ensure tree shaking is working
4. Consider lazy loading routes

### Service Worker not updating

**Solutions:**
1. Clear browser cache and service worker
2. Check service worker registration in browser DevTools
3. Ensure `skipWaiting()` is called in SW
4. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

---

## Support

- **Issues:** https://github.com/permissionlesstech/bitchat-in-browser/issues
- **Discussions:** https://github.com/permissionlesstech/bitchat-in-browser/discussions

## Related Documentation

- [IPFS Documentation](https://docs.ipfs.tech/)
- [ENS Documentation](https://docs.ens.domains/)
- [Pinata Documentation](https://docs.pinata.cloud/)
- [web3.storage Documentation](https://web3.storage/docs/)
