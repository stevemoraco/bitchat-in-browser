#!/usr/bin/env npx tsx

/**
 * ENS Content Hash Update Script for BitChat In Browser
 *
 * This script provides instructions and optional programmatic update
 * for the ENS content hash of bitbrowse.eth
 *
 * Usage:
 *   npx tsx scripts/update-ens.ts <CID>           # Show update instructions
 *   npx tsx scripts/update-ens.ts <CID> --update  # Update ENS (requires private key)
 *
 * Environment Variables (for --update):
 *   ENS_PRIVATE_KEY - Private key of wallet that owns bitbrowse.eth
 *   RPC_URL - Ethereum RPC URL (default: mainnet public RPC)
 */

// Import ethers only if needed for actual update
// Note: ethers is optional - the script works without it for instructions

const ENS_NAME = 'bitbrowse.eth';
const ENS_RESOLVER_ADDRESS = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63'; // Public Resolver 2

interface ContentHashInfo {
  cid: string;
  contentHash: string;
  ensFormat: string;
}

/**
 * Convert an IPFS CID to ENS content hash format
 * CIDv0 (Qm...) and CIDv1 (bafy...) are handled differently
 */
function formatContentHash(cid: string): ContentHashInfo {
  // For ENS, we use the ipfs:// URI format
  const ensFormat = `ipfs://${cid}`;

  // The actual content hash stored on-chain is a multihash
  // This requires proper encoding with the IPFS codec
  // For now, we provide the URI format for manual updates

  return {
    cid,
    contentHash: ensFormat,
    ensFormat,
  };
}

/**
 * Verify that the CID is accessible
 */
