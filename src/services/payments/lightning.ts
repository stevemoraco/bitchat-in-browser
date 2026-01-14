/**
 * Lightning Service for BitChat
 *
 * Handles detection, parsing, and interaction with Lightning Network invoices (BOLT11).
 * Supports WebLN for in-browser payments and provides USD conversion.
 */

// ============================================================================
// Types
// ============================================================================

export interface LightningInvoice {
  /** The full invoice string (payment request) */
  paymentRequest: string;
  /** Amount in millisatoshis */
  amount: number;
  /** Amount in satoshis */
  amountSats: number;
  /** Invoice description/memo */
  description: string;
  /** Expiry timestamp (Unix seconds) */
  expiry: number;
  /** Whether the invoice has expired */
  isExpired: boolean;
  /** Payment hash (hex) */
  paymentHash?: string;
  /** Network type */
  network: 'mainnet' | 'testnet' | 'regtest';
}

export interface WebLNProvider {
  enable: () => Promise<void>;
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
  makeInvoice?: (args: { amount: number; defaultMemo?: string }) => Promise<{ paymentRequest: string }>;
  getInfo?: () => Promise<{ node: { alias: string; pubkey: string } }>;
}

// Extend Window interface for WebLN
declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Regex to detect Lightning invoices in text */
const INVOICE_REGEX = /\b(lnbc|lntb|lnbcrt)[a-z0-9]+/gi;

/** BOLT11 multipliers for amount parsing */
const AMOUNT_MULTIPLIERS: Record<string, number> = {
  m: 100000000, // milli (0.001 BTC = 100,000 sats)
  u: 100000,    // micro (0.000001 BTC = 100 sats)
  n: 100,       // nano (0.000000001 BTC = 0.1 sats)
  p: 0.1,       // pico (0.000000000001 BTC = 0.0001 sats)
};

/** Default expiry in seconds (1 hour) */
const DEFAULT_EXPIRY = 3600;

/** Cache duration for USD rate (5 minutes) */
const RATE_CACHE_DURATION_MS = 5 * 60 * 1000;

/** CoinGecko API endpoint */
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

// Bech32 charset for decoding
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// ============================================================================
// LightningService Class
// ============================================================================

class LightningServiceClass {
  private usdRateCache: { rate: number; timestamp: number } | null = null;
  private rateFetchPromise: Promise<number> | null = null;

  // --------------------------------------------------------------------------
  // Invoice Detection
  // --------------------------------------------------------------------------

  /**
   * Detect if text contains a Lightning invoice.
   * Returns the first invoice found, or null if none.
   */
  detectInvoice(text: string): string | null {
    INVOICE_REGEX.lastIndex = 0;
    const match = INVOICE_REGEX.exec(text);
    return match ? match[0].toLowerCase() : null;
  }

  /**
   * Detect all Lightning invoices in text.
   * Returns array of invoice strings.
   */
  detectAllInvoices(text: string): string[] {
    INVOICE_REGEX.lastIndex = 0;
    const matches: string[] = [];
    let match;
    while ((match = INVOICE_REGEX.exec(text)) !== null) {
      matches.push(match[0].toLowerCase());
    }
    return [...new Set(matches)]; // Deduplicate
  }

  /**
   * Check if a string looks like a valid Lightning invoice.
   */
  isValidInvoiceFormat(invoice: string): boolean {
    const lower = invoice.toLowerCase();
    return (
      (lower.startsWith('lnbc') ||
        lower.startsWith('lntb') ||
        lower.startsWith('lnbcrt')) &&
      invoice.length >= 90 // Minimum reasonable length
    );
  }

  // --------------------------------------------------------------------------
  // Invoice Parsing (Lightweight BOLT11 decoder)
  // --------------------------------------------------------------------------

