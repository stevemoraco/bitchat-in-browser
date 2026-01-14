/**
 * PaymentChip Component
 *
 * Displays Lightning invoices as interactive chips within messages.
 * Features:
 * - Lightning bolt icon
 * - Amount in sats with USD equivalent
 * - Description/memo display
 * - Expiry indicator
 * - Tap to copy, optional Pay button via WebLN
 */

import type { FunctionComponent, VNode } from 'preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  LightningService,
  type LightningInvoice,
} from '../../services/payments/lightning';

// ============================================================================
// Types
// ============================================================================

export interface PaymentChipProps {
  /** The Lightning invoice string */
  invoice: string;
  /** Callback when chip is clicked */
  onClick?: (invoice: string) => void;
  /** Callback when payment is successful */
  onPaymentSuccess?: (invoice: string) => void;
  /** Callback when payment fails */
  onPaymentFailed?: (invoice: string, error?: string) => void;
  /** Whether to show the Pay button (if WebLN available) */
  showPayButton?: boolean;
  /** Whether to show the description */
  showDescription?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

type PaymentStatus = 'idle' | 'paying' | 'success' | 'failed';

// ============================================================================
// Component
// ============================================================================

export const PaymentChip: FunctionComponent<PaymentChipProps> = ({
  invoice,
  onClick,
  onPaymentSuccess,
  onPaymentFailed,
  showPayButton = true,
  showDescription = true,
  compact = false,
  className = '',
}) => {
  // State
  const [parsedInvoice, setParsedInvoice] = useState<LightningInvoice | null>(
    null
  );
  const [usdRate, setUsdRate] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [expiryString, setExpiryString] = useState<string>('');

  // Check WebLN availability
  const webLNAvailable = useMemo(
    () => LightningService.isWebLNAvailable(),
    []
  );

  // Parse invoice on mount
  useEffect(() => {
    const parsed = LightningService.parseInvoice(invoice);
    setParsedInvoice(parsed);

    if (parsed) {
      // Update expiry string
      setExpiryString(LightningService.getExpiryString(parsed.expiry));

      // Update expiry periodically
      const interval = setInterval(() => {
        setExpiryString(LightningService.getExpiryString(parsed.expiry));
      }, 30000); // Update every 30 seconds

      return () => {
        clearInterval(interval);
      };
    }
    return undefined;
  }, [invoice]);

  // Fetch USD rate
  useEffect(() => {
    let cancelled = false;

    void LightningService.getUsdRate().then((rate) => {
      if (!cancelled) {
        setUsdRate(rate);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle chip click (copy to clipboard)
  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();

      if (onClick) {
        onClick(invoice);
        return;
      }

      // Default: copy to clipboard
      const success = await LightningService.copyToClipboard(invoice);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [invoice, onClick]
  );

  // Handle Pay button click
  const handlePay = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();

      if (paymentStatus === 'paying' || !webLNAvailable) {
        return;
      }

      setPaymentStatus('paying');

      try {
        const success = await LightningService.payWithWebLN(invoice);

        if (success) {
          setPaymentStatus('success');
          onPaymentSuccess?.(invoice);
        } else {
          setPaymentStatus('failed');
          onPaymentFailed?.(invoice, 'Payment rejected or failed');
        }
      } catch (err) {
        setPaymentStatus('failed');
        onPaymentFailed?.(
          invoice,
          err instanceof Error ? err.message : 'Payment failed'
        );
      }

      // Reset status after delay
      setTimeout(() => {
        setPaymentStatus('idle');
      }, 3000);
    },
    [invoice, paymentStatus, webLNAvailable, onPaymentSuccess, onPaymentFailed]
  );

  // Handle long press / context menu
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setShowOptions((prev) => !prev);
  }, []);

  // Close options on outside click
  useEffect(() => {
    if (showOptions) {
      const handleClickOutside = () => {
        setShowOptions(false);
      };
      window.addEventListener('click', handleClickOutside);
      return () => {
        window.removeEventListener('click', handleClickOutside);
      };
    }
    return undefined;
  }, [showOptions]);

  // If parsing failed, show simple error chip
  if (!parsedInvoice) {
    return (
      <div
        class={`inline-flex items-center gap-1.5 px-2 py-1 bg-terminal-red/10 border border-terminal-red/30 rounded-full text-terminal-red/70 text-sm ${className}`}
      >
        <LightningIcon size={14} />
        <span class="font-mono text-xs">Invalid invoice</span>
      </div>
    );
  }

  // Format amounts
  const formattedSats = LightningService.formatSats(parsedInvoice.amountSats);
  const formattedUsd =
    usdRate > 0
      ? LightningService.formatSatsToUsd(parsedInvoice.amountSats, usdRate)
      : null;

  // Check expiry status
  const isExpired = parsedInvoice.isExpired;
  const isCloseToExpiry = LightningService.isCloseToExpiry(parsedInvoice.expiry);

  // Determine chip styling based on status
  const getChipStyle = () => {
    if (paymentStatus === 'success') {
      return 'bg-terminal-green/20 border-terminal-green/50';
    }
    if (paymentStatus === 'failed' || isExpired) {
      return 'bg-terminal-red/10 border-terminal-red/30';
    }
    if (isCloseToExpiry) {
      return 'bg-terminal-yellow/10 border-terminal-yellow/30';
    }
    return 'bg-terminal-yellow/10 border-terminal-yellow/40 hover:bg-terminal-yellow/20';
  };

  // Wrap async handlers for DOM events
  const onChipClick = useCallback(
    (e: MouseEvent) => {
      void handleClick(e);
    },
    [handleClick]
  );

  const onPayClick = useCallback(
    (e: MouseEvent) => {
      void handlePay(e);
    },
    [handlePay]
  );

  // Compact mode
  if (compact) {
    return (
      <button
        type="button"
        onClick={onChipClick}
        onContextMenu={handleContextMenu}
        class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${getChipStyle()} ${className}`}
        title={`Lightning Invoice: ${formattedSats} sats${formattedUsd ? ` (~${formattedUsd})` : ''}`}
      >
        <LightningIcon size={12} class="text-terminal-yellow" />
        <span class="font-mono text-xs text-terminal-yellow">
          {formattedSats}
        </span>
        {copied && (
          <span class="text-terminal-green text-xs ml-1">Copied!</span>
        )}
      </button>
    );
  }

  // Full mode
  return (
    <div class={`inline-block relative ${className}`}>
      <div
        class={`payment-chip flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${getChipStyle()}`}
        onClick={onChipClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
      >
        {/* Lightning Icon */}
        <div class="flex-shrink-0">
          {paymentStatus === 'paying' ? (
            <div class="w-5 h-5 border-2 border-terminal-yellow/30 border-t-terminal-yellow rounded-full animate-spin" />
          ) : paymentStatus === 'success' ? (
            <CheckIcon size={20} class="text-terminal-green" />
          ) : paymentStatus === 'failed' ? (
            <XIcon size={20} class="text-terminal-red" />
          ) : (
            <LightningIcon
              size={20}
              class={isExpired ? 'text-terminal-red/50' : 'text-terminal-yellow'}
            />
          )}
        </div>

        {/* Amount and Info */}
        <div class="flex-1 min-w-0">
          {/* Amount row */}
          <div class="flex items-baseline gap-2 flex-wrap">
            <span
              class={`font-mono font-semibold ${
                isExpired ? 'text-terminal-red/70' : 'text-terminal-yellow'
              }`}
            >
              {parsedInvoice.amountSats > 0
                ? `${formattedSats} sats`
                : 'Any amount'}
            </span>
            {formattedUsd && parsedInvoice.amountSats > 0 && (
              <span class="text-xs text-muted">~{formattedUsd}</span>
            )}
          </div>

          {/* Description row */}
          {showDescription && parsedInvoice.description && (
            <div class="text-xs text-muted truncate max-w-[200px] mt-0.5">
              {parsedInvoice.description}
            </div>
          )}

          {/* Status row */}
          <div class="flex items-center gap-2 mt-1 text-xs">
            {isExpired ? (
              <span class="text-terminal-red">Expired</span>
            ) : (
              <span
                class={
                  isCloseToExpiry ? 'text-terminal-yellow' : 'text-muted'
                }
              >
                {isCloseToExpiry ? 'Expires ' : ''}
                {expiryString}
              </span>
            )}
            {parsedInvoice.network !== 'mainnet' && (
              <span class="px-1 py-0.5 bg-terminal-cyan/10 text-terminal-cyan rounded text-xs uppercase">
                {parsedInvoice.network}
              </span>
            )}
            {copied && (
              <span class="text-terminal-green animate-pulse">Copied!</span>
            )}
          </div>
        </div>

        {/* Pay Button */}
        {showPayButton &&
          webLNAvailable &&
          !isExpired &&
          paymentStatus === 'idle' && (
            <button
              type="button"
              onClick={onPayClick}
              class="flex-shrink-0 px-3 py-1.5 bg-terminal-yellow text-terminal-bg font-semibold text-sm rounded-md hover:bg-terminal-yellow/80 transition-colors"
            >
              Pay
            </button>
          )}
      </div>

      {/* Options Menu */}
      {showOptions && (
        <div class="absolute top-full left-0 mt-1 bg-surface border border-terminal-green/30 rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void LightningService.copyToClipboard(invoice).then((success) => {
                if (success) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              });
              setShowOptions(false);
            }}
            class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <CopyIcon size={14} />
            Copy Invoice
          </button>
          {webLNAvailable && !isExpired && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handlePay(e);
                setShowOptions(false);
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors flex items-center gap-2 text-terminal-yellow"
            >
              <LightningIcon size={14} />
              Pay with WebLN
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // Open in external Lightning app
              window.open(`lightning:${invoice}`, '_blank');
              setShowOptions(false);
            }}
            class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <ExternalIcon size={14} />
            Open in App
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Icon Components
// ============================================================================

const LightningIcon: FunctionComponent<{ size?: number; class?: string }> = ({
  size = 16,
  class: className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    class={className}
  >
    <path d="M13 2L4.09 12.11c-.42.51-.06 1.29.59 1.29H11v7.6c0 .69.88.99 1.31.44l8.91-10.11c.42-.51.06-1.29-.59-1.29H13V2.4c0-.69-.88-.99-1.31-.44L13 2z" />
  </svg>
);

const CheckIcon: FunctionComponent<{ size?: number; class?: string }> = ({
  size = 16,
  class: className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon: FunctionComponent<{ size?: number; class?: string }> = ({
  size = 16,
  class: className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon: FunctionComponent<{ size?: number; class?: string }> = ({
  size = 16,
  class: className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ExternalIcon: FunctionComponent<{ size?: number; class?: string }> = ({
  size = 16,
  class: className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect and extract Lightning invoices from message text.
 * Returns array of invoice strings found.
 */
export function detectLightningInvoices(text: string): string[] {
  return LightningService.detectAllInvoices(text);
}

/**
 * Check if text contains any Lightning invoices.
 */
export function hasLightningInvoice(text: string): boolean {
  return LightningService.detectInvoice(text) !== null;
}

/**
 * Replace Lightning invoices in text with placeholder tokens.
 * Useful for rendering text with embedded PaymentChips.
 */
export function tokenizeLightningInvoices(text: string): Array<
  | { type: 'text'; content: string }
  | { type: 'invoice'; invoice: string }
> {
  const invoices = LightningService.detectAllInvoices(text);

  if (invoices.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const tokens: Array<
    | { type: 'text'; content: string }
    | { type: 'invoice'; invoice: string }
  > = [];

  let remaining = text;

  for (const invoice of invoices) {
    const index = remaining.toLowerCase().indexOf(invoice.toLowerCase());
    if (index === -1) continue;

    // Add text before invoice
    if (index > 0) {
      tokens.push({ type: 'text', content: remaining.slice(0, index) });
    }

    // Add invoice token
    tokens.push({ type: 'invoice', invoice });

    // Continue with remaining text
    remaining = remaining.slice(index + invoice.length);
  }

  // Add remaining text
  if (remaining.length > 0) {
    tokens.push({ type: 'text', content: remaining });
  }

  return tokens;
}

// ============================================================================
// Wrapper Component for Message Integration
// ============================================================================

export interface MessageWithPaymentsProps {
  /** Message content */
  content: string;
  /** Children render function for text portions */
  renderText: (text: string) => VNode | string;
  /** Additional props for PaymentChip */
  chipProps?: Omit<PaymentChipProps, 'invoice'>;
}

/**
 * Renders message content with embedded PaymentChips for any Lightning invoices.
 */
export const MessageWithPayments: FunctionComponent<MessageWithPaymentsProps> = ({
  content,
  renderText,
  chipProps = {},
}) => {
  const tokens = useMemo(() => tokenizeLightningInvoices(content), [content]);

  if (tokens.length === 1 && tokens[0].type === 'text') {
    return <>{renderText(content)}</>;
  }

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <span key={index}>{renderText(token.content)}</span>;
        }
        return (
          <PaymentChip
            key={index}
            invoice={token.invoice}
            {...chipProps}
          />
        );
      })}
    </>
  );
};

export default PaymentChip;
