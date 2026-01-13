/**
 * Identity Store - Cryptographic identity management
 *
 * Manages the user's Nostr identity:
 * - Public key and fingerprint
 * - Key loading state
 * - Identity lifecycle
 *
 * NOTE: Private keys are NEVER stored in this store.
 * Private key handling is done in the crypto service.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { Identity, IdentityActions } from './types';

// ============================================================================
// Types
// ============================================================================

interface IdentityState {
  identity: Identity | null;
}

interface IdentityStore extends IdentityState, IdentityActions {}

// ============================================================================
// Initial State
// ============================================================================

const initialState: IdentityState = {
  identity: null,
};

// ============================================================================
// Store
// ============================================================================

export const useIdentityStore = create<IdentityStore>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,

        /**
         * Set the user's identity
         */
        setIdentity: (
          identity: Omit<Identity, 'isKeyLoaded'> & { isKeyLoaded?: boolean }
        ) => {
          set(
            {
              identity: {
                ...identity,
                isKeyLoaded: identity.isKeyLoaded ?? false,
              },
            },
            false,
            'setIdentity'
          );
        },

        /**
         * Update the key loaded status
         */
        setKeyLoaded: (isLoaded: boolean) => {
          set(
            (state) => {
              if (!state.identity) return state;
              return {
                identity: {
                  ...state.identity,
                  isKeyLoaded: isLoaded,
                },
              };
            },
            false,
            'setKeyLoaded'
          );
        },

        /**
         * Clear the identity (logout/wipe)
         */
        clearIdentity: () => {
          set({ identity: null }, false, 'clearIdentity');
        },
      }),
      {
        name: 'bitchat-identity',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => {
          // Only persist public data, never private key references
          if (!state.identity) return { identity: null };
          return {
            identity: {
              publicKey: state.identity.publicKey,
              fingerprint: state.identity.fingerprint,
              npub: state.identity.npub,
              nip05: state.identity.nip05,
              createdAt: state.identity.createdAt,
              // Never persist isKeyLoaded - it's runtime state
              isKeyLoaded: false,
            },
          };
        },
      }
    ),
    {
      name: 'bitchat-identity-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get the full identity object
 */
export const selectIdentity = (state: IdentityStore) => state.identity;

/**
 * Get the public key
 */
export const selectPublicKey = (state: IdentityStore) =>
  state.identity?.publicKey ?? null;

/**
 * Get the fingerprint
 */
export const selectFingerprint = (state: IdentityStore) =>
  state.identity?.fingerprint ?? null;

/**
 * Check if key is loaded in memory
 */
export const selectIsKeyLoaded = (state: IdentityStore) =>
  state.identity?.isKeyLoaded ?? false;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get the full identity
 */
export const useIdentity = (): Identity | null => {
  return useIdentityStore((state) => state.identity);
};

/**
 * Hook to get the public key
 */
export const usePublicKey = (): string | null => {
  return useIdentityStore((state) => state.identity?.publicKey ?? null);
};

/**
 * Hook to get the fingerprint
 */
export const useFingerprint = (): string | null => {
  return useIdentityStore((state) => state.identity?.fingerprint ?? null);
};

/**
 * Hook to check if key is loaded
 */
export const useIsKeyLoaded = (): boolean => {
  return useIdentityStore((state) => state.identity?.isKeyLoaded ?? false);
};

/**
 * Hook to check if identity exists
 */
export const useHasIdentity = (): boolean => {
  return useIdentityStore((state) => state.identity !== null);
};

/**
 * Hook to get npub
 */
export const useNpub = (): string | null => {
  return useIdentityStore((state) => state.identity?.npub ?? null);
};

/**
 * Hook to get NIP-05 identifier
 */
export const useNip05 = (): string | null => {
  return useIdentityStore((state) => state.identity?.nip05 ?? null);
};

/**
 * Hook to get display identifier (npub shortened or fingerprint)
 */
export const useDisplayId = (): string | null => {
  return useIdentityStore((state) => {
    if (!state.identity) return null;

    // If npub exists, return shortened version
    if (state.identity.npub) {
      const npub = state.identity.npub;
      return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
    }

    // Otherwise return fingerprint
    return state.identity.fingerprint;
  });
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the current identity (non-reactive)
 */
export function getIdentity(): Identity | null {
  return useIdentityStore.getState().identity;
}

/**
 * Get the current public key (non-reactive)
 */
export function getPublicKey(): string | null {
  return useIdentityStore.getState().identity?.publicKey ?? null;
}

/**
 * Get the current fingerprint (non-reactive)
 */
export function getFingerprint(): string | null {
  return useIdentityStore.getState().identity?.fingerprint ?? null;
}

/**
 * Check if the user has an identity
 */
export function hasIdentity(): boolean {
  return useIdentityStore.getState().identity !== null;
}

/**
 * Check if the private key is loaded in memory
 */
export function isKeyLoaded(): boolean {
  return useIdentityStore.getState().identity?.isKeyLoaded ?? false;
}

/**
 * Create identity from public key
 * Note: This is a helper for creating the identity object.
 * The actual fingerprint derivation should be done in the crypto service.
 */
export function createIdentityFromPublicKey(
  publicKey: string,
  fingerprint: string,
  options?: {
    npub?: string;
    nip05?: string;
  }
): Identity {
  return {
    publicKey,
    fingerprint,
    isKeyLoaded: false,
    npub: options?.npub,
    nip05: options?.nip05,
    createdAt: Date.now(),
  };
}
