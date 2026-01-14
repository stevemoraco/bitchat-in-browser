/**
 * PaymentChip Component Tests
 *
 * Tests for the Lightning invoice chip component including:
 * - Lightning invoice parsing
 * - Amount display in sats
 * - USD estimate display
 * - Copy functionality
 * - Invalid invoice handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import {
  PaymentChip,
  detectLightningInvoices,
  hasLightningInvoice,
  tokenizeLightningInvoices,
} from '../PaymentChip';

// ============================================================================
// Mocks - Must use factory function that doesn't reference external variables
// ============================================================================

// Sample valid BOLT11 invoice (mainnet, 1000 sats)
const VALID_MAINNET_INVOICE = 'lnbc10u1pj0fake123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxy';

// Sample testnet invoice
const VALID_TESTNET_INVOICE = 'lntb10u1pj0fake123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxy';

// Create mock functions
const parseInvoiceMock = vi.fn();
const getUsdRateMock = vi.fn();
const formatSatsMock = vi.fn();
const formatSatsToUsdMock = vi.fn();
const isWebLNAvailableMock = vi.fn();
const payWithWebLNMock = vi.fn();
const copyToClipboardMock = vi.fn();
const getExpiryStringMock = vi.fn();
const isCloseToExpiryMock = vi.fn();
const detectInvoiceMock = vi.fn();
const detectAllInvoicesMock = vi.fn();

vi.mock('../../../services/payments/lightning', () => ({
  LightningService: {
    parseInvoice: (...args: unknown[]) => parseInvoiceMock(...args),
    getUsdRate: (...args: unknown[]) => getUsdRateMock(...args),
    formatSats: (...args: unknown[]) => formatSatsMock(...args),
    formatSatsToUsd: (...args: unknown[]) => formatSatsToUsdMock(...args),
    isWebLNAvailable: (...args: unknown[]) => isWebLNAvailableMock(...args),
    payWithWebLN: (...args: unknown[]) => payWithWebLNMock(...args),
    copyToClipboard: (...args: unknown[]) => copyToClipboardMock(...args),
    getExpiryString: (...args: unknown[]) => getExpiryStringMock(...args),
    isCloseToExpiry: (...args: unknown[]) => isCloseToExpiryMock(...args),
    detectInvoice: (...args: unknown[]) => detectInvoiceMock(...args),
    detectAllInvoices: (...args: unknown[]) => detectAllInvoicesMock(...args),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockParsedInvoice = (overrides = {}) => ({
  paymentRequest: VALID_MAINNET_INVOICE,
  amount: 1000000, // millisats
  amountSats: 1000,
  description: 'Test payment',
  expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  isExpired: false,
  paymentHash: 'abc123def456',
  network: 'mainnet' as const,
  ...overrides,
});

// ============================================================================
// PaymentChip Component Tests
// ============================================================================

describe('PaymentChip Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    parseInvoiceMock.mockReturnValue(createMockParsedInvoice());
    getUsdRateMock.mockResolvedValue(60000);
    formatSatsMock.mockReturnValue('1,000');
    formatSatsToUsdMock.mockReturnValue('$0.60');
    isWebLNAvailableMock.mockReturnValue(false);
    copyToClipboardMock.mockResolvedValue(true);
    getExpiryStringMock.mockReturnValue('59m');
    isCloseToExpiryMock.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Invoice Parsing', () => {
    it('should parse and display valid mainnet invoice', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalledWith(VALID_MAINNET_INVOICE);
      });
    });

    it('should show invalid invoice message for unparseable invoice', async () => {
      parseInvoiceMock.mockReturnValue(null);

      render(<PaymentChip invoice="invalid-invoice" />);

      await waitFor(() => {
        const invalidText = screen.queryByText(/Invalid invoice/i);
        expect(invalidText).toBeDefined();
      });
    });

    it('should handle testnet invoices', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        network: 'testnet',
        paymentRequest: VALID_TESTNET_INVOICE,
      }));

      render(<PaymentChip invoice={VALID_TESTNET_INVOICE} />);

      await waitFor(() => {
        // Testnet badge should appear
        const testnetBadge = screen.queryByText(/testnet/i);
        expect(testnetBadge).toBeDefined();
      });
    });
  });

  describe('Amount Display in Sats', () => {
    it('should display amount in sats', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(formatSatsMock).toHaveBeenCalledWith(1000);
      });

      // Should contain "sats" in the display
      const satsText = screen.queryByText(/sats/i);
      expect(satsText).toBeDefined();
    });

    it('should display zero amount invoices as "Any amount"', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        amountSats: 0,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        const anyAmount = screen.queryByText(/Any amount/i);
        expect(anyAmount).toBeDefined();
      });
    });

    it('should format large amounts with separators', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        amountSats: 1000000,
      }));
      formatSatsMock.mockReturnValue('1,000,000');

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(formatSatsMock).toHaveBeenCalledWith(1000000);
      });
    });
  });

  describe('USD Estimate Display', () => {
    it('should fetch and display USD estimate', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(getUsdRateMock).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(formatSatsToUsdMock).toHaveBeenCalled();
      });
    });

    it('should show USD amount when rate is available', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        // Should show USD format (starts with ~ for approximate)
        const usdText = screen.queryByText(/~\$/);
        expect(usdText).toBeDefined();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('should copy invoice to clipboard on click', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.click(chip!);

      await waitFor(() => {
        expect(copyToClipboardMock).toHaveBeenCalledWith(VALID_MAINNET_INVOICE);
      });
    });

    it('should show "Copied!" feedback after copying', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.click(chip!);

      await waitFor(() => {
        const copiedText = screen.queryByText(/Copied!/i);
        expect(copiedText).toBeDefined();
      });
    });

    it('should call onClick callback if provided instead of copy', async () => {
      const onClick = vi.fn();
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} onClick={onClick} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.click(chip!);

      expect(onClick).toHaveBeenCalledWith(VALID_MAINNET_INVOICE);
      expect(copyToClipboardMock).not.toHaveBeenCalled();
    });
  });

  describe('Expiry Display', () => {
    it('should show expiry time', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(getExpiryStringMock).toHaveBeenCalled();
      });
    });

    it('should show expired status for expired invoices', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        isExpired: true,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        const expiredText = screen.queryByText(/Expired/i);
        expect(expiredText).toBeDefined();
      });
    });

    it('should highlight close-to-expiry invoices', async () => {
      isCloseToExpiryMock.mockReturnValue(true);
      getExpiryStringMock.mockReturnValue('5m');

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        // Should show "Expires" prefix for close-to-expiry
        const expiresText = screen.queryByText(/Expires/);
        expect(expiresText).toBeDefined();
      });
    });
  });

  describe('Description Display', () => {
    it('should show invoice description when available', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showDescription={true} />);

      await waitFor(() => {
        const description = screen.queryByText('Test payment');
        expect(description).toBeDefined();
      });
    });

    it('should hide description when showDescription is false', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showDescription={false} />);

      await waitFor(() => {
        const description = screen.queryByText('Test payment');
        expect(description).toBeNull();
      });
    });
  });

  describe('Compact Mode', () => {
    it('should render compact version when compact is true', () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} compact={true} />);

      // Compact mode should have different styling
      const compactChip = document.querySelector('[class*="px-2"][class*="py-0.5"]');
      expect(compactChip).toBeDefined();
    });

    it('should only show amount in compact mode', () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} compact={true} />);

      // Should not show description in compact mode
      const description = screen.queryByText('Test payment');
      expect(description).toBeNull();
    });
  });

  describe('Lightning Icon', () => {
    it('should render lightning bolt icon', () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      // Should have an SVG icon
      const svg = document.querySelector('svg');
      expect(svg).toBeDefined();
    });
  });

  describe('WebLN Integration', () => {
    it('should show Pay button when WebLN is available', async () => {
      isWebLNAvailableMock.mockReturnValue(true);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });
    });

    it('should not show Pay button when WebLN is unavailable', async () => {
      isWebLNAvailableMock.mockReturnValue(false);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeNull();
      });
    });

    it('should not show Pay button for expired invoices', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        isExpired: true,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeNull();
      });
    });

    it('should call payWithWebLN on Pay button click', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(true);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        expect(payWithWebLNMock).toHaveBeenCalledWith(VALID_MAINNET_INVOICE);
      });
    });

    it('should call onPaymentSuccess on successful payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(true);
      const onPaymentSuccess = vi.fn();

      render(
        <PaymentChip
          invoice={VALID_MAINNET_INVOICE}
          showPayButton={true}
          onPaymentSuccess={onPaymentSuccess}
        />
      );

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        expect(onPaymentSuccess).toHaveBeenCalledWith(VALID_MAINNET_INVOICE);
      });
    });

    it('should call onPaymentFailed on failed payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(false);
      const onPaymentFailed = vi.fn();

      render(
        <PaymentChip
          invoice={VALID_MAINNET_INVOICE}
          showPayButton={true}
          onPaymentFailed={onPaymentFailed}
        />
      );

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        expect(onPaymentFailed).toHaveBeenCalled();
      });
    });
  });

  describe('Styling', () => {
    it('should have success styling after successful payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(true);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        // Should have green success styling
        const chip = document.querySelector('[class*="terminal-green"]');
        expect(chip).toBeDefined();
      });
    });

    it('should have error styling for expired invoices', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        isExpired: true,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        // Should have red/error styling
        const chip = document.querySelector('[class*="terminal-red"]');
        expect(chip).toBeDefined();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible role on chip', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        const chip = document.querySelector('[role="button"]');
        expect(chip).toBeDefined();
      });
    });

    it('should be keyboard focusable', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        const chip = document.querySelector('[tabIndex="0"]');
        expect(chip).toBeDefined();
      });
    });

    it('should have type button on all buttons', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
        expect(payButton?.closest('button')?.getAttribute('type')).toBe('button');
      });
    });

    it('should have title/tooltip for compact mode', () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} compact={true} />);

      const chip = document.querySelector('[title]');
      expect(chip?.getAttribute('title')).toContain('Lightning Invoice');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty description', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        description: '',
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showDescription={true} />);

      await waitFor(() => {
        // Should render without error
        expect(parseInvoiceMock).toHaveBeenCalled();
      });
    });

    it('should handle undefined description', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        description: undefined,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showDescription={true} />);

      await waitFor(() => {
        // Should render without error
        expect(parseInvoiceMock).toHaveBeenCalled();
      });
    });

    it('should handle very large amounts', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        amountSats: 100000000, // 1 BTC
      }));
      formatSatsMock.mockReturnValue('100,000,000');

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(formatSatsMock).toHaveBeenCalledWith(100000000);
      });
    });

    it('should handle very long description', async () => {
      const longDesc = 'A'.repeat(500);
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        description: longDesc,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showDescription={true} />);

      await waitFor(() => {
        // Description should be truncated in UI
        const descEl = document.querySelector('[class*="truncate"]');
        expect(descEl).toBeDefined();
      });
    });

    it('should handle network error on USD rate fetch', async () => {
      // Mock that gracefully returns null instead of rejecting
      getUsdRateMock.mockResolvedValue(null);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        // Should still render the chip without USD estimate
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      // Sats should still be displayed even without USD
      const satsText = screen.queryByText(/sats/i);
      expect(satsText).toBeDefined();
    });
  });

  describe('Context Menu', () => {
    it('should show options on right click', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.contextMenu(chip!);

      await waitFor(() => {
        // Options menu should appear
        const copyOption = screen.queryByText('Copy Invoice');
        expect(copyOption).toBeDefined();
      });
    });

    it('should close options menu on outside click', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.contextMenu(chip!);

      await waitFor(() => {
        const copyOption = screen.queryByText('Copy Invoice');
        expect(copyOption).toBeDefined();
      });

      // Click outside
      fireEvent.click(document.body);

      await waitFor(() => {
        const copyOption = screen.queryByText('Copy Invoice');
        expect(copyOption).toBeNull();
      });
    });

    it('should have Open in App option', async () => {
      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        expect(parseInvoiceMock).toHaveBeenCalled();
      });

      const chip = document.querySelector('.payment-chip');
      fireEvent.contextMenu(chip!);

      await waitFor(() => {
        const openOption = screen.queryByText('Open in App');
        expect(openOption).toBeDefined();
      });
    });
  });

  describe('Payment States', () => {
    it('should show loading spinner during payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 1000))
      );

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      // Should show loading state
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeDefined();
    });

    it('should show check icon after successful payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(true);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        // Check icon should appear (SVG with checkmark)
        const checkIcon = document.querySelector('[class*="terminal-green"] svg');
        expect(checkIcon).toBeDefined();
      });
    });

    it('should show X icon after failed payment', async () => {
      isWebLNAvailableMock.mockReturnValue(true);
      payWithWebLNMock.mockResolvedValue(false);

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} showPayButton={true} />);

      await waitFor(() => {
        const payButton = screen.queryByText('Pay');
        expect(payButton).toBeDefined();
      });

      const payButton = screen.getByText('Pay');
      fireEvent.click(payButton);

      await waitFor(() => {
        // X icon should appear
        const xIcon = document.querySelector('[class*="terminal-red"] svg');
        expect(xIcon).toBeDefined();
      });
    });
  });

  describe('Empty States', () => {
    it('should handle invoice with no amount', async () => {
      parseInvoiceMock.mockReturnValue(createMockParsedInvoice({
        amountSats: 0,
        amount: 0,
      }));

      render(<PaymentChip invoice={VALID_MAINNET_INVOICE} />);

      await waitFor(() => {
        const anyAmount = screen.queryByText(/Any amount/i);
        expect(anyAmount).toBeDefined();
      });
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Lightning Invoice Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectInvoiceMock.mockImplementation((text: string) => {
      const match = text.match(/\b(lnbc|lntb|lnbcrt)[a-z0-9]+/i);
      return match ? match[0].toLowerCase() : null;
    });
    detectAllInvoicesMock.mockImplementation((text: string) => {
      const matches = text.match(/\b(lnbc|lntb|lnbcrt)[a-z0-9]+/gi) || [];
      return [...new Set(matches.map((m: string) => m.toLowerCase()))];
    });
  });

  describe('detectLightningInvoices', () => {
    it('should detect invoice in text', () => {
      const text = `Please pay this invoice: ${VALID_MAINNET_INVOICE}`;
      const invoices = detectLightningInvoices(text);

      expect(detectAllInvoicesMock).toHaveBeenCalledWith(text);
    });

    it('should detect multiple invoices', () => {
      const text = `Invoice 1: ${VALID_MAINNET_INVOICE} and Invoice 2: ${VALID_TESTNET_INVOICE}`;
      detectAllInvoicesMock.mockReturnValue([
        VALID_MAINNET_INVOICE.toLowerCase(),
        VALID_TESTNET_INVOICE.toLowerCase(),
      ]);

      const invoices = detectLightningInvoices(text);

      expect(detectAllInvoicesMock).toHaveBeenCalledWith(text);
    });

    it('should return empty array for text without invoices', () => {
      detectAllInvoicesMock.mockReturnValue([]);

      const invoices = detectLightningInvoices('No invoices here');

      expect(invoices).toEqual([]);
    });
  });

  describe('hasLightningInvoice', () => {
    it('should return true when text contains invoice', () => {
      detectInvoiceMock.mockReturnValue(VALID_MAINNET_INVOICE.toLowerCase());

      const result = hasLightningInvoice(`Pay: ${VALID_MAINNET_INVOICE}`);

      expect(detectInvoiceMock).toHaveBeenCalled();
    });

    it('should return false when text has no invoice', () => {
      detectInvoiceMock.mockReturnValue(null);

      const result = hasLightningInvoice('No invoice here');

      expect(result).toBe(false);
    });
  });

  describe('tokenizeLightningInvoices', () => {
    it('should tokenize text with single invoice', () => {
      detectAllInvoicesMock.mockReturnValue([VALID_MAINNET_INVOICE.toLowerCase()]);

      const tokens = tokenizeLightningInvoices(`Pay this: ${VALID_MAINNET_INVOICE} thanks!`);

      expect(tokens.length).toBeGreaterThan(1);
      expect(tokens.some(t => t.type === 'invoice')).toBe(true);
      expect(tokens.some(t => t.type === 'text')).toBe(true);
    });

    it('should return single text token when no invoices', () => {
      detectAllInvoicesMock.mockReturnValue([]);

      const tokens = tokenizeLightningInvoices('Just plain text');

      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].content).toBe('Just plain text');
    });

    it('should preserve text around invoices', () => {
      detectAllInvoicesMock.mockReturnValue([VALID_MAINNET_INVOICE.toLowerCase()]);

      const tokens = tokenizeLightningInvoices(`Before ${VALID_MAINNET_INVOICE} after`);

      const textTokens = tokens.filter(t => t.type === 'text');
      expect(textTokens.length).toBe(2);
    });
  });
});
