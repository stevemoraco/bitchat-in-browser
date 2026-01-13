/**
 * iOS Splash Screen Generation Script
 *
 * Generates all required iOS splash screens with the BitChat logo centered
 * on a dark background (#0a0a0a).
 *
 * Usage:
 *   npx ts-node scripts/generate-splash.ts
 *
 * Prerequisites:
 *   npm install --save-dev sharp @types/sharp
 *
 * Alternative: Use online tool
 *   https://progressier.com/pwa-icons-and-ios-splash-screen-generator
 */

import * as fs from 'fs';
import * as path from 'path';

// iOS splash screen sizes (portrait only - iOS rotates automatically)
const SPLASH_SIZES = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },      // iPhone SE 1st
  { width: 750, height: 1334, name: 'splash-750x1334.png' },      // iPhone 8/7/6s/6/SE
  { width: 828, height: 1792, name: 'splash-828x1792.png' },      // iPhone 11/XR
  { width: 1080, height: 2340, name: 'splash-1080x2340.png' },    // iPhone 13/12 mini
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' },    // iPhone 11 Pro/X/XS
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' },    // iPhone 14/13/12 Pro
  { width: 1179, height: 2556, name: 'splash-1179x2556.png' },    // iPhone 14 Pro
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' },    // iPhone 8 Plus
  { width: 1242, height: 2688, name: 'splash-1242x2688.png' },    // iPhone 11 Pro Max
  { width: 1284, height: 2778, name: 'splash-1284x2778.png' },    // iPhone 14 Plus/13 Pro Max
  { width: 1290, height: 2796, name: 'splash-1290x2796.png' },    // iPhone 14 Pro Max
  { width: 1536, height: 2048, name: 'splash-1536x2048.png' },    // iPad Air/9.7"
  { width: 1668, height: 2224, name: 'splash-1668x2224.png' },    // iPad Pro 10.5"
  { width: 1668, height: 2388, name: 'splash-1668x2388.png' },    // iPad Pro 11"
  { width: 2048, height: 2732, name: 'splash-2048x2732.png' },    // iPad Pro 12.9"
];

async function generateSplash() {
  // Check if sharp is available
  let sharp: typeof import('sharp') | undefined;
  try {
    sharp = await import('sharp');
  } catch {
    console.log('Sharp not installed. Printing manual instructions...');
    printManualInstructions();
    return;
  }

  const splashDir = path.join(__dirname, '../public/splash');
  const iconsDir = path.join(__dirname, '../public/icons');
  const logoPath = path.join(iconsDir, 'icon-source.svg');

  // Ensure splash directory exists
  if (!fs.existsSync(splashDir)) {
    fs.mkdirSync(splashDir, { recursive: true });
  }

  if (!fs.existsSync(logoPath)) {
    console.error('Logo source not found at:', logoPath);
    console.log('Please ensure icon-source.svg exists in public/icons/');
    return;
  }

  console.log('Generating iOS splash screens...\n');

  // Background color matching the app
  const backgroundColor = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a

  for (const splash of SPLASH_SIZES) {
    try {
      // Calculate logo size (about 25% of screen width)
      const logoSize = Math.round(Math.min(splash.width, splash.height) * 0.25);

      // Create the logo at the right size
      const logo = await sharp(logoPath)
        .resize(logoSize, logoSize)
        .png()
        .toBuffer();

      // Calculate position to center the logo
      const left = Math.round((splash.width - logoSize) / 2);
      const top = Math.round((splash.height - logoSize) / 2);

      // Create splash with centered logo
      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 4,
          background: backgroundColor,
        },
      })
        .composite([
          {
            input: logo,
            left,
            top,
          },
        ])
        .png()
        .toFile(path.join(splashDir, splash.name));

      console.log(`  Generated: ${splash.name} (${splash.width}x${splash.height})`);
    } catch (error) {
      console.error(`  Error generating ${splash.name}:`, error);
    }
  }

  console.log('\nSplash screen generation complete!');
}

function printManualInstructions() {
  console.log(`
================================================================================
                     iOS SPLASH SCREEN GENERATION INSTRUCTIONS
================================================================================

Since 'sharp' is not installed, generate splash screens manually:

OPTION 1: Use Online Generator (Recommended)
---------------------------------------------
1. Go to https://progressier.com/pwa-icons-and-ios-splash-screen-generator
2. Upload your icon (public/icons/icon-source.svg or a 512x512 PNG)
3. Set background color to #0a0a0a
4. Download and extract to public/splash/

OPTION 2: Create a Simple Splash SVG
-------------------------------------
Create an SVG template that can be converted to various sizes:

<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1170 2532">
  <rect width="1170" height="2532" fill="#0a0a0a"/>
  <!-- Centered icon reference -->
  <image x="435" y="1116" width="300" height="300"
         href="./icon-source.svg"/>
</svg>

Then convert to PNG using ImageMagick or Inkscape for each size.

OPTION 3: Use ImageMagick
-------------------------
Create a basic splash (logo centered on dark background):

cd public/splash

# For each size:
convert -size 1170x2532 xc:"#0a0a0a" \\
  \\( ../icons/icon-source.svg -resize 300x300 \\) \\
  -gravity center -composite splash-1170x2532.png

================================================================================
                           REQUIRED SPLASH SCREENS
================================================================================

After generation, verify these files exist in public/splash/:

splash-640x1136.png      # iPhone SE 1st gen
splash-750x1334.png      # iPhone 8/7/6s/6/SE 2-3
splash-828x1792.png      # iPhone 11/XR
splash-1080x2340.png     # iPhone 13/12 mini
splash-1125x2436.png     # iPhone 11 Pro/X/XS
splash-1170x2532.png     # iPhone 14/13/12 Pro
splash-1179x2556.png     # iPhone 14 Pro
splash-1242x2208.png     # iPhone 8 Plus
splash-1242x2688.png     # iPhone 11 Pro Max
splash-1284x2778.png     # iPhone 14 Plus/13 Pro Max
splash-1290x2796.png     # iPhone 14 Pro Max
splash-1536x2048.png     # iPad Air/9.7"
splash-1668x2224.png     # iPad Pro 10.5"
splash-1668x2388.png     # iPad Pro 11"
splash-2048x2732.png     # iPad Pro 12.9"

================================================================================
`);
}

// Run the script
generateSplash().catch(console.error);
