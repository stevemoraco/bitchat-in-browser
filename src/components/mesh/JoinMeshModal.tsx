/**
 * Join Mesh Modal
 *
 * Full-screen modal for the QR-based mesh joining flow.
 * Supports both creating (showing QR) and joining (scanning QR).
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRScanner } from './QRScanner';
import { directConnection } from '../../services/mesh/direct-connection';

// ============================================================================
// Types
// ============================================================================

type FlowStep = 'choose' | 'create-offer' | 'scan-answer' | 'scan-offer' | 'show-answer' | 'connected';

export interface JoinMeshModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when connection is established */
  onConnected?: (peerId: string) => void;
}

// ============================================================================
// Icons
// ============================================================================

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

const CheckIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clip-rule="evenodd"
    />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export const JoinMeshModal: FunctionComponent<JoinMeshModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const [step, setStep] = useState<FlowStep>('choose');
  const [offerData, setOfferData] = useState<string>('');
  const [answerData, setAnswerData] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep('choose');
      setOfferData('');
      setAnswerData('');
      setError('');
      setStatus('');
    }
  }, [isOpen]);

  // === Hub Flow (Create Mesh) ===

  const handleCreateMesh = async () => {
    setStep('create-offer');
    setStatus('Generating connection offer...');
    setError('');

    try {
      // Generate offer
      const { encoded } = await directConnection.createOffer();
      setOfferData(encoded);
      setStatus('Show this QR to the person joining');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    }
  };

  const handleScanAnswer = async (data: string) => {
    setStatus('Processing answer...');
    setError('');

    try {
      await directConnection.acceptAnswer(data);
      setStep('connected');
      setStatus('Connected!');

      // Get the peer ID from the answer
      const answer = JSON.parse(atob(data)) as { peerId: string };
      onConnected?.(answer.peerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process answer');
    }
  };

  // === Joiner Flow (Join Mesh) ===

  const handleJoinMesh = () => {
    setStep('scan-offer');
    setStatus('Scan the QR code from the mesh host');
    setError('');
  };

  const handleScannedOffer = async (data: string) => {
    setStep('show-answer');
    setStatus('Generating response...');
    setError('');

    try {
      const { encoded } = await directConnection.acceptOffer(data);
      setAnswerData(encoded);
      setStatus('Show this QR to the host to complete connection');

      // Set up connection listener
      directConnection.onConnection((peerId) => {
        setStep('connected');
        setStatus('Connected!');
        onConnected?.(peerId);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process offer');
    }
  };

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col">
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 class="text-lg font-semibold text-white">
          {step === 'choose' && 'Join Mesh Network'}
          {step === 'create-offer' && 'Share This QR'}
          {step === 'scan-answer' && 'Scan Response'}
          {step === 'scan-offer' && 'Scan Host QR'}
          {step === 'show-answer' && 'Show This QR'}
          {step === 'connected' && 'Connected!'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          class="text-gray-400 hover:text-white p-2"
          aria-label="Close"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto p-4">
        {/* Step: Choose Role */}
        {step === 'choose' && (
          <div class="flex flex-col gap-4 max-w-md mx-auto">
            <p class="text-gray-400 text-center mb-4">
              Create a mesh for others to join, or join an existing mesh.
            </p>

            <button
              type="button"
              onClick={handleCreateMesh}
              class="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <div class="text-lg font-semibold">Create Mesh</div>
              <div class="text-sm opacity-75">Others will scan your QR</div>
            </button>

            <button
              type="button"
              onClick={handleJoinMesh}
              class="w-full p-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <div class="text-lg font-semibold">Join Mesh</div>
              <div class="text-sm opacity-75">Scan the host's QR</div>
            </button>
          </div>
        )}

        {/* Step: Create Offer (Hub showing QR) */}
        {step === 'create-offer' && offerData && (
          <div class="flex flex-col items-center gap-4">
            <QRCodeDisplay data={offerData} size={250} label="Scan to join mesh" />

            <p class="text-gray-400 text-sm text-center max-w-xs">
              The other person should scan this QR code, then show you their response QR.
            </p>

            <button
              type="button"
              onClick={() => setStep('scan-answer')}
              class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Ready to Scan Response
            </button>
          </div>
        )}

        {/* Step: Scan Answer (Hub scanning joiner's QR) */}
        {step === 'scan-answer' && (
          <div class="max-w-md mx-auto">
            <QRScanner
              onScan={handleScanAnswer}
              onError={setError}
              onClose={() => setStep('create-offer')}
            />
          </div>
        )}

        {/* Step: Scan Offer (Joiner scanning hub's QR) */}
        {step === 'scan-offer' && (
          <div class="max-w-md mx-auto">
            <QRScanner
              onScan={handleScannedOffer}
              onError={setError}
              onClose={() => setStep('choose')}
            />
          </div>
        )}

        {/* Step: Show Answer (Joiner showing QR to hub) */}
        {step === 'show-answer' && answerData && (
          <div class="flex flex-col items-center gap-4">
            <QRCodeDisplay data={answerData} size={250} label="Show this to the host" />

            <p class="text-gray-400 text-sm text-center max-w-xs">
              Let the host scan this QR code to complete the connection.
            </p>

            <div class="text-yellow-400 text-sm animate-pulse">Waiting for connection...</div>
          </div>
        )}

        {/* Step: Connected */}
        {step === 'connected' && (
          <div class="flex flex-col items-center gap-4 py-8">
            <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <CheckIcon class="w-10 h-10 text-white" />
            </div>
            <div class="text-2xl text-green-400">Connected!</div>
            <p class="text-gray-400 text-center">You are now part of the mesh network.</p>
            <button
              type="button"
              onClick={onClose}
              class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Start Chatting
            </button>
          </div>
        )}

        {/* Status & Error */}
        {status && step !== 'connected' && (
          <div class="text-center text-gray-400 mt-4">{status}</div>
        )}

        {error && <div class="text-center text-red-400 mt-4">{error}</div>}
      </div>
    </div>
  );
};

export default JoinMeshModal;
