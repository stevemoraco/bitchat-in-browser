/**
 * AddPeer - Add new peer component
 *
 * Provides multiple ways to add a peer:
 * - QR code scanner (camera)
 * - Manual public key entry
 * - NFC scan (if available)
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { usePeersStore, createPeer, peerExists } from '../../stores/peers-store';

// ============================================================================
// Types
// ============================================================================

type AddMethod = 'scan' | 'manual' | 'nfc';

interface AddPeerProps {
  /** Callback when add is complete */
  onComplete?: (fingerprint: string) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

// ============================================================================
// Camera Scanner Component
// ============================================================================

interface CameraScannerProps {
  onScan: (data: string) => void;
  onError: (error: string) => void;
}

const CameraScanner: FunctionComponent<CameraScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let animationId: number;
    let isActive = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsScanning(true);
          scanFrame();
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setHasCamera(false);
        onError('Camera access denied or unavailable');
      }
    };

    const scanFrame = () => {
      if (!isActive || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // QR code scanning would happen here using a library like jsQR
        // For now, we simulate the scanning animation
        // In production, you would use:
        // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // const code = jsQR(imageData.data, imageData.width, imageData.height);
        // if (code) { onScan(code.data); return; }
      }

      animationId = requestAnimationFrame(scanFrame);
    };

    startCamera();

    return () => {
      isActive = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScan, onError]);

  if (!hasCamera) {
    return (
      <div class="empty-state py-8">
        <div class="empty-state-icon text-2xl">[X]</div>
        <h3 class="empty-state-title">Camera Unavailable</h3>
        <p class="empty-state-description">
          Camera access was denied or is not available. Try manual entry instead.
        </p>
      </div>
    );
  }

  return (
    <div class="relative">
      {/* Video preview */}
      <div class="relative aspect-square bg-surface rounded-terminal overflow-hidden border border-muted">
        <video
          ref={videoRef}
          class="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scanning overlay */}
        <div class="absolute inset-0 pointer-events-none">
          {/* Corner markers */}
          <div class="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary" />
          <div class="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary" />
          <div class="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary" />
          <div class="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary" />

          {/* Scanning line animation */}
          {isScanning && (
            <div
              class="absolute left-4 right-4 h-0.5 bg-primary/80"
              style={{
                animation: 'scan-line 2s linear infinite',
                top: '50%',
              }}
            />
          )}
        </div>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} class="hidden" />

      {/* Instructions */}
      <p class="text-terminal-xs text-muted text-center mt-3">
        Point camera at a BitChat QR code
      </p>

      <style>
        {`
          @keyframes scan-line {
            0% { top: 10%; }
            50% { top: 90%; }
            100% { top: 10%; }
          }
        `}
      </style>
    </div>
  );
};

// ============================================================================
// Manual Entry Component
// ============================================================================

interface ManualEntryProps {
  onSubmit: (publicKey: string, nickname?: string) => void;
  error?: string | null;
}

