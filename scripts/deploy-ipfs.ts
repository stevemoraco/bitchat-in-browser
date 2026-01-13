#!/usr/bin/env npx tsx

/**
 * IPFS Deployment Script for BitChat In Browser
 *
 * Uploads the dist/ folder to IPFS via Pinata and/or web3.storage
 *
 * Usage:
 *   npx tsx scripts/deploy-ipfs.ts           # Upload to all configured providers
 *   npx tsx scripts/deploy-ipfs.ts --pinata  # Upload to Pinata only
 *   npx tsx scripts/deploy-ipfs.ts --web3storage  # Upload to web3.storage only
 *
 * Environment Variables:
 *   PINATA_JWT - JWT token for Pinata API
 *   WEB3_STORAGE_TOKEN - Token for web3.storage API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const APP_NAME = 'bitchat-in-browser';

// Pinata API configuration
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// web3.storage API configuration
const WEB3_STORAGE_API_URL = 'https://api.web3.storage';

interface UploadResult {
  cid: string;
  provider: string;
  gateway: string;
}

interface FileEntry {
  path: string;
  content: Buffer;
}

/**
 * Recursively collect all files from a directory
 */
function collectFiles(dir: string, basePath = ''): FileEntry[] {
  const files: FileEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: fs.readFileSync(fullPath),
      });
    }
  }

  return files;
}

/**
 * Create a CAR file from the dist directory for web3.storage
 * Note: This is a simplified version; in production, use @ipld/car
 */
async function createFormData(files: FileEntry[]): Promise<FormData> {
  const formData = new FormData();

  for (const file of files) {
    const blob = new Blob([file.content]);
    formData.append('file', blob, file.path);
  }

  return formData;
}

/**
 * Upload to Pinata using their pinning API
 */
async function uploadToPinata(files: FileEntry[]): Promise<UploadResult> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('PINATA_JWT environment variable is not set');
  }

  console.log(`Uploading ${files.length} files to Pinata...`);

  // Create FormData for pinning
  const formData = new FormData();

  // Add each file - use folder prefix for Pinata directory upload
  // The folder name becomes the directory in the resulting CID
  for (const file of files) {
    const blob = new Blob([file.content]);
    formData.append('file', blob, `website/${file.path}`);
  }

  // Add pinata metadata
  const metadata = JSON.stringify({
    name: `${APP_NAME}-${new Date().toISOString()}`,
    keyvalues: {
      app: APP_NAME,
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
    },
  });
  formData.append('pinataMetadata', metadata);

  // wrapWithDirectory: false means CID points to the 'website' folder directly
  // So index.html will be at CID/index.html
  const options = JSON.stringify({
    wrapWithDirectory: false,
    cidVersion: 1,
  });
  formData.append('pinataOptions', options);

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  const cid = result.IpfsHash;

  console.log(`Pinata upload successful! CID: ${cid}`);

  return {
    cid,
    provider: 'pinata',
    gateway: `${PINATA_GATEWAY}/${cid}`,
  };
}

/**
 * Upload to web3.storage
 */
async function uploadToWeb3Storage(files: FileEntry[]): Promise<UploadResult> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) {
    throw new Error('WEB3_STORAGE_TOKEN environment variable is not set');
  }

  console.log(`Uploading ${files.length} files to web3.storage...`);

  // Create FormData with all files
  const formData = new FormData();

  for (const file of files) {
    const blob = new Blob([file.content]);
    formData.append('file', blob, file.path);
  }

  const response = await fetch(`${WEB3_STORAGE_API_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`web3.storage upload failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as { cid: string };
  const cid = result.cid;

  console.log(`web3.storage upload successful! CID: ${cid}`);

  return {
    cid,
    provider: 'web3.storage',
    gateway: `https://${cid}.ipfs.dweb.link`,
  };
}

/**
 * Verify that content is accessible via IPFS gateway
 */
