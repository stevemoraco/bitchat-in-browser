/**
 * Peer Introduction Protocol
 *
 * Enables mesh growth by introducing connected peers to each other.
 * Hub relays signaling messages so new peers can connect directly.
 */

import {
  directConnection,
  type DirectConnectionManager,
  type ConnectionOffer,
  type ConnectionAnswer,
} from './direct-connection';
import type { MeshPeer } from './types';

// Protocol message types
export interface IntroductionMessage {
  type: 'introduction';
  action: 'peer-list' | 'introduce' | 'offer-relay' | 'answer-relay';
  payload: unknown;
  fromPeerId: string;
  timestamp: number;
}

export interface PeerListPayload {
  peers: Array<{
    peerId: string;
    nickname?: string;
    appVersion?: string;
  }>;
}

export interface IntroducePayload {
  targetPeerId: string;
  offer: ConnectionOffer;
}

export interface OfferRelayPayload {
  fromPeerId: string;
  offer: ConnectionOffer;
}

export interface AnswerRelayPayload {
  forPeerId: string;
  answer: ConnectionAnswer;
}

type IntroductionHandler = (fromPeerId: string, newPeer: MeshPeer) => void;

export class PeerIntroductionService {
  private static instance: PeerIntroductionService | null = null;

  private connectionManager: DirectConnectionManager;
  private pendingIntroductions: Map<
    string,
    {
      targetPeerId: string;
      offer: ConnectionOffer;
      timestamp: number;
    }
  > = new Map();

  private introductionHandlers: Set<IntroductionHandler> = new Set();

  private constructor() {
    this.connectionManager = directConnection;
    this.setupMessageHandling();
  }

  static getInstance(): PeerIntroductionService {
    if (!PeerIntroductionService.instance) {
      PeerIntroductionService.instance = new PeerIntroductionService();
    }
    return PeerIntroductionService.instance;
  }

  /**
   * Initialize the introduction service
   */
  initialize(): void {
    console.log('[PeerIntro] Initialized');
  }

  /**
   * As a hub, introduce two peers to each other
   */
  async introducePeers(peerA: string, peerB: string): Promise<boolean> {
    console.log(`[PeerIntro] Introducing ${peerA} to ${peerB}`);

    try {
      // Create offer for the introduction
      const { offer } = await this.connectionManager.createOffer();

      // Send to peer A: "Connect to peer B using this"
      const introA: IntroductionMessage = {
        type: 'introduction',
        action: 'introduce',
        payload: {
          targetPeerId: peerB,
          offer,
        } as IntroducePayload,
        fromPeerId: this.connectionManager.getLocalPeerId(),
        timestamp: Date.now(),
      };

      this.connectionManager.send(peerA, introA);

      // Also notify peer B about peer A
      const introB: IntroductionMessage = {
        type: 'introduction',
        action: 'introduce',
        payload: {
          targetPeerId: peerA,
          offer,
        } as IntroducePayload,
        fromPeerId: this.connectionManager.getLocalPeerId(),
        timestamp: Date.now(),
      };

      this.connectionManager.send(peerB, introB);

      return true;
    } catch (error) {
      console.error('[PeerIntro] Introduction failed:', error);
      return false;
    }
  }

  /**
   * Send peer list to a newly connected peer
   */
  sendPeerList(toPeerId: string): void {
    const connectedPeers = this.connectionManager.getConnectedPeers();

    // Filter out the peer we're sending to
    const otherPeers = connectedPeers
      .filter((p) => p.peerId !== toPeerId)
      .map((p) => ({
        peerId: p.peerId,
        nickname: p.nickname,
        appVersion: p.appVersion,
      }));

    if (otherPeers.length === 0) {
      console.log('[PeerIntro] No other peers to share');
      return;
    }

    const message: IntroductionMessage = {
      type: 'introduction',
      action: 'peer-list',
      payload: { peers: otherPeers } as PeerListPayload,
      fromPeerId: this.connectionManager.getLocalPeerId(),
      timestamp: Date.now(),
    };

    this.connectionManager.send(toPeerId, message);
    console.log(`[PeerIntro] Sent peer list (${otherPeers.length} peers) to ${toPeerId}`);
  }

  /**
   * Relay an offer from one peer to another
   */
  relayOffer(fromPeerId: string, toPeerId: string, offer: ConnectionOffer): void {
    const message: IntroductionMessage = {
      type: 'introduction',
      action: 'offer-relay',
      payload: { fromPeerId, offer } as OfferRelayPayload,
      fromPeerId: this.connectionManager.getLocalPeerId(),
      timestamp: Date.now(),
    };

    this.connectionManager.send(toPeerId, message);
    console.log(`[PeerIntro] Relayed offer from ${fromPeerId} to ${toPeerId}`);
  }

  /**
   * Relay an answer from one peer to another
   */
  relayAnswer(forPeerId: string, toPeerId: string, answer: ConnectionAnswer): void {
    const message: IntroductionMessage = {
      type: 'introduction',
      action: 'answer-relay',
      payload: { forPeerId, answer } as AnswerRelayPayload,
      fromPeerId: this.connectionManager.getLocalPeerId(),
      timestamp: Date.now(),
    };

    this.connectionManager.send(toPeerId, message);
    console.log(`[PeerIntro] Relayed answer for ${forPeerId} to ${toPeerId}`);
  }

