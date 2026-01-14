/**
 * QR Scanner Component
 *
 * Uses device camera to scan QR codes for mesh joining.
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// ============================================================================
// Props Types
// ============================================================================

export interface QRScannerProps {
  /** Callback when QR code is scanned */
  onScan: (data: string) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Callback when scanner is closed */
  onClose?: () => void;
}

// ============================================================================
// jsQR Library Type (for dynamic import)
// ============================================================================

interface QRCodeResult {
  data: string;
}

type JsQRFunction = (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => QRCodeResult | null;

// ============================================================================
// Component
// ============================================================================

export const QRScanner: FunctionComponent<QRScannerProps> = ({ onScan, onError, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationId: number;
    let jsQR: JsQRFunction | null = null;

    const startScanning = async () => {
      try {
        // Try to import jsQR for scanning
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = (await import('jsqr' as any)) as { default: JsQRFunction };
        jsQR = module.default;
      } catch {
        // jsQR not available, use manual input only
        setHasCamera(false);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
          scan();
        }
      } catch {
        setHasCamera(false);
        onError?.('Camera access denied');
      }
    };

    const scan = () => {
      if (!videoRef.current || !canvasRef.current || !jsQR) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
          onScan(code.data);
          return;
        }
      }

      animationId = requestAnimationFrame(scan);
    };

    startScanning();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [onScan, onError]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
    }
  };

  return (
    <div class="flex flex-col gap-4">
      {hasCamera && (
        <div class="relative">
          <video
            ref={videoRef}
            class="w-full max-w-md rounded-lg bg-gray-900"
            playsInline
            muted
          />
          <canvas ref={canvasRef} class="hidden" />

          {scanning && (
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="w-48 h-48 border-2 border-blue-500 rounded-lg opacity-50" />
            </div>
          )}
        </div>
      )}

      <div class="text-center text-gray-400 text-sm">
        {hasCamera ? 'Point camera at QR code' : 'Camera not available'}
      </div>

      <div class="border-t border-gray-700 pt-4">
        <div class="text-sm text-gray-400 mb-2">Or paste data manually:</div>
        <textarea
          value={manualInput}
          onInput={(e) => setManualInput((e.target as HTMLTextAreaElement).value)}
          placeholder="Paste QR data here..."
          class="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-200 font-mono resize-none"
        />
        <div class="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={!manualInput.trim()}
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors"
          >
            Submit
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