const ManualEntry: FunctionComponent<ManualEntryProps> = ({ onSubmit, error }) => {
  const [publicKey, setPublicKey] = useState('');
  const [nickname, setNickname] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const validatePublicKey = (key: string): boolean => {
    // Remove any whitespace
    const cleaned = key.trim().replace(/\s/g, '');

    // Check if it's a valid hex string (64 characters for Nostr pubkey)
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (hexRegex.test(cleaned)) {
      return true;
    }

    // Check if it's an npub (Nostr bech32 format)
    if (cleaned.startsWith('npub1') && cleaned.length === 63) {
      return true;
    }

    return false;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setLocalError(null);

    const cleaned = publicKey.trim().replace(/\s/g, '');

    if (!cleaned) {
      setLocalError('Public key is required');
      return;
    }

    if (!validatePublicKey(cleaned)) {
      setLocalError('Invalid public key format. Expected 64-character hex or npub1...');
      return;
    }

    onSubmit(cleaned, nickname.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      {/* Public Key Input */}
      <div class="form-group">
        <label class="form-label" for="pubkey">
          Public Key *
        </label>
        <div class="terminal-input-wrapper">
          <span class="terminal-input-prefix">&gt;</span>
          <input
            id="pubkey"
            type="text"
            class="terminal-input-field"
            value={publicKey}
            onInput={(e) => setPublicKey((e.target as HTMLInputElement).value)}
            placeholder="npub1... or hex public key"
            spellcheck={false}
            autocomplete="off"
          />
        </div>
        <p class="form-hint">
          Enter the Nostr public key (npub or hex format)
        </p>
      </div>

      {/* Nickname Input */}
      <div class="form-group">
        <label class="form-label" for="nickname">
          Nickname (optional)
        </label>
        <input
          id="nickname"
          type="text"
          class="terminal-input w-full"
          value={nickname}
          onInput={(e) => setNickname((e.target as HTMLInputElement).value)}
          placeholder="Enter a display name"
          maxLength={32}
        />
      </div>

      {/* Error display */}
      {(error || localError) && (
        <div class="text-terminal-xs text-terminal-red bg-terminal-red/10 px-3 py-2 rounded-terminal">
          [ERROR] {error || localError}
        </div>
      )}

      {/* Submit */}
      <button type="submit" class="btn-terminal w-full">
        Add Peer
      </button>
    </form>
  );
};

// ============================================================================
// NFC Scanner Component
// ============================================================================

interface NFCScannerProps {
  onScan: (data: string) => void;
  onError: (error: string) => void;
}

const NFCScanner: FunctionComponent<NFCScannerProps> = ({ onScan, onError }) => {
  const [isSupported, setIsSupported] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const readerRef = useRef<any>(null);

  useEffect(() => {
    // Check if Web NFC API is available
    if (!('NDEFReader' in window)) {
      setIsSupported(false);
      return;
    }

    let isActive = true;

    const startNFC = async () => {
      try {
        const NDEFReader = (window as any).NDEFReader;
        const reader = new NDEFReader();
        readerRef.current = reader;

        await reader.scan();
        setIsScanning(true);

        reader.addEventListener('reading', ({ message }: any) => {
          if (!isActive) return;

          for (const record of message.records) {
            if (record.recordType === 'text') {
              const textDecoder = new TextDecoder(record.encoding);
              const text = textDecoder.decode(record.data);
              onScan(text);
              return;
            }
          }
        });

        reader.addEventListener('readingerror', () => {
          if (isActive) {
            onError('Failed to read NFC tag');
          }
        });
      } catch (err: any) {
        console.error('NFC error:', err);
        if (err.name === 'NotAllowedError') {
          onError('NFC permission denied');
        } else if (err.name === 'NotSupportedError') {
          setIsSupported(false);
        } else {
          onError('NFC scan failed');
        }
      }
    };

    startNFC();

    return () => {
      isActive = false;
    };
  }, [onScan, onError]);

  if (!isSupported) {
    return (
      <div class="empty-state py-8">
        <div class="empty-state-icon text-2xl">[~]</div>
        <h3 class="empty-state-title">NFC Not Supported</h3>
        <p class="empty-state-description">
          NFC is not available on this device or browser. Try QR scanning or manual entry.
        </p>
      </div>
    );
  }

  return (
    <div class="text-center py-8">
      {/* NFC Icon Animation */}
      <div class="relative inline-flex items-center justify-center w-24 h-24 mb-6">
        {/* Pulsing rings */}
        {isScanning && (
          <>
            <div
              class="absolute inset-0 border-2 border-primary rounded-full opacity-20"
              style={{ animation: 'nfc-pulse 2s ease-out infinite' }}
            />
            <div
              class="absolute inset-2 border-2 border-primary rounded-full opacity-40"
              style={{ animation: 'nfc-pulse 2s ease-out infinite 0.4s' }}
            />
            <div
              class="absolute inset-4 border-2 border-primary rounded-full opacity-60"
              style={{ animation: 'nfc-pulse 2s ease-out infinite 0.8s' }}
            />
          </>
        )}
        {/* Center icon */}
        <div class="w-12 h-12 bg-surface border-2 border-primary rounded-lg flex items-center justify-center">
          <span class="text-primary text-xl">NFC</span>
        </div>
      </div>

      <h3 class="text-terminal-lg text-primary mb-2">
        {isScanning ? 'Ready to Scan' : 'Starting NFC...'}
      </h3>
      <p class="text-terminal-sm text-muted">
        Hold your device near a BitChat NFC tag
      </p>

      <style>
        {`
          @keyframes nfc-pulse {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.5); opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

// ============================================================================
// Method Selector Component
// ============================================================================

interface MethodSelectorProps {
  activeMethod: AddMethod;
  onMethodChange: (method: AddMethod) => void;
  nfcAvailable: boolean;
}

const MethodSelector: FunctionComponent<MethodSelectorProps> = ({
  activeMethod,
  onMethodChange,
  nfcAvailable,
}) => {
  const methods: { key: AddMethod; label: string; icon: string }[] = [
    { key: 'scan', label: 'QR Scan', icon: '[#]' },
    { key: 'manual', label: 'Manual', icon: '[>]' },
  ];

  if (nfcAvailable) {
    methods.push({ key: 'nfc', label: 'NFC', icon: '[~]' });
  }

  return (
    <div class="flex border-b border-muted">
      {methods.map((method) => (
        <button
          key={method.key}
          class={`flex-1 px-3 py-3 text-terminal-sm font-mono transition-colors ${
            activeMethod === method.key
              ? 'text-primary border-b-2 border-primary bg-primary/5'
              : 'text-muted hover:text-text hover:bg-surface'
          }`}
          onClick={() => onMethodChange(method.key)}
        >
          <span class="block text-lg">{method.icon}</span>
          <span class="block text-terminal-xs mt-1">{method.label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// AddPeer Component
// ============================================================================

export const AddPeer: FunctionComponent<AddPeerProps> = ({ onComplete, onCancel }) => {
  const [method, setMethod] = useState<AddMethod>('manual');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { addPeer } = usePeersStore();

  // Check if NFC is available
  const nfcAvailable = 'NDEFReader' in window;

  /**
   * Process scanned or entered data
   */
  const processPublicKey = useCallback(
    async (data: string, nickname?: string) => {
      setError(null);
      setIsProcessing(true);

      try {
        // Clean and validate the data
        let publicKey = data.trim().replace(/\s/g, '');

        // Handle npub format - in production, you would decode this
        // For now, we'll generate a fingerprint from it
        let fingerprint: string;

        if (publicKey.startsWith('npub1')) {
          // In production, decode npub to hex using nostr-tools
          // For now, we use a placeholder fingerprint
          fingerprint = publicKey.slice(5, 13).toUpperCase();
          // Convert npub to hex would happen here
        } else if (/^[0-9a-fA-F]{64}$/.test(publicKey)) {
          fingerprint = publicKey.slice(0, 8).toUpperCase();
        } else {
          throw new Error('Invalid public key format');
        }

        // Check if peer already exists
        if (peerExists(fingerprint)) {
          setError('This peer already exists in your contacts');
          setIsProcessing(false);
          return;
        }

        // Create and add the peer
        const newPeer = createPeer({
          fingerprint,
          publicKey,
          nickname: nickname || undefined,
          source: 'manual' as any, // Would be 'qr' or 'nfc' based on method
          status: 'offline',
        });

        addPeer(newPeer);

        if (onComplete) {
          onComplete(fingerprint);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to add peer');
      } finally {
        setIsProcessing(false);
      }
    },
    [addPeer, onComplete]
  );

  const handleScanResult = useCallback(
    (data: string) => {
      // Parse QR/NFC data - could be just pubkey or a BitChat URI
      // Format: bitchat://add?pubkey=xxx&name=yyy
      if (data.startsWith('bitchat://')) {
        try {
          const url = new URL(data);
          const pubkey = url.searchParams.get('pubkey');
          const name = url.searchParams.get('name');
          if (pubkey) {
            processPublicKey(pubkey, name || undefined);
          }
        } catch {
          setError('Invalid BitChat QR code');
        }
      } else {
        // Assume raw public key
        processPublicKey(data);
      }
    },
    [processPublicKey]
  );

  const handleScanError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  return (
    <div class="flex flex-col h-full bg-background">
      {/* Header */}
      <div class="px-4 py-3 border-b border-muted flex items-center gap-3">
        {onCancel && (
          <button
            class="btn-terminal-ghost btn-terminal-sm"
            onClick={onCancel}
            aria-label="Cancel"
          >
            &lt;
          </button>
        )}
        <h2 class="text-terminal-lg font-bold text-primary">&gt; Add Peer</h2>
      </div>

      {/* Method selector */}
      <MethodSelector
        activeMethod={method}
        onMethodChange={setMethod}
        nfcAvailable={nfcAvailable}
      />

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4">
        {isProcessing ? (
          <div class="empty-state py-12">
            <div class="loading-dots mb-4">
              <span />
              <span />
              <span />
            </div>
            <p class="text-muted">Adding peer...</p>
          </div>
        ) : (
          <>
            {method === 'scan' && (
              <CameraScanner onScan={handleScanResult} onError={handleScanError} />
            )}
            {method === 'manual' && (
              <ManualEntry
                onSubmit={processPublicKey}
                error={error}
              />
            )}
            {method === 'nfc' && (
              <NFCScanner onScan={handleScanResult} onError={handleScanError} />
            )}

            {/* Global error display for scan methods */}
            {error && method !== 'manual' && (
              <div class="mt-4 text-terminal-xs text-terminal-red bg-terminal-red/10 px-3 py-2 rounded-terminal">
                [ERROR] {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Help text */}
      <div class="px-4 py-3 border-t border-muted bg-surface">
        <p class="text-terminal-xs text-muted">
          {method === 'scan' && 'Scan a QR code from another BitChat user to add them.'}
          {method === 'manual' && 'Enter a Nostr public key to add a peer manually.'}
          {method === 'nfc' && 'Tap an NFC tag from another BitChat user.'}
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { AddPeerProps };
