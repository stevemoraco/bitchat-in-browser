/**
 * Icon Generation Script
 *
 * This script generates all required PWA icons from SVG sources.
 * Uses sharp for image processing.
 *
 * Usage:
 *   npx ts-node scripts/generate-icons.ts
 *
 * Or add to package.json scripts:
 *   "generate:icons": "ts-node scripts/generate-icons.ts"
 *
 * Prerequisites:
 *   npm install --save-dev sharp @types/sharp
 *
 * Alternatively, use online tools or CLI tools to convert SVGs:
 *   - https://realfavicongenerator.net/
 *   - ImageMagick: convert icon.svg -resize 512x512 icon-512.png
 *   - Inkscape: inkscape --export-type=png --export-width=512 icon.svg
 */

import * as fs from 'fs';
import * as path from 'path';

// Icon configuration
const ICON_CONFIGS = [
  // Standard icons
  { source: 'icon-source.svg', output: 'icon-192.png', size: 192 },
  { source: 'icon-source.svg', output: 'icon-512.png', size: 512 },

  // Maskable icons (with safe area)
  { source: 'icon-maskable-source.svg', output: 'icon-maskable-192.png', size: 192 },
  { source: 'icon-maskable-source.svg', output: 'icon-maskable-512.png', size: 512 },

  // Apple touch icon
  { source: 'icon-source.svg', output: 'apple-touch-icon.png', size: 180 },

  // Shortcut icons
  { source: 'shortcut-channels.svg', output: 'shortcut-channels.png', size: 96 },
  { source: 'shortcut-messages.svg', output: 'shortcut-messages.png', size: 96 },
  { source: 'shortcut-peers.svg', output: 'shortcut-peers.png', size: 96 },
];

// Favicon sizes for .ico file
const FAVICON_SIZES = [16, 32, 48];

async function generateIcons() {
  // Check if sharp is available
  let sharp: typeof import('sharp') | undefined;
  try {
    sharp = await import('sharp');
  } catch {
    console.log('Sharp not installed. Using manual instructions...');
    printManualInstructions();
    return;
  }

  const iconsDir = path.join(__dirname, '../public/icons');
  const publicDir = path.join(__dirname, '../public');

  console.log('Generating PWA icons...\n');

  // Generate PNG icons
  for (const config of ICON_CONFIGS) {
    const sourcePath = path.join(iconsDir, config.source);
    const outputPath = path.join(iconsDir, config.output);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  Warning: Source file not found: ${config.source}`);
      continue;
    }

    try {
      await sharp(sourcePath)
        .resize(config.size, config.size)
        .png()
        .toFile(outputPath);
      console.log(`  Generated: ${config.output} (${config.size}x${config.size})`);
    } catch (error) {
      console.error(`  Error generating ${config.output}:`, error);
    }
  }

  // Generate favicon.ico (multi-size ICO)
  console.log('\nGenerating favicon.ico...');
  try {
    const faviconBuffers = await Promise.all(
      FAVICON_SIZES.map(size =>
        sharp(path.join(iconsDir, 'icon-source.svg'))
          .resize(size, size)
          .png()
          .toBuffer()
      )
    );

    // Note: sharp doesn't directly create .ico files
    // For now, we'll create a 32x32 PNG and note that a proper .ico should be generated
    await sharp(path.join(iconsDir, 'icon-source.svg'))
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.png'));

    console.log('  Generated: favicon.png (use online tool for .ico conversion)');
    console.log('  Tip: Use https://realfavicongenerator.net/ for proper favicon.ico');
  } catch (error) {
    console.error('  Error generating favicon:', error);
  }

  console.log('\nIcon generation complete!');
  console.log('\nNext steps:');
  console.log('1. Convert favicon.png to favicon.ico using a tool like:');
  console.log('   - https://favicon.io/favicon-converter/');
  console.log('   - https://realfavicongenerator.net/');
  console.log('2. Generate splash screens for iOS using:');
  console.log('   - https://progressier.com/pwa-icons-and-ios-splash-screen-generator');
}

function printManualInstructions() {
  console.log(`
================================================================================
                          PWA ICON GENERATION INSTRUCTIONS
================================================================================

Since 'sharp' is not installed, please generate icons manually using one of these methods:

METHOD 1: Online Tools (Recommended)
-------------------------------------
1. Go to https://realfavicongenerator.net/
2. Upload public/icons/icon-source.svg
3. Download the generated package
4. Extract icons to public/icons/

Or use: https://progressier.com/pwa-icons-and-ios-splash-screen-generator

METHOD 2: Using ImageMagick (if installed)
------------------------------------------
cd public/icons

# Standard icons
convert icon-source.svg -resize 192x192 icon-192.png
convert icon-source.svg -resize 512x512 icon-512.png
convert icon-source.svg -resize 180x180 apple-touch-icon.png

# Maskable icons
convert icon-maskable-source.svg -resize 192x192 icon-maskable-192.png
convert icon-maskable-source.svg -resize 512x512 icon-maskable-512.png

# Shortcut icons
convert shortcut-channels.svg -resize 96x96 shortcut-channels.png
convert shortcut-messages.svg -resize 96x96 shortcut-messages.png
convert shortcut-peers.svg -resize 96x96 shortcut-peers.png

# Favicon (in public folder)
convert icon-source.svg -resize 32x32 ../favicon.ico

METHOD 3: Using Inkscape (if installed)
---------------------------------------
cd public/icons

inkscape --export-type=png --export-width=192 icon-source.svg -o icon-192.png
inkscape --export-type=png --export-width=512 icon-source.svg -o icon-512.png
# ... repeat for other sizes

METHOD 4: Install sharp and run this script
-------------------------------------------
npm install --save-dev sharp @types/sharp
npx ts-node scripts/generate-icons.ts

================================================================================
                              REQUIRED ICONS CHECKLIST
================================================================================

After generation, verify these files exist:

public/
  favicon.ico                    # Multi-size favicon (16, 32, 48)
  icons/
    icon-192.png                 # Standard 192x192
    icon-512.png                 # Standard 512x512
    icon-maskable-192.png        # Maskable 192x192
    icon-maskable-512.png        # Maskable 512x512
    apple-touch-icon.png         # Apple 180x180
    shortcut-channels.png        # Shortcut 96x96
    shortcut-messages.png        # Shortcut 96x96
    shortcut-peers.png           # Shortcut 96x96

================================================================================
`);
}

// Run the script
generateIcons().catch(console.error);