  /**
   * Introduce all existing peers to a new peer
   * Called when a new peer joins the mesh
   */
  async introduceNewPeer(newPeerId: string): Promise<void> {
    const existingPeers = this.connectionManager
      .getConnectedPeers()
      .filter((p) => p.peerId !== newPeerId);

    console.log(
      `[PeerIntro] Introducing ${newPeerId} to ${existingPeers.length} existing peers`
    );

    // Send peer list first
    this.sendPeerList(newPeerId);

    // Then facilitate introductions
    for (const peer of existingPeers) {
      // Small delay to avoid overwhelming
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.introducePeers(newPeerId, peer.peerId);
    }
  }

  /**
   * Register handler for successful introductions
   */
  onIntroduction(handler: IntroductionHandler): () => void {
    this.introductionHandlers.add(handler);
    return () => this.introductionHandlers.delete(handler);
  }

  // === Private Methods ===

  private setupMessageHandling(): void {
    this.connectionManager.onMessage((data, fromPeerId) => {
      if (this.isIntroductionMessage(data)) {
        void this.handleIntroductionMessage(data as IntroductionMessage, fromPeerId);
      }
    });

    // When a new peer connects, introduce them to others
    this.connectionManager.onConnection((peerId) => {
      // Delay to ensure connection is stable
      setTimeout(() => {
        void this.introduceNewPeer(peerId);
      }, 1000);
    });
  }

  private isIntroductionMessage(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      (data as { type: string }).type === 'introduction'
    );
  }

  private async handleIntroductionMessage(
    message: IntroductionMessage,
    fromPeerId: string
  ): Promise<void> {
    console.log(`[PeerIntro] Received ${message.action} from ${fromPeerId}`);

    switch (message.action) {
      case 'peer-list':
        this.handlePeerList(message.payload as PeerListPayload);
        break;

      case 'introduce':
        await this.handleIntroduce(message.payload as IntroducePayload, fromPeerId);
        break;

      case 'offer-relay':
        await this.handleOfferRelay(message.payload as OfferRelayPayload, fromPeerId);
        break;

      case 'answer-relay':
        await this.handleAnswerRelay(message.payload as AnswerRelayPayload);
        break;
    }
  }

  private handlePeerList(payload: PeerListPayload): void {
    console.log(`[PeerIntro] Received peer list: ${payload.peers.length} peers`);
    // Store peer info for potential future connections
    // The actual connections will be facilitated by introduce messages
  }

  private async handleIntroduce(
    payload: IntroducePayload,
    hubPeerId: string
  ): Promise<void> {
    console.log(`[PeerIntro] Introduction to ${payload.targetPeerId}`);

    try {
      // Accept the offer and create an answer
      const encoded = btoa(JSON.stringify(payload.offer));
      const { answer } = await this.connectionManager.acceptOffer(encoded);

      // Send answer back through the hub for relay
      const answerRelay: IntroductionMessage = {
        type: 'introduction',
        action: 'answer-relay',
        payload: {
          forPeerId: payload.targetPeerId,
          answer,
        } as AnswerRelayPayload,
        fromPeerId: this.connectionManager.getLocalPeerId(),
        timestamp: Date.now(),
      };

      this.connectionManager.send(hubPeerId, answerRelay);
    } catch (error) {
      console.error('[PeerIntro] Failed to handle introduction:', error);
    }
  }

  private async handleOfferRelay(
    payload: OfferRelayPayload,
    _hubPeerId: string
  ): Promise<void> {
    console.log(`[PeerIntro] Received relayed offer from ${payload.fromPeerId}`);

    try {
      // Accept the relayed offer
      const encoded = btoa(JSON.stringify(payload.offer));
      const { answer } = await this.connectionManager.acceptOffer(encoded);

      // Store answer to be sent back
      // The hub will relay it
      this.pendingIntroductions.set(payload.fromPeerId, {
        targetPeerId: payload.fromPeerId,
        offer: payload.offer,
        timestamp: Date.now(),
      });

      console.log(`[PeerIntro] Created answer for ${payload.fromPeerId}:`, answer.peerId);
    } catch (error) {
      console.error('[PeerIntro] Failed to handle relayed offer:', error);
    }
  }

  private async handleAnswerRelay(payload: AnswerRelayPayload): Promise<void> {
    console.log(`[PeerIntro] Received relayed answer for ${payload.forPeerId}`);

    try {
      // Accept the relayed answer
      const encoded = btoa(JSON.stringify(payload.answer));
      await this.connectionManager.acceptAnswer(encoded);

      // Notify handlers of successful introduction
      const newPeer: MeshPeer = {
        peerId: payload.answer.peerId,
        connectionMethod: 'direct',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      };

      this.introductionHandlers.forEach((h) => h(payload.forPeerId, newPeer));
    } catch (error) {
      console.error('[PeerIntro] Failed to handle relayed answer:', error);
    }
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    this.pendingIntroductions.clear();
    this.introductionHandlers.clear();
    console.log('[PeerIntro] Shutdown complete');
  }
}

// Export singleton
export const peerIntroduction = PeerIntroductionService.getInstance();
export default peerIntroduction;
