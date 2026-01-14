# BitChat In Browser - Rollback Runbook

This runbook provides step-by-step procedures for rolling back BitChat In Browser deployments when issues are detected in production.

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Pre-Rollback Assessment](#pre-rollback-assessment)
3. [Rollback Procedures](#rollback-procedures)
4. [Post-Rollback Verification](#post-rollback-verification)
5. [Communication](#communication)
6. [Root Cause Analysis](#root-cause-analysis)

---

## When to Rollback

### Automatic Rollback Triggers

Initiate rollback immediately if:

- [ ] **Critical security vulnerability** discovered in production
- [ ] **Data corruption** affecting user data
- [ ] **Complete service outage** (app won't load)
- [ ] **Authentication/encryption failure** compromising user privacy

### Manual Rollback Consideration

Consider rollback if:

- [ ] **Significant functionality broken** (messaging, channels, etc.)
- [ ] **Performance degradation** (page load > 10s, high error rates)
- [ ] **Partial service outage** (features not working)
- [ ] **High error rate** (> 5% of requests failing)
- [ ] **User complaints** about critical features

### Do NOT Rollback If

- Minor UI issues that don't affect core functionality
- Performance slightly degraded but acceptable
- Issue affects < 1% of users
- Issue can be fixed forward within 2 hours

---

## Pre-Rollback Assessment

### Step 1: Confirm the Issue

Before rolling back, verify:

```bash
# Check if issue is widespread
# Monitor error tracking dashboard
# Check uptime monitoring
# Review user reports
```

**Questions to answer:**

- [ ] Is the issue reproducible?
- [ ] What percentage of users are affected?
- [ ] Is this a new issue or regression?
- [ ] When did the issue start? (correlate with deployment)

### Step 2: Identify the Target Version

Find the last known good version:

```bash
# Check deployment history
cat deployment-history.md

# Or check IPFS pinning service for previous CIDs
# Pinata, web3.storage, etc.
```

**Record:**
- Current (broken) CID: `_______________`
- Target (working) CID: `_______________`
- Target version: `_______________`
- Time of last good deployment: `_______________`

### Step 3: Assess Rollback Impact

Consider:

- [ ] Will rollback affect users currently using the app?
- [ ] Are there database/storage schema changes to consider?
- [ ] Will any user data be lost?
- [ ] Are there dependent services affected?

### Step 4: Get Approval

For non-critical issues, get approval from:

- [ ] Technical Lead
- [ ] Product Owner (if available)

For critical issues (security, data corruption), proceed immediately and notify afterward.

---

## Rollback Procedures

### Procedure A: ENS Content Hash Rollback (Primary Method)

This is the primary rollback method for production (bitbrowse.eth.limo).

#### Time Required: 10-30 minutes (including propagation)

#### Step 1: Access ENS Manager

1. Open [app.ens.domains](https://app.ens.domains)
2. Connect wallet with ENS management permissions
3. Navigate to `bitbrowse.eth`
4. Click "Manage"

#### Step 2: Update Content Hash

1. Click "Records" tab
2. Locate "Content Hash" field
3. **Current value**: `ipfs://[CURRENT_CID]` (record this)
4. **New value**: `ipfs://[TARGET_CID]`
5. Click "Confirm"
6. Sign transaction in wallet
7. Wait for transaction confirmation (1-3 blocks)

#### Step 3: Wait for Propagation

```bash
# Check ENS resolver (may take 5-15 minutes)
# Use ENS lookup tools or etherscan

# Monitor gateway
watch -n 30 'curl -sI https://bitbrowse.eth.limo | head -5'
```

#### Step 4: Verify Rollback

```bash
# Test the rollback
curl -s https://bitbrowse.eth.limo | head -20

# Verify correct version
# Check console for version number or commit hash
```

### Procedure B: IPFS Gateway Redirect (Emergency)

If ENS update is too slow or wallet unavailable.

#### Time Required: 5-10 minutes

**Note**: This is a temporary measure. Follow up with ENS update.

1. **Contact IPFS pinning service** to prioritize old CID
2. **Use alternative gateway** to serve old version
3. **Communicate** alternative URL to users

```bash
# Alternative gateway URLs
https://cloudflare-ipfs.com/ipfs/[TARGET_CID]/
https://gateway.pinata.cloud/ipfs/[TARGET_CID]/
https://dweb.link/ipfs/[TARGET_CID]/
```

### Procedure C: Service Worker Cache Invalidation

If users are stuck on cached broken version.

#### For Individual Users

Instruct users to:

1. Open DevTools (F12)
2. Go to Application > Storage
3. Click "Clear site data"
4. Reload the page

#### For All Users (Requires Code Deployment)

If the service worker itself is broken, users may need to manually clear cache. Consider:

1. Deploy a minimal "cache-buster" version
2. Update service worker version string
3. Force `skipWaiting()` in new SW

---

## Post-Rollback Verification

### Immediate Verification (5 minutes)

- [ ] App loads at bitbrowse.eth.limo
- [ ] No console errors
- [ ] Service worker registers
- [ ] Can complete basic actions (login, view channels)

### Functional Verification (15 minutes)

- [ ] Onboarding flow works
- [ ] Message sending works
- [ ] Message receiving works
- [ ] Channel navigation works
- [ ] Offline mode works
- [ ] Settings persist

### Monitoring Verification

- [ ] Error rate returning to normal
- [ ] Response times returning to normal
- [ ] No new error types appearing
- [ ] User complaints decreasing

### Verification Checklist

```bash
# Basic health check
curl -sI https://bitbrowse.eth.limo | grep "200 OK"

# Check service worker
curl -s https://bitbrowse.eth.limo/sw.js | head -5

# Check manifest
curl -s https://bitbrowse.eth.limo/manifest.webmanifest | jq .name
```

---

## Communication

### Internal Communication

#### During Rollback

Send to team channel:

```
ROLLBACK IN PROGRESS

Issue: [Brief description]
Affected: [Scope of impact]
Status: Rolling back to version [X.X.X]
ETA: [Time estimate]
Lead: [Your name]
```

#### After Rollback

```
ROLLBACK COMPLETE

Issue: [Brief description]
Resolution: Rolled back to version [X.X.X]
CID: [TARGET_CID]
Duration: [Total time]
Next Steps: [RCA scheduled for DATE/TIME]
```

### External Communication (if needed)

For significant outages, consider:

1. **Status page update** (if exists)
2. **Social media** (Twitter/Nostr)
3. **In-app notification** (if possible)

Template:

```
BitChat Web is experiencing issues. We're working on a fix.
In the meantime, you can use the native iOS/Android apps.
Updates to follow.
```

---

## Root Cause Analysis

### Schedule RCA

Within 24-48 hours of rollback:

1. Schedule meeting with relevant team members
2. Gather all relevant data/logs
3. Document timeline of events

### RCA Template

```markdown
# Incident Report: [Title]

## Summary
- **Date/Time**: YYYY-MM-DD HH:MM UTC
- **Duration**: X hours Y minutes
- **Severity**: P1/P2/P3
- **Affected Users**: X% / N users

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Issue first reported |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Rollback initiated |
| HH:MM | Rollback complete |
| HH:MM | Service restored |

## Root Cause
[Detailed technical explanation]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## Impact
- [User impact]
- [Business impact]

## Resolution
[How the issue was resolved]

## Prevention
1. [Action item 1] - Owner: [Name] - Due: [Date]
2. [Action item 2] - Owner: [Name] - Due: [Date]

## Lessons Learned
- [Lesson 1]
- [Lesson 2]
```

### Follow-Up Actions

After RCA:

- [ ] Create tickets for prevention measures
- [ ] Update deployment checklist if needed
- [ ] Update monitoring/alerting if needed
- [ ] Update this runbook if needed
- [ ] Share learnings with team

---

## Reference Information

### Deployment History

| Date | Version | CID | Status | Notes |
|------|---------|-----|--------|-------|
| | | | | |

### Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Technical Lead | | |
| On-Call | | |
| ENS Admin | | |
| IPFS Admin | | |

### Useful Commands

```bash
# Check current ENS content hash
# (requires ethereum node or ethers.js)

# Check IPFS CID content
ipfs cat [CID]/index.html | head -20

# Check gateway response
curl -I https://bitbrowse.eth.limo

# List pinned CIDs (Pinata)
curl -H "Authorization: Bearer $PINATA_JWT" \
  https://api.pinata.cloud/data/pinList
```

### IPFS Gateway Status

Check gateway status at:
- https://ipfs.github.io/public-gateway-checker/

### ENS Resolver Information

- **ENS Domain**: bitbrowse.eth
- **Resolver**: [resolver address]
- **Controller**: [controller address]

---

## Appendix: Rollback Decision Matrix

| Severity | Impact | Action |
|----------|--------|--------|
| Critical | > 50% users | Immediate rollback |
| Critical | < 50% users | Rollback within 1 hour |
| High | > 50% users | Rollback within 2 hours |
| High | < 50% users | Assess fix-forward option |
| Medium | Any | Assess, likely fix-forward |
| Low | Any | Fix-forward |

### Severity Definitions

- **Critical**: Security breach, data loss, complete outage
- **High**: Core functionality broken, significant UX impact
- **Medium**: Feature broken, workarounds available
- **Low**: Minor issues, cosmetic problems
