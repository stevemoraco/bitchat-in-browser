# Deployment Wallet Setup Guide

This guide explains how to set up the required credentials and wallets for deploying BitChat In Browser to IPFS and updating the ENS content hash.

## Overview

BitChat In Browser uses a decentralized hosting architecture:
- **IPFS**: Content is pinned to multiple IPFS providers for redundancy
- **ENS**: `bitbrowse.eth` points to the IPFS content via a content hash

## Required Credentials

### 1. Pinata (Primary IPFS Provider)

Pinata is a professional IPFS pinning service that ensures content availability.

#### Getting a Pinata JWT Token

1. Go to [pinata.cloud](https://www.pinata.cloud/)
2. Create an account or sign in
3. Navigate to **API Keys** in the dashboard
4. Click **New Key**
5. Configure the key:
   - Name: `bitchat-deploy`
   - Permissions: Select `pinFileToIPFS` and `pinList`
6. Click **Create Key**
7. Copy the **JWT** token (not the API key/secret)

#### Pricing

Pinata offers:
- **Free tier**: 100 pins, 1GB storage
- **Paid plans**: Starting at $20/month for professional use

### 2. web3.storage (Backup IPFS Provider)

web3.storage provides free, decentralized storage through the Filecoin network.

#### Getting a web3.storage Token

1. Go to [web3.storage](https://web3.storage/)
2. Create an account using your email or GitHub
3. Navigate to **Account** -> **API Tokens**
4. Click **Create an API Token**
5. Name it `bitchat-deploy`
6. Copy the generated token

#### Pricing

web3.storage offers:
- **Free tier**: 5GB storage with no pin limits
- Backed by Filecoin for long-term persistence

### 3. ENS Private Key (For Automatic Updates)

To enable automatic ENS content hash updates, you need the private key of the wallet that owns `bitbrowse.eth`.

#### Security Considerations

**IMPORTANT**: The ENS private key has control over the ENS name and any associated funds. Use a dedicated deployment wallet.

#### Recommended Setup

1. **Create a Dedicated Deployment Wallet**
   - Use a new wallet exclusively for deployments
   - Only keep minimal ETH for gas fees (0.01-0.05 ETH)
   - Never use a wallet with significant funds

2. **Transfer ENS Ownership** (if needed)
   - Transfer `bitbrowse.eth` to the deployment wallet
   - Or set the deployment wallet as an approved operator

3. **Export the Private Key**
   - From MetaMask: Settings -> Security & Privacy -> Reveal Secret Recovery Phrase
   - From hardware wallet: Use the wallet's export functionality

   **WARNING**: Never share or expose this key publicly.

### 4. Ethereum RPC URL (Optional)

For better reliability, use a dedicated RPC endpoint.

#### Free RPC Providers

- **Infura**: https://infura.io/ (free tier: 100k requests/day)
- **Alchemy**: https://www.alchemy.com/ (free tier: 300M compute units/month)
- **QuickNode**: https://www.quicknode.com/ (free tier available)

#### Default Fallback

If no RPC URL is provided, the script uses public endpoints which may have rate limits.

## GitHub Secrets Configuration

Add these secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** -> **Secrets and variables** -> **Actions**
3. Click **New repository secret** for each:

| Secret Name | Description | Required |
|------------|-------------|----------|
| `PINATA_JWT` | Pinata JWT token | Yes |
| `WEB3_STORAGE_TOKEN` | web3.storage API token | Recommended |
| `ENS_PRIVATE_KEY` | Private key for ENS updates | Optional |
| `ETH_RPC_URL` | Ethereum mainnet RPC URL | Optional |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |

## Manual Deployment

### Deploy to IPFS

```bash
# Set environment variables
export PINATA_JWT="your-pinata-jwt-token"
export WEB3_STORAGE_TOKEN="your-web3storage-token"

# Build the application
npm run build

# Deploy to IPFS
npm run deploy:ipfs
```

### Update ENS Content Hash

#### Option A: Using ENS Manager App (Recommended)

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect the wallet that owns `bitbrowse.eth`
3. Search for `bitbrowse.eth`
4. Click **Records** -> **Edit**
5. Find **Content Hash**
6. Enter: `ipfs://<CID>` (replace with actual CID from deployment)
7. Click **Confirm** and sign the transaction
8. Wait for confirmation (1-2 minutes)
9. Verify at [bitbrowse.eth.limo](https://bitbrowse.eth.limo)

#### Option B: Using Command Line

```bash
# Set environment variables
export ENS_PRIVATE_KEY="your-private-key"
export RPC_URL="https://eth.llamarpc.com"  # or your preferred RPC

# Update ENS (replace with actual CID)
npx tsx scripts/update-ens.ts bafybeif... --update
```

## Automated Deployment (GitHub Actions)

### Automatic IPFS Deployment

Every push to `main` triggers:
1. Build verification
2. IPFS upload to Pinata (and web3.storage if configured)
3. Gateway verification
4. Deployment summary

### Manual ENS Update

To automatically update ENS after deployment:

1. Go to **Actions** -> **Deploy to IPFS**
2. Click **Run workflow**
3. Check **Auto-update ENS content hash**
4. Click **Run workflow**

This requires `ENS_PRIVATE_KEY` to be configured.

## Verification

### Verify IPFS Deployment

After deployment, verify content is accessible via:

- `https://<CID>.ipfs.dweb.link`
- `https://<CID>.ipfs.cf-ipfs.com`
- `https://gateway.pinata.cloud/ipfs/<CID>`
- `https://ipfs.io/ipfs/<CID>`

### Verify ENS Resolution

After ENS update:

1. Check [bitbrowse.eth.limo](https://bitbrowse.eth.limo)
2. Verify the app loads correctly
3. Check that version matches the deployment

Note: ENS updates may take 5-10 minutes to propagate.

## Troubleshooting

### Pinata Upload Fails

- Verify JWT token is correct and not expired
- Check Pinata dashboard for usage limits
- Ensure `dist/` directory exists and contains files

### web3.storage Upload Fails

- Verify API token is valid
- Check web3.storage status page for outages
- Ensure files are under size limits

### ENS Update Fails

- Verify wallet has sufficient ETH for gas
- Confirm wallet owns or can manage the ENS name
- Check Ethereum network is not congested
- Verify RPC URL is responsive

### Gateway Access Issues

- Allow 1-5 minutes for IPFS propagation
- Try multiple gateways
- Check if CID is being pinned (via Pinata dashboard)

## Security Best Practices

1. **Use Environment Variables**: Never commit secrets to the repository
2. **Rotate Keys Regularly**: Update API tokens periodically
3. **Minimal Permissions**: Use the minimum required permissions for API keys
4. **Dedicated Wallet**: Use a separate wallet for deployments
5. **Monitor Activity**: Set up alerts for ENS changes on Etherscan
6. **Backup Keys**: Store encrypted backups of critical keys securely

## Cost Estimates

| Service | Free Tier | Typical Monthly Cost |
|---------|-----------|---------------------|
| Pinata | 100 pins, 1GB | $0-20 |
| web3.storage | 5GB | $0 |
| ENS Updates | N/A | ~$2-10 per update (gas) |
| Ethereum RPC | Varies | $0 (free tiers) |

Total monthly cost: **$0-30** depending on update frequency and tier.

## References

- [Pinata Documentation](https://docs.pinata.cloud/)
- [web3.storage Documentation](https://web3.storage/docs/)
- [ENS Documentation](https://docs.ens.domains/)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
