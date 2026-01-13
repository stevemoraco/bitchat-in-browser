# Release Checklist - BitChat In Browser v1.0.0

## Pre-Release Steps

### Code Quality
- [ ] All TypeScript errors resolved (`npm run typecheck`)
- [ ] ESLint passes with no errors (`npm run lint`)
- [ ] Code formatted with Prettier (`npm run format`)

### Testing
- [ ] Unit tests pass (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Security tests pass (`npm run test:security`)
- [ ] Manual testing completed on:
  - [ ] Chrome (Desktop)
  - [ ] Firefox (Desktop)
  - [ ] Safari (Desktop)
  - [ ] Chrome (Android)
  - [ ] Safari (iOS)

### Bundle Verification
- [ ] Production build succeeds (`npm run build`)
- [ ] Initial bundle under 500KB (`npm run analyze:bundle`)
- [ ] No unnecessary dependencies
- [ ] Source maps generated

### PWA Requirements
- [ ] `manifest.json` complete and valid
- [ ] All icon sizes generated (72, 96, 128, 144, 152, 192, 384, 512)
- [ ] Apple touch icons present
- [ ] Splash screens generated
- [ ] Service worker compiles
- [ ] Offline mode functional
- [ ] Add to Home Screen works (iOS Safari, Android Chrome)

### Documentation
- [ ] README.md up to date
- [ ] CHANGELOG.md updated with release notes
- [ ] CLAUDE.md current
- [ ] API documentation complete (if applicable)

### Security
- [ ] Security scan passes (`npm run security:scan`)
- [ ] npm audit shows no high/critical vulnerabilities
- [ ] No secrets in codebase
- [ ] CSP headers configured

---

## Deployment Steps

### 1. Prepare Release

```bash
# Ensure clean working directory
git status

# Pull latest changes
git pull origin main

# Install dependencies
npm ci

# Run full test suite
npm run test:ci
```

### 2. Build Production Bundle

```bash
# Clean previous build
rm -rf dist/

# Build production
npm run build

# Verify build output
ls -la dist/
```

### 3. Deploy to IPFS

```bash
# Set environment variables
export PINATA_JWT="your-pinata-jwt"
export WEB3_STORAGE_TOKEN="your-web3-storage-token"

# Deploy
npm run deploy:ipfs
```

**Expected Output:**
```
Uploading to IPFS...
Pinata CID: bafybeig...
web3.storage CID: bafybeig...
Deployment complete!
```

**Save the CID for ENS update.**

### 4. Verify IPFS Deployment

Test the deployment on multiple gateways:

```bash
# Pinata gateway
curl -I https://gateway.pinata.cloud/ipfs/<CID>/

# dweb.link
curl -I https://<CID>.ipfs.dweb.link/

# cloudflare-ipfs
curl -I https://cloudflare-ipfs.com/ipfs/<CID>/
```

### 5. Update ENS

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect wallet that owns `bitbrowse.eth`
3. Navigate to `bitbrowse.eth` > Records
4. Click "Edit Records"
5. Update Content Hash:
   - Type: IPFS
   - Value: `ipfs://<CID>`
6. Confirm transaction
7. Wait for transaction to confirm

### 6. Verify ENS Resolution

```bash
# Check ENS content hash (may take 5-10 minutes to propagate)
curl -I https://bitbrowse.eth.limo/

# Verify HTML returned
curl -s https://bitbrowse.eth.limo/ | head -20
```

---

## Post-Deployment Verification

### Functional Testing

- [ ] App loads at bitbrowse.eth.limo
- [ ] PWA manifest loads correctly
- [ ] Service worker registers
- [ ] Add to Home Screen prompt appears (where supported)
- [ ] App works offline after initial load

### Feature Testing

- [ ] Can create new identity
- [ ] Can import existing nsec
- [ ] Can join location channel
- [ ] Can send messages
- [ ] Messages sync across devices
- [ ] NIP-17 DMs work
- [ ] Emergency wipe clears all data

### Cross-Platform Verification

| Platform | Browser | Load | Install | Offline | Messaging |
|----------|---------|------|---------|---------|-----------|
| iOS | Safari | [ ] | [ ] | [ ] | [ ] |
| Android | Chrome | [ ] | [ ] | [ ] | [ ] |
| Desktop | Chrome | [ ] | [ ] | [ ] | [ ] |
| Desktop | Firefox | [ ] | [ ] | [ ] | [ ] |
| Desktop | Safari | [ ] | [ ] | [ ] | [ ] |

### Native App Interop

- [ ] Messages sent from web visible in iOS app
- [ ] Messages sent from web visible in Android app
- [ ] Messages from native apps visible in web

### Performance Checks

- [ ] Initial load under 3 seconds on 4G
- [ ] Time to interactive under 5 seconds
- [ ] Lighthouse PWA score > 90
- [ ] Bundle size under 500KB

---

## Rollback Procedure

If issues are discovered after deployment:

### 1. Identify Previous Working CID

Check deployment logs or IPFS history for the last known good CID.

### 2. Revert ENS Content Hash

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect wallet
3. Navigate to `bitbrowse.eth` > Records
4. Update Content Hash to previous CID
5. Confirm transaction

### 3. Verify Rollback

```bash
# Wait for propagation (5-10 minutes)
curl -I https://bitbrowse.eth.limo/

# Verify version in app
curl -s https://bitbrowse.eth.limo/version.json
```

### 4. Investigate and Fix

1. Download problematic build from IPFS
2. Reproduce issue locally
3. Fix and re-deploy once resolved

---

## Release Notes Template

```markdown
## BitChat In Browser v1.0.0

**Release Date:** YYYY-MM-DD
**IPFS CID:** bafybei...

### Changes
- Feature 1
- Feature 2
- Bug fix 1

### Known Issues
- Issue 1
- Issue 2

### Upgrade Notes
- Note 1

### Checksums
- `dist.tar.gz`: sha256:...
```

---

## Emergency Contacts

- **ENS Owner:** [Contact method]
- **IPFS Provider (Pinata):** support@pinata.cloud
- **Domain Issues:** ENS DAO Discord

---

## Version History

| Version | CID | Date | Notes |
|---------|-----|------|-------|
| 1.0.0 | TBD | TBD | Initial release |
