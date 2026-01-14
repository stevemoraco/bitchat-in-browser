# BitChat In Browser - Deployment Guide

This guide provides step-by-step instructions for deploying BitChat In Browser to production, including IPFS deployment, ENS configuration, and verification procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Build Process](#build-process)
4. [IPFS Deployment](#ipfs-deployment)
5. [ENS Configuration](#ens-configuration)
6. [Verification](#verification)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **IPFS** CLI or access to a pinning service (Pinata, Infura, web3.storage)
- **Ethereum wallet** with ETH for ENS transactions (if updating ENS)
- **Git** for version control

### Required Accounts/Access

- [ ] Access to IPFS pinning service credentials
- [ ] Access to ENS management for bitbrowse.eth (if updating)
- [ ] Access to monitoring dashboards
- [ ] Access to error tracking service (if configured)

### Environment Setup

```bash
# Clone the repository
git clone https://github.com/permissionlesstech/bitchat-in-browser.git
cd bitchat-in-browser

# Install dependencies
npm ci

# Verify installation
npm run typecheck
npm run lint
npm run test
```

---

## Pre-Deployment Checklist

Before deploying, complete the following checklist:

### Code Quality

- [ ] All tests pass: `npm run test`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] ESLint shows no errors: `npm run lint`
- [ ] Coverage meets threshold (80%): `npx tsx scripts/coverage-gate.ts`

### Security

- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Security scan passes: `npm run security:all`
- [ ] No secrets in codebase
- [ ] Dependencies are up to date

### Functionality

- [ ] App loads correctly in development
- [ ] Onboarding flow works
- [ ] Message sending/receiving works
- [ ] Offline mode works
- [ ] Service worker registers correctly

### Performance

- [ ] Bundle size is under 500KB
- [ ] Lighthouse score > 90
- [ ] No memory leaks detected

### Documentation

- [ ] CHANGELOG.md updated
- [ ] Version number updated in package.json
- [ ] README.md reflects current features

---

## Build Process

### Step 1: Clean Previous Builds

```bash
# Remove previous build artifacts
rm -rf dist/
rm -rf coverage/
```

### Step 2: Run Full Test Suite

```bash
# Run all tests to ensure code quality
npm run test:ci

# Verify coverage gate
npx tsx scripts/coverage-gate.ts --ci --threshold 80
```

### Step 3: Build for Production

```bash
# Build the application
npm run build

# This creates:
# - dist/index.html
# - dist/assets/*.js
# - dist/assets/*.css
# - dist/manifest.webmanifest
# - dist/sw.js (service worker)
# - dist/icons/*
```

### Step 4: Verify Build Output

```bash
# Check build output
ls -la dist/

# Verify file sizes
du -sh dist/*

# Test production build locally
npm run preview
# Open http://localhost:4173 and test the app
```

### Step 5: Run Production Build Tests

```bash
# Run E2E tests against production build
npm run build && npm run test:e2e
```

---

## IPFS Deployment

### Option A: Using the Deploy Script

```bash
# Deploy to IPFS using the project script
npm run deploy:ipfs

# This will:
# 1. Build the project (if not already built)
# 2. Upload to IPFS
# 3. Output the CID
```

### Option B: Manual IPFS Deployment

#### Using Pinata

```bash
# Install Pinata CLI (if not installed)
npm install -g @pinata/sdk

# Set environment variables
export PINATA_API_KEY=your_api_key
export PINATA_SECRET_KEY=your_secret_key

# Pin the dist folder
npx ipfs-car pack dist --output bitchat.car
# Upload bitchat.car to Pinata dashboard or via API
```

#### Using web3.storage

```bash
# Install w3 CLI
npm install -g @web3-storage/w3cli

# Login to web3.storage
w3 login your@email.com

# Upload the dist folder
w3 up dist/

# Note the CID from output
```

#### Using IPFS CLI Directly

```bash
# Start local IPFS daemon
ipfs daemon &

# Add the dist folder
ipfs add -r dist/

# Note the root CID (the last hash output)
# Example: added QmXyz... dist

# Pin to ensure persistence
ipfs pin add QmXyz...
```

### Record the CID

After deployment, record the CID:

```
CID: ____________________________________
Date: __________________________________
Deployer: ______________________________
Commit: ________________________________
```

### Verify IPFS Upload

```bash
# Test via IPFS gateway
curl -I "https://ipfs.io/ipfs/YOUR_CID/"

# Test via Cloudflare gateway
curl -I "https://cloudflare-ipfs.com/ipfs/YOUR_CID/"

# Test via local gateway
curl -I "http://localhost:8080/ipfs/YOUR_CID/"
```

---

## ENS Configuration

### Prerequisites

- ETH in wallet for gas fees
- Access to bitbrowse.eth ENS management

### Step 1: Access ENS Manager

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect your wallet
3. Search for `bitbrowse.eth`
4. Click "Manage"

### Step 2: Update Content Hash

1. Click "Records" tab
2. Find "Content Hash" field
3. Enter the new IPFS CID in format: `ipfs://YOUR_CID`
4. Click "Confirm"
5. Sign the transaction in your wallet
6. Wait for transaction confirmation

### Step 3: Verify ENS Update

```bash
# Check ENS content hash (requires ethers or web3)
# Or use ENS lookup tools

# Wait for propagation (usually 5-15 minutes)

# Test the ENS domain
curl -I "https://bitbrowse.eth.limo"
```

### Alternative: IPNS for Mutable Links

If you prefer not to update ENS for each deployment:

```bash
# Create IPNS key
ipfs key gen bitchat-deploy

# Publish to IPNS
ipfs name publish --key=bitchat-deploy /ipfs/YOUR_CID

# Update ENS once to point to IPNS
# ipns://k51qzi5uqu5...
```

---

## Verification

### Step 1: Basic Access Test

```bash
# Test IPFS gateway access
curl -s "https://ipfs.io/ipfs/YOUR_CID/" | head -20

# Test ENS gateway access
curl -s "https://bitbrowse.eth.limo" | head -20
```

### Step 2: Functional Verification

Open the deployed app and verify:

- [ ] App loads without errors
- [ ] Console shows no critical errors
- [ ] Service worker registers
- [ ] Can complete onboarding
- [ ] Can send/receive messages
- [ ] Offline mode works (disable network, reload)
- [ ] PWA install works

### Step 3: Performance Verification

```bash
# Run Lighthouse audit
npx lighthouse https://bitbrowse.eth.limo --output=json --output-path=lighthouse-report.json

# Check key metrics:
# - Performance score > 90
# - Accessibility score > 90
# - Best Practices score > 90
# - PWA score > 90
```

### Step 4: Cross-Browser Testing

Test on:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Chrome on Android
- [ ] Safari on iOS

### Step 5: Security Verification

```bash
# Check HTTPS
curl -I "https://bitbrowse.eth.limo" | grep -i "strict-transport-security"

# Check CSP headers
curl -I "https://bitbrowse.eth.limo" | grep -i "content-security-policy"
```

---

## Monitoring

### Set Up Monitoring

1. **Uptime Monitoring**
   - Configure monitoring for `https://bitbrowse.eth.limo`
   - Set up alerts for downtime
   - Monitor multiple IPFS gateways

2. **Error Tracking** (if configured)
   - Verify error tracking is receiving events
   - Set up alert thresholds

3. **Performance Monitoring**
   - Set up synthetic monitoring
   - Track Core Web Vitals

### Post-Deployment Monitoring Checklist

- [ ] Uptime monitoring configured
- [ ] Error alerts set up
- [ ] Performance baseline established
- [ ] IPFS pinning verified on multiple nodes

---

## Troubleshooting

### Common Issues

#### App Not Loading

1. **Check IPFS CID is valid**
   ```bash
   ipfs cat YOUR_CID/index.html
   ```

2. **Check ENS content hash**
   - Verify at app.ens.domains
   - Wait for propagation

3. **Try different gateways**
   - ipfs.io
   - cloudflare-ipfs.com
   - dweb.link

#### Service Worker Issues

1. **Clear service worker**
   - Open DevTools > Application > Service Workers
   - Unregister all service workers
   - Clear storage
   - Reload

2. **Check SW registration**
   ```javascript
   navigator.serviceWorker.getRegistrations()
   ```

#### CORS Issues

1. **Verify IPFS gateway supports CORS**
2. **Check for mixed content**
3. **Try a different gateway**

#### Slow Loading

1. **Check IPFS pinning status**
2. **Verify CDN propagation**
3. **Check bundle size**
   ```bash
   du -sh dist/assets/*
   ```

### Emergency Procedures

#### Rollback to Previous Version

See [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) for detailed rollback procedures.

Quick rollback:
1. Get previous CID from deployment history
2. Update ENS content hash to previous CID
3. Wait for propagation
4. Verify rollback

#### Incident Response

See [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) for incident handling procedures.

---

## Deployment History

Keep a record of all deployments:

| Date | Version | CID | Deployer | Notes |
|------|---------|-----|----------|-------|
| YYYY-MM-DD | x.x.x | Qm... | Name | Initial |

---

## Contact

For deployment issues:

- **Technical Lead**: [Contact]
- **On-Call**: [Contact]
- **Security Issues**: [Contact]

---

## Appendix

### Environment Variables

```bash
# .env.production (do not commit)
VITE_NOSTR_RELAYS=wss://relay1.example,wss://relay2.example
```

### Useful Commands

```bash
# Full deployment pipeline
npm run test:ci && npm run build && npm run deploy:ipfs

# Verify build before deployment
npm run preview

# Check bundle sizes
npm run analyze:bundle

# Generate PWA assets
npm run generate:pwa-assets
```

### IPFS Pinning Services

- **Pinata**: https://pinata.cloud
- **web3.storage**: https://web3.storage
- **Infura**: https://infura.io
- **Fleek**: https://fleek.co

### Gateway URLs

- https://ipfs.io/ipfs/
- https://cloudflare-ipfs.com/ipfs/
- https://dweb.link/ipfs/
- https://gateway.pinata.cloud/ipfs/
