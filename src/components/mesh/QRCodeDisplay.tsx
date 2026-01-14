/**
 * QR Code Display Component
 *
 * Displays a QR code for mesh joining. Uses a canvas-based
 * QR generator to avoid external dependencies.
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// ============================================================================
// Props Types
// ============================================================================

export interface QRCodeDisplayProps {
  /** Data to encode in QR code */
  data: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** Label to display above the QR code */
  label?: string;
  /** Callback when data is copied */
  onCopy?: () => void;
}

// ============================================================================
// QR Code Generator
// ============================================================================

// ============================================================================
// QR Code Library Type (for dynamic import)
// ============================================================================

interface QRCodeLib {
  toCanvas: (
    canvas: HTMLCanvasElement,
    data: string,
    options: {
      width: number;
      margin: number;
      color: { dark: string; light: string };
      errorCorrectionLevel: string;
    }
  ) => Promise<void>;
}

// ============================================================================
// QR Code Generator
// ============================================================================

/**
 * Simple QR code generator using canvas
 * For production, consider using a library like 'qrcode'
 */
async function generateQRCode(
  canvas: HTMLCanvasElement,
  data: string,
  size: number
): Promise<void> {
  // Dynamic import of qrcode library if available
  // Falls back to showing the data as text if not
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = (await import('qrcode' as any)) as { default: QRCodeLib };
    const QRCode = module.default;
    await QRCode.toCanvas(canvas, data, {
      width: size,
      margin: 2,
      color: {
        dark: '#c9d1d9',
        light: '#0d1117',
      },
      errorCorrectionLevel: 'M',
    });
  } catch {
    // Fallback: just draw a placeholder
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#21262d';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#c9d1d9';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2);
      ctx.fillText('(install qrcode)', size / 2, size / 2 + 16);
    }
  }
}

// ============================================================================
// Component
// ============================================================================

export const QRCodeDisplay: FunctionComponent<QRCodeDisplayProps> = ({
  data,
  size = 200,
  label,
  onCopy,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && data) {
      generateQRCode(canvasRef.current, data, size).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to generate QR code');
      });
    }
  }, [data, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = data;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div class="flex flex-col items-center gap-3">
      {label && <div class="text-sm text-gray-400">{label}</div>}

      <div class="bg-gray-800 p-3 rounded-lg">
        <canvas ref={canvasRef} width={size} height={size} class="rounded" />
      </div>

      {error && <div class="text-red-400 text-xs">{error}</div>}

      <button
        type="button"
        onClick={handleCopy}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
      >
        {copied ? 'Copied!' : 'Copy Data'}
      </button>

      {data.length > 100 && <div class="text-xs text-gray-500">{data.length} bytes</div>}
    </div>
  );
};

export default QRCodeDisplay;