async function verifyCID(cid: string): Promise<boolean> {
  console.log(`\nVerifying CID: ${cid}`);

  const gateways = [
    `https://${cid}.ipfs.dweb.link`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://${cid}.ipfs.cf-ipfs.com`,
  ];

  for (const gateway of gateways) {
    try {
      console.log(`  Checking: ${gateway}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(gateway, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        console.log(`  CID verified via: ${gateway}`);
        return true;
      }
    } catch {
      // Continue to next gateway
    }
  }

  console.log('  Warning: Could not verify CID via any gateway');
  return false;
}

/**
 * Print manual update instructions
 */
function printInstructions(info: ContentHashInfo): void {
  console.log('\n========================================');
  console.log('ENS Content Hash Update Instructions');
  console.log('========================================');
  console.log(`\nENS Name: ${ENS_NAME}`);
  console.log(`IPFS CID: ${info.cid}`);
  console.log(`Content Hash: ${info.ensFormat}`);

  console.log('\n--- Option 1: ENS Manager App (Recommended) ---');
  console.log('1. Go to https://app.ens.domains');
  console.log('2. Connect the wallet that owns bitbrowse.eth');
  console.log(`3. Search for "${ENS_NAME}"`);
  console.log('4. Click on the name to view details');
  console.log('5. Go to "Records" tab');
  console.log('6. Click "Edit Records"');
  console.log('7. Find "Content Hash" field');
  console.log(`8. Enter: ${info.ensFormat}`);
  console.log('9. Click "Confirm" and sign the transaction');
  console.log('10. Wait for transaction confirmation');

  console.log('\n--- Option 2: Etherscan (Advanced) ---');
  console.log(`1. Go to the ENS resolver contract on Etherscan:`);
  console.log(`   https://etherscan.io/address/${ENS_RESOLVER_ADDRESS}#writeContract`);
  console.log('2. Connect wallet via "Connect to Web3"');
  console.log('3. Find "setContenthash" function');
  console.log(`4. Enter namehash for "${ENS_NAME}"`);
  console.log('5. Enter the encoded content hash');
  console.log('6. Submit transaction');

  console.log('\n--- Option 3: Programmatic Update ---');
  console.log('Set the following environment variables:');
  console.log('  ENS_PRIVATE_KEY=<your-private-key>');
  console.log('  RPC_URL=<ethereum-rpc-url> (optional)');
  console.log(`Then run: npx tsx scripts/update-ens.ts ${info.cid} --update`);

  console.log('\n--- Verification ---');
  console.log('After updating, verify at:');
  console.log(`  https://bitbrowse.eth.limo`);
  console.log(`  https://${info.cid}.ipfs.dweb.link`);
  console.log('\nNote: ENS resolver updates may take a few minutes to propagate.');
  console.log('========================================\n');
}

/**
 * Programmatically update ENS content hash using ethers.js
 * This requires the ENS_PRIVATE_KEY environment variable
 */
async function updateENS(cid: string): Promise<void> {
  const privateKey = process.env.ENS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: ENS_PRIVATE_KEY environment variable is required for --update');
    console.log('\nTo update ENS programmatically, set:');
    console.log('  export ENS_PRIVATE_KEY=<private-key-with-ens-ownership>');
    console.log('\nAlternatively, follow the manual instructions above.');
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || 'https://eth.llamarpc.com';

  console.log('\n--- Programmatic ENS Update ---');
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`ENS Name: ${ENS_NAME}`);
  console.log(`New CID: ${cid}`);

  try {
    // Dynamic import of ethers
    const { ethers } = await import('ethers');

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Wallet Address: ${wallet.address}`);

    // Get the resolver for the ENS name
    const ensResolver = await provider.getResolver(ENS_NAME);

    if (!ensResolver) {
      throw new Error(`No resolver found for ${ENS_NAME}`);
    }

    console.log(`Resolver Address: ${ensResolver.address}`);

    // Create content hash from CID
    // Note: This requires proper encoding of the IPFS CID
    // The content hash format is: /ipfs/<cid>

    // For IPFS, we need to encode the CID properly
    // This is a simplified version - production should use content-hash library
    const contentHash = ethers.toUtf8Bytes(`/ipfs/${cid}`);

    console.log('\nPreparing transaction...');

    // Get the namehash
    const namehash = ethers.namehash(ENS_NAME);
    console.log(`Namehash: ${namehash}`);

    // Create resolver contract interface
    const resolverABI = [
      'function setContenthash(bytes32 node, bytes calldata hash) external',
      'function contenthash(bytes32 node) external view returns (bytes memory)',
    ];

    const resolverContract = new ethers.Contract(
      ensResolver.address,
      resolverABI,
      wallet
    );

    // Send transaction
    console.log('Sending transaction...');
    const tx = await resolverContract.setContenthash(namehash, contentHash);
    console.log(`Transaction hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    console.log('\n========================================');
    console.log('ENS Update Complete!');
    console.log('========================================');
    console.log(`Transaction: https://etherscan.io/tx/${tx.hash}`);
    console.log(`Verify at: https://${ENS_NAME.replace('.eth', '')}.eth.limo`);
    console.log('\nNote: Changes may take a few minutes to propagate.');

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      console.error('\nError: ethers package not installed');
      console.log('Install with: npm install ethers');
      console.log('\nOr follow the manual instructions above.');
    } else {
      console.error('\nError updating ENS:', error);
    }
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: npx tsx scripts/update-ens.ts <CID> [--update]');
    console.log('');
    console.log('Arguments:');
    console.log('  CID        IPFS Content Identifier to set as content hash');
    console.log('  --update   Actually perform the ENS update (requires ENS_PRIVATE_KEY)');
    console.log('');
    console.log('Environment Variables (for --update):');
    console.log('  ENS_PRIVATE_KEY   Private key of wallet that owns bitbrowse.eth');
    console.log('  RPC_URL           Ethereum RPC URL (default: public endpoint)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/update-ens.ts QmXyz123...           # Show instructions');
    console.log('  npx tsx scripts/update-ens.ts bafyabc... --update   # Update ENS');
    process.exit(0);
  }

  const cid = args[0];
  const shouldUpdate = args.includes('--update');

  // Validate CID format (basic check)
  if (!cid.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{55,59})$/)) {
    console.warn('Warning: CID format may be invalid. Expected Qm... (v0) or bafy... (v1)');
  }

  // Format content hash
  const info = formatContentHash(cid);

  // Verify CID is accessible
  await verifyCID(cid);

  if (shouldUpdate) {
    await updateENS(cid);
  } else {
    printInstructions(info);
  }
}

// Run the script
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