  /**
   * Parse a BOLT11 Lightning invoice.
   * Returns parsed invoice data or null if invalid.
   */
  parseInvoice(invoice: string): LightningInvoice | null {
    try {
      const lower = invoice.toLowerCase();

      // Determine network
      let network: 'mainnet' | 'testnet' | 'regtest';
      let prefix: string;

      if (lower.startsWith('lnbcrt')) {
        network = 'regtest';
        prefix = 'lnbcrt';
      } else if (lower.startsWith('lnbc')) {
        network = 'mainnet';
        prefix = 'lnbc';
      } else if (lower.startsWith('lntb')) {
        network = 'testnet';
        prefix = 'lntb';
      } else {
        return null;
      }

      // Find the separator (last '1' before checksum)
      const lastOne = lower.lastIndexOf('1');
      if (lastOne < prefix.length || lastOne === lower.length - 1) {
        return null;
      }

      const hrp = lower.slice(0, lastOne);
      const data = lower.slice(lastOne + 1);

      // Parse amount from HRP (human readable part)
      const amountPart = hrp.slice(prefix.length);
      const { amountMsat, amountSats } = this.parseAmount(amountPart);

      // Decode bech32 data part
      const decoded = this.decodeBech32Data(data);
      if (!decoded) {
        return null;
      }

      // Parse tagged fields
      const { description, expiry, paymentHash } = this.parseTaggedFields(decoded);

      // Calculate expiry timestamp
      const timestamp = this.extractTimestamp(decoded);
      const expiryTime = timestamp + (expiry || DEFAULT_EXPIRY);
      const isExpired = Date.now() / 1000 > expiryTime;

      return {
        paymentRequest: invoice,
        amount: amountMsat,
        amountSats,
        description: description || '',
        expiry: expiryTime,
        isExpired,
        paymentHash,
        network,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse amount from invoice HRP.
   * Returns amount in millisatoshis and satoshis.
   */
  private parseAmount(amountPart: string): { amountMsat: number; amountSats: number } {
    if (!amountPart) {
      return { amountMsat: 0, amountSats: 0 };
    }

    // Check for multiplier suffix
    const lastChar = amountPart.slice(-1);
    const multiplier = AMOUNT_MULTIPLIERS[lastChar];

    if (multiplier) {
      const numPart = amountPart.slice(0, -1);
      const amount = parseFloat(numPart);
      if (isNaN(amount)) {
        return { amountMsat: 0, amountSats: 0 };
      }
      const amountSats = Math.round(amount * multiplier);
      return { amountMsat: amountSats * 1000, amountSats };
    }

    // No multiplier - assume satoshis
    const amount = parseInt(amountPart, 10);
    if (isNaN(amount)) {
      return { amountMsat: 0, amountSats: 0 };
    }

    return { amountMsat: amount * 1000, amountSats: amount };
  }

  /**
   * Decode bech32 data part to 5-bit array.
   */
  private decodeBech32Data(data: string): number[] | null {
    const result: number[] = [];
    for (const char of data) {
      const value = BECH32_CHARSET.indexOf(char);
      if (value === -1) {
        return null;
      }
      result.push(value);
    }
    // Remove checksum (last 6 values)
    return result.slice(0, -6);
  }

  /**
   * Extract Unix timestamp from decoded data.
   * First 35 bits (7 x 5-bit values) contain timestamp.
   */
  private extractTimestamp(data: number[]): number {
    if (data.length < 7) return Math.floor(Date.now() / 1000);

    let timestamp = 0;
    for (let i = 0; i < 7; i++) {
      timestamp = timestamp * 32 + (data[i] ?? 0);
    }
    return timestamp;
  }

  /**
   * Parse tagged fields from decoded invoice data.
   */
  private parseTaggedFields(data: number[]): {
    description: string;
    expiry: number;
    paymentHash: string | undefined;
  } {
    let description = '';
    let expiry = DEFAULT_EXPIRY;
    let paymentHash: string | undefined;

    // Skip timestamp (first 7 5-bit values)
    let pos = 7;

    while (pos + 3 <= data.length) {
      const type = data[pos];
      const dataLength = ((data[pos + 1] ?? 0) * 32) + (data[pos + 2] ?? 0);
      pos += 3;

      if (pos + dataLength > data.length) break;

      const fieldData = data.slice(pos, pos + dataLength);
      pos += dataLength;

      switch (type) {
        case 13: // 'd' - description
          description = this.decodeString(fieldData);
          break;
        case 23: // 'x' - expiry
          expiry = this.decodeInt(fieldData);
          break;
        case 1: // 'p' - payment hash
          paymentHash = this.decodeHex(fieldData);
          break;
      }
    }

    return { description, expiry, paymentHash };
  }

  /**
   * Decode 5-bit array to string.
   */
  private decodeString(data: number[]): string {
    // Convert 5-bit to 8-bit
    const bytes = this.convert5to8(data);
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return '';
    }
  }

  /**
   * Decode 5-bit array to integer.
   */
  private decodeInt(data: number[]): number {
    let result = 0;
    for (const val of data) {
      result = result * 32 + val;
    }
    return result;
  }

  /**
   * Decode 5-bit array to hex string.
   */
  private decodeHex(data: number[]): string {
    const bytes = this.convert5to8(data);
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert 5-bit array to 8-bit array.
   */
  private convert5to8(data: number[]): number[] {
    const result: number[] = [];
    let acc = 0;
    let bits = 0;

    for (const val of data) {
      acc = (acc << 5) | val;
      bits += 5;

      while (bits >= 8) {
        bits -= 8;
        result.push((acc >> bits) & 0xff);
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // USD Rate
  // --------------------------------------------------------------------------

  /**
   * Get current BTC/USD rate (cached, refreshed every 5 minutes).
   */
  async getUsdRate(): Promise<number> {
    const now = Date.now();

    // Return cached rate if still valid
    if (
      this.usdRateCache &&
      now - this.usdRateCache.timestamp < RATE_CACHE_DURATION_MS
    ) {
      return this.usdRateCache.rate;
    }

    // Avoid duplicate fetches
    if (this.rateFetchPromise) {
      return this.rateFetchPromise;
    }

    this.rateFetchPromise = this.fetchUsdRate();

    try {
      const rate = await this.rateFetchPromise;
      return rate;
    } finally {
      this.rateFetchPromise = null;
    }
  }

  /**
   * Fetch USD rate from CoinGecko API.
   */
  private async fetchUsdRate(): Promise<number> {
    try {
      const response = await fetch(COINGECKO_API, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { bitcoin?: { usd?: number } };
      const rate = data?.bitcoin?.usd;

      if (typeof rate !== 'number' || rate <= 0) {
        throw new Error('Invalid rate data');
      }

      // Update cache
      this.usdRateCache = { rate, timestamp: Date.now() };
      return rate;
    } catch {
      // Return last known rate or fallback
      if (this.usdRateCache) {
        return this.usdRateCache.rate;
      }
      // Fallback rate (rough estimate, will be updated on next successful fetch)
      return 60000;
    }
  }

  /**
   * Format satoshis to USD string.
   */
  formatSatsToUsd(sats: number, rate: number): string {
    if (sats <= 0 || rate <= 0) {
      return '$0.00';
    }

    const btc = sats / 100_000_000;
    const usd = btc * rate;

    if (usd < 0.01) {
      return '<$0.01';
    }

    if (usd >= 1000) {
      return `$${usd.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }

    return `$${usd.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Format satoshis with thousands separator.
   */
  formatSats(sats: number): string {
    return sats.toLocaleString('en-US');
  }

  // --------------------------------------------------------------------------
  // WebLN Integration
  // --------------------------------------------------------------------------

  /**
   * Check if WebLN is available in the browser.
   */
  isWebLNAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.webln !== 'undefined';
  }

  /**
   * Pay a Lightning invoice using WebLN.
   * Returns true if payment was successful, false otherwise.
   */
  async payWithWebLN(invoice: string): Promise<boolean> {
    if (!this.isWebLNAvailable()) {
      return false;
    }

    try {
      // Enable WebLN first (may prompt user)
      await window.webln!.enable();

      // Send payment
      const result = await window.webln!.sendPayment(invoice);

      // Check for preimage (indicates success)
      return typeof result?.preimage === 'string' && result.preimage.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get WebLN provider info if available.
   */
  async getWebLNInfo(): Promise<{ alias: string; pubkey: string } | null> {
    if (!this.isWebLNAvailable() || !window.webln?.getInfo) {
      return null;
    }

    try {
      const webln = window.webln;
      if (!webln || !webln.getInfo) {
        return null;
      }
      await webln.enable();
      const info = await webln.getInfo();
      return info?.node ?? null;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Get time remaining until invoice expires.
   * Returns human-readable string.
   */
  getExpiryString(expiry: number): string {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expiry - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    if (remaining < 60) {
      return `${remaining}s`;
    }

    if (remaining < 3600) {
      const minutes = Math.floor(remaining / 60);
      return `${minutes}m`;
    }

    if (remaining < 86400) {
      const hours = Math.floor(remaining / 3600);
      return `${hours}h`;
    }

    const days = Math.floor(remaining / 86400);
    return `${days}d`;
  }

  /**
   * Check if invoice is close to expiring (< 10 minutes).
   */
  isCloseToExpiry(expiry: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expiry - now;
    return remaining > 0 && remaining < 600; // 10 minutes
  }

  /**
   * Copy invoice to clipboard.
   */
  async copyToClipboard(invoice: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(invoice);
      return true;
    } catch {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = invoice;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch {
        return false;
      }
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const LightningService = new LightningServiceClass();
export default LightningService;
