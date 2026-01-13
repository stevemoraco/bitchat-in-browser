# Security Policy

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

If you discover a security vulnerability in BitChat In Browser, please report it privately:

1. **Email**: Send details to [security@bitchat.app] (replace with actual contact)
2. **PGP Key**: Available at [keybase.io/bitchat] (replace with actual key location)

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

We aim to acknowledge reports within 48 hours and provide a detailed response within 7 days.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Security Model

### Threat Model

BitChat In Browser is designed to protect against:

1. **Network Attackers**: Eavesdroppers on network traffic
2. **Malicious Relays**: Nostr relays that may attempt to manipulate messages
3. **Data Breach**: Unauthorized access to stored data
4. **XSS Attacks**: Cross-site scripting attempts
5. **Tracking**: Third-party surveillance and analytics

### Trust Boundaries

- **Client-side**: All cryptographic operations occur in the browser
- **Relays**: Treated as untrusted; all content is encrypted before transmission
- **IPFS/ENS**: Hosting infrastructure is decentralized and censorship-resistant
- **Browser**: We trust the browser's WebCrypto API and storage mechanisms

## Security Architecture

### Cryptographic Design

#### Key Management
- **Ed25519**: Digital signatures (Nostr identity)
- **X25519**: Key exchange (Noise protocol, ECDH)
- **XChaCha20-Poly1305**: Authenticated encryption (messages)
- **Argon2id**: Password-based key derivation (storage encryption)

#### Implementation
- Uses **libsodium.js** (libsodium-wrappers-sumo) for all cryptographic operations
- No custom cryptographic implementations
- Constant-time comparisons for all security-sensitive operations
- Secure memory wiping for key material after use

### Message Security

#### Direct Messages (NIP-04/NIP-17)
- End-to-end encrypted between sender and recipient
- Uses NIP-17 (gift-wrapped messages) for enhanced metadata privacy
- Outer envelope hides sender and recipient from relays

#### Channel Messages
- Encrypted with channel-specific symmetric keys
- Key distribution managed through Nostr key exchange

### Storage Security

#### At Rest
- Private keys encrypted with user password via Argon2id + XChaCha20-Poly1305
- Salt and nonce stored alongside encrypted data
- No plaintext secrets in localStorage or IndexedDB

#### In Memory
- Private keys loaded into memory only when needed
- Secure memory wiping (memzero) when keys are no longer needed
- Keys never logged to console or error messages

### Network Security

#### Transport
- All relay connections use WSS (WebSocket Secure)
- No insecure HTTP/WS connections in production
- Certificate validation enabled

#### Privacy
- Zero analytics or tracking
- No third-party scripts
- No Google Fonts or external CDNs
- No error reporting to external services
- DNS prefetch disabled
- Strict referrer policy

### Content Security Policy

The application implements a strict CSP:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' wss: https:;
worker-src 'self' blob:;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests;
```

### Emergency Wipe

Triple-tap on the logo triggers emergency data wipe:
- Clears all localStorage and sessionStorage
- Deletes IndexedDB databases
- Clears OPFS (Origin Private File System) data
- Unregisters service workers
- Clears cache storage
- Wipes in-memory keys

## Security Testing

### Automated Tests

Run security tests with:
```bash
npm run test -- src/__security__/
```

Test suites:
- `xss.test.ts` - XSS prevention
- `crypto.test.ts` - Cryptographic security
- `storage.test.ts` - Storage security
- `network.test.ts` - Network security
- `csp.test.ts` - Content Security Policy

### Security Scanning

Run the security scanner:
```bash
npx ts-node scripts/security-scan.ts
```

This checks:
- npm audit for dependency vulnerabilities
- Source code for dangerous patterns
- Hardcoded secrets
- Tracking/analytics code
- Insecure coding practices

## Security Best Practices

### For Users

1. **Backup Your Keys**: Export your nsec and store it securely offline
2. **Use Strong Passwords**: When importing/exporting keys with password protection
3. **Verify Peer Fingerprints**: Use out-of-band verification for important contacts
4. **Keep Updated**: Use the latest version of BitChat
5. **Report Issues**: Report any suspicious behavior privately

### For Developers

1. **Never Log Keys**: Private key material must never appear in logs
2. **Sanitize All Input**: Treat all user input as potentially malicious
3. **Use Security Tests**: Run security test suite before commits
4. **Dependency Audit**: Regularly run `npm audit` and update dependencies
5. **Review Changes**: Security-sensitive changes require additional review

## Known Limitations

1. **Browser Trust**: Security depends on browser implementation
2. **Memory Safety**: JavaScript doesn't guarantee secure memory handling
3. **Side Channels**: Timing attacks may be possible in some scenarios
4. **Quantum Resistance**: Current algorithms are not quantum-resistant

## Security Changelog

### v0.1.0 (Current)
- Initial security architecture
- libsodium.js integration
- NIP-17 support for private DMs
- Emergency wipe feature
- CSP implementation

## Responsible Disclosure

We follow responsible disclosure practices:

1. **Reporter**: Submit vulnerability details privately
2. **Acknowledgment**: We acknowledge within 48 hours
3. **Investigation**: We investigate and develop a fix
4. **Notification**: We notify the reporter of our findings
5. **Release**: We release the fix and publish an advisory
6. **Credit**: We credit the reporter (if desired)

## Bug Bounty

We currently do not have a formal bug bounty program. However, we recognize and credit security researchers who responsibly disclose vulnerabilities.

## Contact

- **Security Issues**: [security@bitchat.app]
- **General Questions**: Open a GitHub issue

---

Last updated: 2025-01-12
