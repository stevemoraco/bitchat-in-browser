# BitChat In Browser - Incident Response Guide

This guide provides procedures for responding to security incidents, outages, and other critical issues affecting BitChat In Browser.

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Team](#response-team)
3. [Incident Detection](#incident-detection)
4. [Response Procedures](#response-procedures)
5. [Communication Templates](#communication-templates)
6. [Post-Incident Process](#post-incident-process)
7. [Specific Incident Playbooks](#specific-incident-playbooks)

---

## Incident Classification

### Severity Levels

| Level | Name | Definition | Response Time | Examples |
|-------|------|------------|---------------|----------|
| **P1** | Critical | Complete service outage, security breach, data loss | Immediate (< 15 min) | App won't load, keys exposed, data corruption |
| **P2** | High | Major feature broken, significant user impact | < 1 hour | Messaging broken, auth failing, 50%+ affected |
| **P3** | Medium | Feature degraded, moderate user impact | < 4 hours | Slow performance, minor feature broken |
| **P4** | Low | Minor issue, minimal user impact | < 24 hours | UI glitch, cosmetic issues |

### Security Incident Types

| Type | Severity | Description |
|------|----------|-------------|
| **Data Breach** | P1 | Unauthorized access to user data |
| **Key Exposure** | P1 | Private keys or secrets exposed |
| **XSS/Injection** | P1-P2 | Cross-site scripting or injection attack |
| **DoS Attack** | P2 | Denial of service affecting availability |
| **Dependency Vuln** | P2-P3 | Critical vulnerability in dependencies |
| **Privacy Leak** | P2 | User privacy compromised |

---

## Response Team

### Roles and Responsibilities

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Incident Commander (IC)** | Overall coordination, decision making | |
| **Technical Lead** | Technical investigation and resolution | |
| **Communications Lead** | Internal/external communications | |
| **Security Lead** | Security-specific incidents | |

### Escalation Path

```
Developer -> Technical Lead -> Incident Commander -> Executive (if needed)
```

### On-Call Schedule

| Day | Primary | Secondary |
|-----|---------|-----------|
| Mon-Fri | | |
| Sat-Sun | | |

---

## Incident Detection

### Monitoring Sources

1. **Automated Monitoring**
   - Uptime monitoring alerts
   - Error rate alerts
   - Performance degradation alerts

2. **User Reports**
   - Support channels
   - Social media mentions
   - Community forums

3. **Internal Detection**
   - Developer testing
   - Log analysis
   - Security scanning

### Alert Response

When an alert is received:

1. **Acknowledge** the alert within 5 minutes
2. **Assess** severity level
3. **Escalate** if P1/P2
4. **Document** in incident log

---

## Response Procedures

### Phase 1: Detection & Triage (0-15 minutes)

#### Step 1: Initial Assessment

```markdown
## Initial Assessment Checklist

- [ ] What is the symptom/report?
- [ ] When did it start?
- [ ] How many users affected?
- [ ] What is the severity level?
- [ ] Is it ongoing or resolved?
```

#### Step 2: Declare Incident (if P1/P2)

```
INCIDENT DECLARED

Severity: P[X]
Summary: [Brief description]
Impact: [Who/what is affected]
IC: [Name]
Channel: [Communication channel]
```

#### Step 3: Assemble Response Team

For P1: Immediate page/call
For P2: Notify within 15 minutes
For P3/P4: Normal notification

### Phase 2: Investigation (15-60 minutes)

#### Step 1: Gather Information

```bash
# Check application status
curl -I https://bitbrowse.eth.limo

# Check IPFS gateway status
curl -I https://ipfs.io/ipfs/[CURRENT_CID]/

# Review error logs (if available)
# Check monitoring dashboards
```

#### Step 2: Identify Root Cause

- [ ] Recent deployment?
- [ ] Infrastructure issue?
- [ ] External dependency?
- [ ] Security incident?
- [ ] Traffic spike?

#### Step 3: Document Findings

Update incident log with:
- Timeline of events
- Systems affected
- Root cause hypothesis
- Impact assessment

### Phase 3: Containment (Varies)

#### For Service Outages

See [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md)

#### For Security Incidents

1. **Isolate** affected components
2. **Preserve** evidence/logs
3. **Revoke** compromised credentials
4. **Block** attack vectors

#### For Performance Issues

1. **Scale** if possible (not applicable for IPFS)
2. **Identify** bottlenecks
3. **Implement** temporary mitigations

### Phase 4: Resolution

#### Step 1: Implement Fix

- [ ] Fix tested in staging/preview
- [ ] Fix reviewed by second person
- [ ] Deployment plan approved
- [ ] Rollback plan ready

#### Step 2: Deploy Fix

Follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

#### Step 3: Verify Resolution

- [ ] Symptoms resolved
- [ ] Monitoring normal
- [ ] No new errors
- [ ] User confirmation (if applicable)

### Phase 5: Recovery

#### Step 1: Monitor Closely

- Watch for 24-48 hours post-fix
- Be ready for quick rollback

#### Step 2: Close Incident

```
INCIDENT RESOLVED

Summary: [What happened]
Resolution: [How it was fixed]
Duration: [Total time]
Impact: [Final impact assessment]
Next Steps: RCA scheduled for [DATE]
```

---

## Communication Templates

### Internal - Incident Declared

```
@channel INCIDENT DECLARED - P[X]

Summary: [Brief description]
Impact: [Who/what affected]
Status: Investigating

IC: [Name]
Updates: Every [15/30/60] minutes

Do not make changes without IC approval.
```

### Internal - Update

```
INCIDENT UPDATE - P[X] - [HH:MM UTC]

Status: [Investigating/Mitigating/Resolved]
Summary: [Current understanding]
Next Steps: [What we're doing]
ETA: [If known]
```

### Internal - Resolved

```
INCIDENT RESOLVED - P[X]

Duration: [X hours Y minutes]
Root Cause: [Brief explanation]
Resolution: [What fixed it]
Impact: [Final impact]

RCA: Scheduled for [DATE/TIME]
Document: [Link to incident doc]
```

### External - User-Facing (if needed)

#### Status Update (Issue Ongoing)

```
We're aware of issues with BitChat Web and are actively working on a fix.
Your data is safe. Native apps (iOS/Android) are unaffected.
Updates to follow.
```

#### Status Update (Resolved)

```
BitChat Web is back to normal.
Thank you for your patience.
If you're still experiencing issues, try clearing your browser cache.
```

### External - Security Incident

**Note**: For security incidents, coordinate with security lead before external communication.

```
We discovered a security issue affecting [scope].
We have taken immediate action to [mitigation].
[X] users may be affected.

Recommended actions:
- [Action 1]
- [Action 2]

We take security seriously and are conducting a full review.
```

---

## Post-Incident Process

### Immediate (24 hours)

1. [ ] Document incident timeline
2. [ ] Preserve logs and evidence
3. [ ] Update incident tracking
4. [ ] Schedule RCA meeting

### Root Cause Analysis (48-72 hours)

See [ROLLBACK_RUNBOOK.md - Root Cause Analysis](./ROLLBACK_RUNBOOK.md#root-cause-analysis)

### Follow-Up Actions (1-2 weeks)

1. [ ] Complete action items from RCA
2. [ ] Update runbooks if needed
3. [ ] Update monitoring/alerting
4. [ ] Conduct lessons learned session
5. [ ] Share findings with team

---

## Specific Incident Playbooks

### Playbook 1: App Not Loading

**Symptoms**: Users report blank page, errors loading

**Investigation**:
```bash
# Check gateway
curl -I https://bitbrowse.eth.limo

# Check IPFS directly
curl -I https://ipfs.io/ipfs/[CID]/

# Check ENS
# Verify content hash is correct
```

**Likely Causes**:
- IPFS gateway issues
- ENS misconfiguration
- JavaScript errors
- Service worker corruption

**Resolution**:
1. If gateway issue: Try alternate gateways, contact provider
2. If ENS issue: Verify and update content hash
3. If JS error: Rollback to previous version
4. If SW issue: Deploy cache-busting update

### Playbook 2: Messages Not Sending

**Symptoms**: Messages stuck in "sending" state

**Investigation**:
```javascript
// Check console for WebSocket errors
// Check relay connectivity
// Check queue status in localStorage
```

**Likely Causes**:
- All relays down
- WebSocket connection issues
- Queue corruption
- Rate limiting

**Resolution**:
1. If relay issue: Wait for relay recovery, add more relays
2. If WebSocket: Check for blocking, try reconnection
3. If queue: Clear queue, restart app
4. If rate limit: Implement backoff

### Playbook 3: Data Corruption

**Symptoms**: App crashes, corrupted display, lost data

**Investigation**:
```javascript
// Check localStorage
Object.keys(localStorage).forEach(k => {
  try { JSON.parse(localStorage[k]); }
  catch { console.error('Corrupted:', k); }
});
```

**Likely Causes**:
- Storage quota exceeded
- Race condition in storage
- Malformed data from update
- Browser bug

**Resolution**:
1. If quota: Clear old data, implement quotas
2. If race condition: Fix code, rollback
3. If malformed: Rollback, add validation
4. If browser bug: Document, add workaround

### Playbook 4: Security Vulnerability Discovered

**Symptoms**: Security researcher report, automated scan alert

**Immediate Actions**:
1. **Assess** - Determine exploitability and impact
2. **Contain** - If exploitable, take immediate action
3. **Preserve** - Capture evidence and logs
4. **Coordinate** - Engage security lead

**For Active Exploitation**:
1. Take service offline if necessary
2. Identify and block attack source
3. Assess data exposure
4. Prepare user notification

**For Vulnerability Report**:
1. Acknowledge receipt to reporter
2. Validate the vulnerability
3. Develop and test fix
4. Deploy fix
5. Credit researcher (if desired)

### Playbook 5: DDoS/Traffic Spike

**Symptoms**: Slow response, timeouts, elevated error rate

**Note**: IPFS is inherently resilient to DDoS, but gateways can be affected.

**Investigation**:
- Check gateway status
- Check IPFS network status
- Monitor traffic patterns

**Resolution**:
1. Use multiple IPFS gateways
2. Contact gateway providers
3. Consider dedicated gateway
4. Wait for attack to subside

### Playbook 6: Privacy Leak

**Symptoms**: User data exposed, privacy violation report

**Immediate Actions**:
1. **Identify** scope of exposure
2. **Contain** the leak
3. **Assess** affected users
4. **Document** everything

**Communication**:
1. Internal notification immediately
2. User notification if required
3. Consider regulatory requirements

**Resolution**:
1. Fix the leak
2. Review for similar issues
3. Implement additional privacy controls
4. Update privacy policy if needed

---

## Incident Log Template

```markdown
# Incident: [TITLE]

## Status: [Open/Resolved]
## Severity: P[X]
## IC: [Name]

## Timeline

| Time (UTC) | Event | Actor |
|------------|-------|-------|
| HH:MM | Incident detected | |
| HH:MM | | |

## Summary
[What happened]

## Impact
- Users affected: [Number/percentage]
- Duration: [Time]
- Data impact: [None/Description]

## Root Cause
[Technical explanation]

## Resolution
[What fixed it]

## Action Items
- [ ] [Action] - Owner: [Name] - Due: [Date]

## Lessons Learned
- [Lesson 1]
```

---

## Contact Information

### Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Primary On-Call | | | |
| Secondary On-Call | | | |
| Security Lead | | | |
| Technical Lead | | | |

### External Contacts

| Service | Contact | Notes |
|---------|---------|-------|
| IPFS Pinning | | |
| ENS Support | | |
| Gateway Provider | | |

---

## Appendix

### Incident Severity Examples

**P1 - Critical**
- Application completely down
- User private keys exposed
- Active security breach
- Data loss affecting all users

**P2 - High**
- Core messaging broken
- Authentication not working
- 50%+ users affected
- Significant data loss

**P3 - Medium**
- Single feature broken
- Performance degraded 50%+
- 10-50% users affected
- Minor data issues

**P4 - Low**
- Cosmetic issues
- Minor feature bug
- < 10% users affected
- No data impact

### Useful Debugging Commands

```bash
# Check IPFS content
ipfs cat [CID]/index.html

# Check gateway headers
curl -I https://bitbrowse.eth.limo

# Check ENS resolution
# Use app.ens.domains or etherscan

# Test WebSocket connectivity
wscat -c wss://relay.damus.io
```

### Reference Links

- [IPFS Public Gateway Checker](https://ipfs.github.io/public-gateway-checker/)
- [ENS Manager](https://app.ens.domains)
- [Nostr Relay Status](https://nostr.watch)