async function verifyGatewayAccess(cid: string): Promise<boolean> {
  const gateways = [
    `https://${cid}.ipfs.dweb.link`,
    `https://${cid}.ipfs.cf-ipfs.com`,
    `${PINATA_GATEWAY}/${cid}`,
  ];

  console.log('\nVerifying gateway access...');

  for (const gateway of gateways) {
    try {
      console.log(`  Checking: ${gateway}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(gateway, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        console.log(`  Gateway accessible: ${gateway}`);
        return true;
      }
    } catch (error) {
      console.log(`  Gateway not ready: ${gateway}`);
    }
  }

  console.log('  Note: Gateways may need time to propagate');
  return false;
}

/**
 * Generate a hash of the dist directory for verification
 */
function generateDistHash(): string {
  const files = collectFiles(DIST_DIR);
  const hash = crypto.createHash('sha256');

  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update(file.content);
  }

  return hash.digest('hex').substring(0, 16);
}

/**
 * Main deployment function
 */
async function main() {
  const args = process.argv.slice(2);
  const usePinata = args.includes('--pinata') || args.length === 0;
  const useWeb3Storage = args.includes('--web3storage') || args.length === 0;

  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  // Collect files
  const files = collectFiles(DIST_DIR);
  console.log(`Found ${files.length} files in dist/`);

  // Generate build hash
  const buildHash = generateDistHash();
  console.log(`Build hash: ${buildHash}`);

  const results: UploadResult[] = [];
  let primaryCid = '';

  // Upload to Pinata
  if (usePinata && process.env.PINATA_JWT) {
    try {
      const result = await uploadToPinata(files);
      results.push(result);
      if (!primaryCid) primaryCid = result.cid;
    } catch (error) {
      console.error('Pinata upload failed:', error);
      if (args.includes('--pinata')) {
        process.exit(1);
      }
    }
  } else if (usePinata) {
    console.log('Skipping Pinata (PINATA_JWT not set)');
  }

  // Upload to web3.storage
  if (useWeb3Storage && process.env.WEB3_STORAGE_TOKEN) {
    try {
      const result = await uploadToWeb3Storage(files);
      results.push(result);
      if (!primaryCid) primaryCid = result.cid;
    } catch (error) {
      console.error('web3.storage upload failed:', error);
      if (args.includes('--web3storage')) {
        process.exit(1);
      }
    }
  } else if (useWeb3Storage) {
    console.log('Skipping web3.storage (WEB3_STORAGE_TOKEN not set)');
  }

  // Check results
  if (results.length === 0) {
    console.error('No uploads succeeded. Set PINATA_JWT or WEB3_STORAGE_TOKEN.');
    process.exit(1);
  }

  // Verify gateway access
  if (primaryCid) {
    await verifyGatewayAccess(primaryCid);
  }

  // Print summary
  console.log('\n========================================');
  console.log('IPFS Deployment Summary');
  console.log('========================================');
  console.log(`Primary CID: ${primaryCid}`);
  console.log(`Build Hash: ${buildHash}`);
  console.log('\nUpload Results:');
  for (const result of results) {
    console.log(`  - ${result.provider}: ${result.cid}`);
    console.log(`    Gateway: ${result.gateway}`);
  }

  console.log('\n----------------------------------------');
  console.log('ENS Update Instructions:');
  console.log('----------------------------------------');
  console.log('1. Go to https://app.ens.domains');
  console.log('2. Connect wallet that owns bitbrowse.eth');
  console.log('3. Go to bitbrowse.eth -> Records');
  console.log('4. Edit Content Hash');
  console.log(`5. Set to: ipfs://${primaryCid}`);
  console.log('6. Confirm transaction');
  console.log('7. Verify at https://bitbrowse.eth.limo');
  console.log('========================================\n');

  // Output CID for GitHub Actions
  console.log(primaryCid);
}

// Run the script
main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
