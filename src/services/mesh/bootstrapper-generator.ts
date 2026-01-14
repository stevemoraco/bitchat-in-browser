/**
 * QR Bootstrapper Generator
 *
 * Generates a minimal HTML bootstrapper (~2KB) that can be embedded
 * in a QR code. When scanned, it connects to the mesh and downloads
 * the full app over WebRTC.
 */

import { directConnection } from './direct-connection';

// App version (for inclusion in bootstrapper)
const APP_VERSION = '__APP_VERSION__';

export interface BootstrapperConfig {
  offerSdp: string;
  hubPeerId: string;
  appVersion: string;
}

export interface GeneratedBootstrapper {
  html: string;
  dataUrl: string;
  size: number;
}

/**
 * Generate the minified bootstrapper HTML
 */
function generateBootstrapperHTML(config: BootstrapperConfig): string {
  // Minified bootstrapper - this needs to be as small as possible
  // to fit in a QR code (max ~2953 bytes at highest density)

  const { offerSdp, hubPeerId, appVersion } = config;

  // Encode offer as base64 (will be embedded in the bootstrapper)
  const encodedOffer = btoa(offerSdp);

  // The bootstrapper HTML - highly minified
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BitChat</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d1117;color:#c9d1d9;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}#s{text-align:center}#p{width:200px;height:4px;background:#21262d;border-radius:2px;margin:10px 0}#b{height:100%;background:#58a6ff;border-radius:2px;width:0%;transition:width .3s}#m{font-size:12px;color:#8b949e;margin-top:10px}</style></head><body><div id="s"><div>BitChat</div><div id="p"><div id="b"></div></div><div id="m">Connecting...</div></div><script>
const O="${encodedOffer}";
const H="${hubPeerId}";
const V="${appVersion}";
const L=localStorage;
(async()=>{
const $=s=>document.getElementById(s);
const M=t=>$('m').textContent=t;
const P=p=>$('b').style.width=p+'%';
// Check localStorage first
const c=L.getItem('bitchat-app');
if(c){M('Loading cached app...');P(100);setTimeout(()=>{document.open();document.write(c);document.close()},100);return}
M('Connecting to mesh...');
try{
const p=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
const d=p.createDataChannel('bootstrap');
let chunks=[];let total=0;let received=0;
d.onopen=()=>{M('Connected! Downloading app...');P(10)};
d.onmessage=e=>{
if(e.data==='__END__'){
M('Installing...');P(95);
const app=chunks.join('');
L.setItem('bitchat-app',app);
L.setItem('bitchat-version',V);
P(100);
setTimeout(()=>{document.open();document.write(app);document.close()},100)
}else if(e.data.startsWith('__META__')){
total=parseInt(e.data.split(':')[1])||100;
}else{
chunks.push(e.data);received++;
P(10+Math.floor((received/Math.max(total,1))*85))
}
};
d.onerror=()=>M('Connection error');
d.onclose=()=>{if(!chunks.length)M('Disconnected')};
await p.setRemoteDescription({type:'offer',sdp:atob(O)});
const a=await p.createAnswer();
await p.setLocalDescription(a);
// Wait for ICE gathering
await new Promise(r=>{
if(p.iceGatheringState==='complete')r();
p.onicegatheringstatechange=()=>{if(p.iceGatheringState==='complete')r()};
p.onicecandidate=e=>{if(!e.candidate)r()};
setTimeout(r,5000)
});
// Display answer for hub to scan
M('Show this to hub:');
const ans=btoa(p.localDescription.sdp);
const qr=document.createElement('div');
qr.style.cssText='background:#fff;color:#000;padding:10px;margin:10px;font-size:10px;word-break:break-all;max-width:300px;border-radius:4px';
qr.textContent=ans.slice(0,200)+'...';
$('s').appendChild(qr);
const copy=document.createElement('button');
copy.textContent='Copy Answer';
copy.style.cssText='background:#58a6ff;color:#fff;border:none;padding:8px 16px;border-radius:4px;margin:10px;cursor:pointer';
copy.onclick=()=>{navigator.clipboard.writeText(ans);copy.textContent='Copied!'};
$('s').appendChild(copy);
}catch(e){M('Error: '+e.message)}
})();
</script></body></html>`;
}

/**
 * Generate a bootstrapper for the current mesh
 */
export async function generateBootstrapper(): Promise<GeneratedBootstrapper> {
  // Create an offer for the bootstrapper to use
  const { offer, encoded } = await directConnection.createOffer();

  const config: BootstrapperConfig = {
    offerSdp: offer.sdp,
    hubPeerId: directConnection.getLocalPeerId(),
    appVersion: APP_VERSION,
  };

  const html = generateBootstrapperHTML(config);
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  return {
    html,
    dataUrl,
    size: html.length,
  };
}

/**
 * Generate a simplified bootstrapper for very small QR codes
 * This version requires the user to manually paste the answer
 */
export async function generateCompactBootstrapper(): Promise<GeneratedBootstrapper> {
  const { offer } = await directConnection.createOffer();

  // Ultra-compact version - even more minified
  const encodedOffer = btoa(offer.sdp);

  const html = `<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>BC</title></head><body style="background:#0d1117;color:#c9d1d9;font-family:monospace;padding:20px"><div id=s>Connecting...</div><script>const O="${encodedOffer}";const L=localStorage;(async()=>{const c=L.getItem('bc');if(c){document.write(c);return}const p=new RTCPeerConnection();const d=p.createDataChannel('b');let a=[];d.onmessage=e=>{if(e.data==='END'){const x=a.join('');L.setItem('bc',x);document.write(x)}else a.push(e.data)};await p.setRemoteDescription({type:'offer',sdp:atob(O)});const ans=await p.createAnswer();await p.setLocalDescription(ans);await new Promise(r=>setTimeout(r,3000));document.getElementById('s').innerHTML='Answer:<br><textarea style="width:100%;height:100px">'+btoa(p.localDescription.sdp)+'</textarea>'})();</script></body></html>`;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  return {
    html,
    dataUrl,
    size: html.length,
  };
}

/**
 * Estimate QR code capacity needed for a given data size
 */
export function estimateQRCapacity(dataSize: number): {
  level: 'L' | 'M' | 'Q' | 'H';
  version: number;
  fits: boolean;
} {
  // QR code capacity (alphanumeric mode, which is close to base64)
  // Version 40 (largest) capacities:
  // L: 4296 chars, M: 3391 chars, Q: 2420 chars, H: 1852 chars

  // For data URLs, we need to account for the prefix
  const prefix = 'data:text/html;charset=utf-8,';
  const totalSize = dataSize + prefix.length;

  // URL encoding roughly doubles the size for HTML
  const estimatedEncoded = totalSize * 1.5;

  if (estimatedEncoded <= 1852) {
    return { level: 'H', version: 40, fits: true };
  } else if (estimatedEncoded <= 2420) {
    return { level: 'Q', version: 40, fits: true };
  } else if (estimatedEncoded <= 3391) {
    return { level: 'M', version: 40, fits: true };
  } else if (estimatedEncoded <= 4296) {
    return { level: 'L', version: 40, fits: true };
  }

  return { level: 'L', version: 40, fits: false };
}

/**
 * Handle incoming bootstrapper connection
 * Called by the hub when a bootstrapped device connects
 */
export async function handleBootstrapperConnection(
  peerId: string,
  sendChunk: (data: string) => void
): Promise<void> {
  console.log('[Bootstrapper] Handling connection from:', peerId);

  // Import the app packager
  const { appPackager } = await import('./app-packager');

  // Package the app
  const bundle = await appPackager.packageApp();

  // Convert to single HTML string for bootstrapper
  // The bootstrapper expects a single HTML file with everything inlined
  const appHtml = await bundleToInlineHTML(bundle);

  // Send metadata first
  const chunkSize = 16000; // Safe size for WebRTC
  const totalChunks = Math.ceil(appHtml.length / chunkSize);
  sendChunk(`__META__:${totalChunks}`);

  // Send chunks
  for (let i = 0; i < appHtml.length; i += chunkSize) {
    const chunk = appHtml.slice(i, i + chunkSize);
    sendChunk(chunk);

    // Small delay between chunks
    await new Promise(r => setTimeout(r, 5));
  }

  // Send end marker
  sendChunk('__END__');

  console.log('[Bootstrapper] Sent app to bootstrapped device');
}

/**
 * Convert app bundle to single inline HTML
 */
async function bundleToInlineHTML(bundle: any): Promise<string> {
  // Find index.html
  const indexAsset = bundle.assets.find((a: any) =>
    a.path === '/index.html' || a.path === 'index.html' || a.path === '/'
  );

  if (!indexAsset) {
    throw new Error('No index.html found in bundle');
  }

  let html = new TextDecoder().decode(indexAsset.content);

  // Inline CSS
  for (const asset of bundle.assets) {
    if (asset.mimeType === 'text/css') {
      const css = new TextDecoder().decode(asset.content);
      const linkRegex = new RegExp(`<link[^>]*href=["']${asset.path}["'][^>]*>`, 'gi');
      html = html.replace(linkRegex, `<style>${css}</style>`);
    }
  }

  // Inline JS
  for (const asset of bundle.assets) {
    if (asset.mimeType === 'application/javascript') {
      const js = new TextDecoder().decode(asset.content);
      const scriptRegex = new RegExp(`<script[^>]*src=["']${asset.path}["'][^>]*></script>`, 'gi');
      html = html.replace(scriptRegex, `<script>${js}</script>`);
    }
  }

  return html;
}

export default {
  generateBootstrapper,
  generateCompactBootstrapper,
  estimateQRCapacity,
  handleBootstrapperConnection,
};
