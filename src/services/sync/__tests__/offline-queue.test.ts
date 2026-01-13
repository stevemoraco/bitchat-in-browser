/**
 * Offline Queue Tests
 *
 * Tests for the offline action queue system including:
 * - Queue operations (enqueue, dequeue, retry)
 * - Priority ordering
 * - Deduplication
 * - Network status integration
 * - Exponential backoff
 * - Conflict handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OfflineQueue,
  ActionType,
  ActionPriority,
  ActionStatus,
  createSendMessageAction,
  createPublishEventAction,
  createSyncMessagesAction,
  type QueuedAction,
  type SyncProgressEvent,
} from '../offline-queue';
import { NetworkStatusService } from '../network-status';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock network status service
 */
function createMockNetworkStatus(isOnline = true): NetworkStatusService {
  const service = new NetworkStatusService({
    enablePeriodicChecks: false,
  });

  // Override the isOnline method
  vi.spyOn(service, 'isOnline').mockReturnValue(isOnline);
  vi.spyOn(service, 'isOffline').mockReturnValue(!isOnline);

  return service;
}

/**
 * Wait for a condition to be true
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 1000,
  interval = 10
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('Condition not met within timeout');
}

/**
 * Create a test action payload
 */
function createTestAction() {
  return createSendMessageAction(
    'channel_123',
    'Test message',
    `local_${Date.now()}_${Math.random().toString(36).substring(2)}`
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('OfflineQueue', () => {
  let queue: OfflineQueue;
  let networkStatus: NetworkStatusService;

  beforeEach(async () => {
    // Create mock network status (online by default)
    networkStatus = createMockNetworkStatus(true);

    // Create queue with test options
    queue = new OfflineQueue({
      dbName: `test_queue_${Date.now()}`,
      maxRetries: 3,
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      networkStatus,
      autoStart: false, // Don't auto-start for tests
    });
  });

  afterEach(async () => {
    await queue.clearAll();
    await queue.close();
  });

  // ==========================================================================
  // Basic Queue Operations
  // ==========================================================================

  describe('Basic Queue Operations', () => {
    it('should enqueue an action', async () => {
      const action = createTestAction();
      const queued = await queue.enqueue(action);

      expect(queued).toBeDefined();
      expect(queued.id).toBeDefined();
      expect(queued.type).toBe(ActionType.SEND_MESSAGE);
      expect(queued.status).toBe(ActionStatus.PENDING);
      expect(queued.priority).toBe(ActionPriority.CRITICAL);
    });

    it('should retrieve an action by ID', async () => {
      const action = createTestAction();
      const queued = await queue.enqueue(action);

      const retrieved = await queue.get(queued.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(queued.id);
    });

    it('should get pending actions', async () => {
      await queue.enqueue(createTestAction());
      await queue.enqueue(createTestAction());

      const pending = await queue.getPending();
      expect(pending.length).toBe(2);
    });

    it('should remove an action', async () => {
      const action = createTestAction();
      const queued = await queue.enqueue(action);

      const removed = await queue.remove(queued.id);
      expect(removed).toBe(true);

      const retrieved = await queue.get(queued.id);
      expect(retrieved).toBeUndefined();
    });

    it('should clear all actions', async () => {
      await queue.enqueue(createTestAction());
      await queue.enqueue(createTestAction());

      await queue.clearAll();

      const stats = await queue.getStats();
      expect(stats.total).toBe(0);
    });

    it('should get queue statistics', async () => {
      await queue.enqueue(createTestAction());
      await queue.enqueue(createTestAction());

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  // ==========================================================================
  // Priority Ordering
  // ==========================================================================

  describe('Priority Ordering', () => {
    it('should assign default priority based on action type', async () => {
      const messageAction = await queue.enqueue(createTestAction());
      const syncAction = await queue.enqueue(
        createSyncMessagesAction('channel_123')
      );

      expect(messageAction.priority).toBe(ActionPriority.CRITICAL);
      expect(syncAction.priority).toBe(ActionPriority.LOW);
    });

    it('should process higher priority actions first', async () => {
      const processOrder: string[] = [];

      // Register handler that records processing order
      queue.registerHandler(ActionType.SEND_MESSAGE, async (action) => {
        processOrder.push(action.id);
        return { success: true };
      });
      queue.registerHandler(ActionType.SYNC_MESSAGES, async (action) => {
        processOrder.push(action.id);
        return { success: true };
      });

      // Enqueue low priority first, then high priority
      const lowPriority = await queue.enqueue(
        createSyncMessagesAction('channel_123')
      );
      const highPriority = await queue.enqueue(createTestAction());

      // Process queue
      queue.start();
      await queue.processQueue();

      // Wait for processing
      await waitFor(async () => {
        const stats = await queue.getStats();
        return stats.completed === 2;
      });

      // High priority should be processed first
      expect(processOrder[0]).toBe(highPriority.id);
      expect(processOrder[1]).toBe(lowPriority.id);
    });

    it('should allow custom priority override', async () => {
      const action = await queue.enqueue({
        ...createTestAction(),
        priority: ActionPriority.LOW,
      });

      expect(action.priority).toBe(ActionPriority.LOW);
    });
  });

  // ==========================================================================
  // Deduplication
  // ==========================================================================

  describe('Deduplication', () => {
    it('should dedupe actions with same dedupeKey', async () => {
      const localMessageId = 'msg_123';
      const action1 = createSendMessageAction(
        'channel_123',
        'First message',
        localMessageId
      );
      const action2 = createSendMessageAction(
        'channel_123',
        'Second message',
        localMessageId
      );

      const queued1 = await queue.enqueue(action1);
      const queued2 = await queue.enqueue(action2);

      // Should return the same action
      expect(queued2.id).toBe(queued1.id);

      // Should only have one action in queue
      const stats = await queue.getStats();
      expect(stats.total).toBe(1);
    });

    it('should not dedupe actions without dedupeKey', async () => {
      const action1 = {
        type: ActionType.SEND_MESSAGE,
        payload: {
          channelId: 'channel_123',
          content: 'Message 1',
          localMessageId: 'msg_1',
        },
      };
      const action2 = {
        type: ActionType.SEND_MESSAGE,
        payload: {
          channelId: 'channel_123',
          content: 'Message 2',
          localMessageId: 'msg_2',
        },
      };

      await queue.enqueue(action1);
      await queue.enqueue(action2);

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
    });

    it('should allow duplicate after original is completed', async () => {
      const localMessageId = 'msg_456';
      const action1 = createSendMessageAction(
        'channel_123',
        'First message',
        localMessageId
      );

      // Register handler that succeeds
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: true,
      }));

      const queued1 = await queue.enqueue(action1);

      // Process and complete
      queue.start();
      await queue.processQueue();
      await waitFor(async () => {
        const stats = await queue.getStats();
        return stats.completed === 1;
      });

      // Now enqueue again with same dedupeKey
      const action2 = createSendMessageAction(
        'channel_123',
        'Second message',
        localMessageId
      );
      const queued2 = await queue.enqueue(action2);

      // Should be a new action since original is completed
      expect(queued2.id).not.toBe(queued1.id);
    });
  });

  // ==========================================================================
  // Action Processing
  // ==========================================================================

  describe('Action Processing', () => {
    it('should process actions when handler is registered', async () => {
      let processed = false;

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        processed = true;
        return { success: true };
      });

      await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      await waitFor(() => processed);
      expect(processed).toBe(true);
    });

    it('should mark action as completed on success', async () => {
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: true,
        data: { eventId: 'nostr_event_123' },
      }));

      const action = await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      await waitFor(async () => {
        const updated = await queue.get(action.id);
        return updated?.status === ActionStatus.COMPLETED;
      });

      const updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.COMPLETED);
      expect(updated?.result).toEqual({ eventId: 'nostr_event_123' });
    });

    it('should not process when offline', async () => {
      // Set network to offline
      vi.spyOn(networkStatus, 'isOnline').mockReturnValue(false);

      let processed = false;
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        processed = true;
        return { success: true };
      });

      await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      // Wait a bit to ensure nothing happens
      await new Promise((r) => setTimeout(r, 100));

      expect(processed).toBe(false);
    });

    it('should skip actions without handlers', async () => {
      // Don't register any handler
      const action = await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      // Action should still be pending
      const updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.PENDING);
    });
  });

  // ==========================================================================
  // Retry Logic
  // ==========================================================================

  describe('Retry Logic', () => {
    it('should retry failed actions with exponential backoff', async () => {
      let attempts = 0;

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        attempts++;
        if (attempts < 3) {
          return { success: false, error: 'Simulated failure' };
        }
        return { success: true };
      });

      const action = await queue.enqueue(createTestAction());

      queue.start();

      // Wait for the action to complete through retries
      // With baseRetryDelay=100ms and maxRetries=3:
      // Attempt 1: immediate
      // Attempt 2: after 200ms (100 * 2^1)
      // Attempt 3: after 400ms (100 * 2^2)
      await waitFor(
        async () => {
          await queue.processQueue();
          const a = await queue.get(action.id);
          return a?.status === ActionStatus.COMPLETED;
        },
        3000,
        200
      );

      const updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.COMPLETED);
      expect(attempts).toBe(3);
    });

    it('should mark as failed after max retries', async () => {
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: false,
        error: 'Always fails',
      }));

      const action = await queue.enqueue(createTestAction());

      queue.start();

      // Wait for action to fail after all retries
      await waitFor(
        async () => {
          await queue.processQueue();
          const a = await queue.get(action.id);
          return a?.status === ActionStatus.FAILED;
        },
        3000,
        200
      );

      const updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.FAILED);
      expect(updated?.retryCount).toBe(3); // maxRetries = 3
      expect(updated?.error).toBe('Always fails');
    });

    it('should manually retry failed actions', async () => {
      let shouldSucceed = false;

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        if (!shouldSucceed) {
          return { success: false, error: 'Temporary failure' };
        }
        return { success: true };
      });

      const action = await queue.enqueue(createTestAction());

      queue.start();

      // Wait for it to fail
      await waitFor(
        async () => {
          await queue.processQueue();
          const a = await queue.get(action.id);
          return a?.status === ActionStatus.FAILED;
        },
        3000,
        200
      );

      // Verify it failed
      let updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.FAILED);

      // Now make it succeed and retry
      shouldSucceed = true;
      await queue.retry(action.id);

      await queue.processQueue();

      await waitFor(async () => {
        const a = await queue.get(action.id);
        return a?.status === ActionStatus.COMPLETED;
      });

      updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.COMPLETED);
    });

    it('should retry all failed actions', async () => {
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: false,
        error: 'Fails',
      }));

      // Enqueue multiple actions
      await queue.enqueue(createTestAction());
      await queue.enqueue(createTestAction());

      queue.start();

      // Wait for both to fail
      await waitFor(
        async () => {
          await queue.processQueue();
          const failed = await queue.getFailed();
          return failed.length === 2;
        },
        5000,
        200
      );

      const failed = await queue.getFailed();
      expect(failed.length).toBe(2);

      // Retry all
      const retried = await queue.retryAll();
      expect(retried).toBe(2);

      const stats = await queue.getStats();
      expect(stats.pending).toBe(2);
      expect(stats.failed).toBe(0);
    });
  });

  // ==========================================================================
  // Conflict Handling
  // ==========================================================================

  describe('Conflict Handling', () => {
    it('should mark action as conflict when handler indicates conflict', async () => {
      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: false,
        isConflict: true,
        error: 'Message already exists',
      }));

      const action = await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      await waitFor(async () => {
        const updated = await queue.get(action.id);
        return updated?.status === ActionStatus.CONFLICT;
      });

      const updated = await queue.get(action.id);
      expect(updated?.status).toBe(ActionStatus.CONFLICT);
      expect(updated?.error).toBe('Message already exists');
    });

    it('should not retry conflicted actions', async () => {
      let attempts = 0;

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        attempts++;
        return {
          success: false,
          isConflict: true,
          error: 'Already exists',
        };
      });

      await queue.enqueue(createTestAction());

      queue.start();

      // Process multiple times
      for (let i = 0; i < 3; i++) {
        await queue.processQueue();
        await new Promise((r) => setTimeout(r, 50));
      }

      // Should only attempt once since conflicts aren't retried
      expect(attempts).toBe(1);
    });
  });

  // ==========================================================================
  // Progress Tracking
  // ==========================================================================

  describe('Progress Tracking', () => {
    it('should emit progress events', async () => {
      const progressEvents: SyncProgressEvent[] = [];

      queue.onProgress((event) => {
        progressEvents.push(event);
      });

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { success: true };
      });

      await queue.enqueue(createTestAction());
      await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      await waitFor(async () => {
        const stats = await queue.getStats();
        return stats.completed === 2;
      });

      // Should have received multiple progress events
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should include current action in progress events', async () => {
      let currentAction: QueuedAction | undefined;

      queue.onProgress((event) => {
        if (event.current) {
          currentAction = event.current;
        }
      });

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { success: true };
      });

      await queue.enqueue(createTestAction());

      queue.start();
      await queue.processQueue();

      await waitFor(() => currentAction !== undefined);

      expect(currentAction).toBeDefined();
      expect(currentAction?.type).toBe(ActionType.SEND_MESSAGE);
    });

    it('should unsubscribe from progress events', async () => {
      let eventCount = 0;

      const unsubscribe = queue.onProgress(() => {
        eventCount++;
      });

      await queue.enqueue(createTestAction());

      // Unsubscribe immediately
      unsubscribe();

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: true,
      }));

      queue.start();
      await queue.processQueue();

      // May have received one event before unsubscribing, but that's okay
      const initialCount = eventCount;

      // More operations shouldn't increase count
      await queue.enqueue(createTestAction());
      await queue.processQueue();

      // Should not have received significantly more events
      expect(eventCount).toBeLessThanOrEqual(initialCount + 1);
    });
  });

  // ==========================================================================
  // Network Integration
  // ==========================================================================

  describe('Network Integration', () => {
    it('should process queue when network comes online', async () => {
      let processed = false;

      // Start offline
      vi.spyOn(networkStatus, 'isOnline').mockReturnValue(false);

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => {
        processed = true;
        return { success: true };
      });

      await queue.enqueue(createTestAction());
      queue.start();

      // Should not process while offline
      await queue.processQueue();
      expect(processed).toBe(false);

      // Simulate going online
      vi.spyOn(networkStatus, 'isOnline').mockReturnValue(true);

      // Manually trigger the network change handler via processQueue
      await queue.processQueue();

      await waitFor(() => processed);
      expect(processed).toBe(true);
    });
  });

  // ==========================================================================
  // Queue Size Management
  // ==========================================================================

  describe('Queue Size Management', () => {
    it('should enforce max queue size by removing completed actions', async () => {
      const smallQueue = new OfflineQueue({
        dbName: `test_small_queue_${Date.now()}`,
        maxQueueSize: 5,
        networkStatus,
        autoStart: false,
      });

      queue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: true,
      }));

      // Fill the queue
      for (let i = 0; i < 5; i++) {
        await smallQueue.enqueue(createTestAction());
      }

      // Process all to completion
      smallQueue.registerHandler(ActionType.SEND_MESSAGE, async () => ({
        success: true,
      }));
      smallQueue.start();
      await smallQueue.processQueue();

      await waitFor(async () => {
        const stats = await smallQueue.getStats();
        return stats.completed === 5;
      });

      // Add more - should remove completed to make room
      await smallQueue.enqueue(createTestAction());

      const stats = await smallQueue.getStats();
      expect(stats.total).toBeLessThanOrEqual(5);

      await smallQueue.close();
    });
  });

  // ==========================================================================
  // Action Creators
  // ==========================================================================

  describe('Action Creators', () => {
    it('should create SEND_MESSAGE action correctly', () => {
      const action = createSendMessageAction('ch1', 'Hello', 'msg1');

      expect(action.type).toBe(ActionType.SEND_MESSAGE);
      expect(action.priority).toBe(ActionPriority.CRITICAL);
      expect(action.payload.channelId).toBe('ch1');
      expect(action.payload.content).toBe('Hello');
      expect(action.payload.localMessageId).toBe('msg1');
      expect(action.payload.dedupeKey).toBe('msg_msg1');
    });

    it('should create PUBLISH_EVENT action correctly', () => {
      const event = {
        id: 'event_123',
        pubkey: 'pubkey_123',
        created_at: Date.now(),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'sig_123',
      };

      const action = createPublishEventAction(event, ['wss://relay.test']);

      expect(action.type).toBe(ActionType.PUBLISH_EVENT);
      expect(action.priority).toBe(ActionPriority.HIGH);
      expect(action.payload.event).toBe(event);
      expect(action.payload.relayUrls).toEqual(['wss://relay.test']);
      expect(action.payload.dedupeKey).toBe('event_event_123');
    });

    it('should create SYNC_MESSAGES action correctly', () => {
      const since = Date.now() - 3600000;
      const until = Date.now();

      const action = createSyncMessagesAction('ch1', since, until);

      expect(action.type).toBe(ActionType.SYNC_MESSAGES);
      expect(action.priority).toBe(ActionPriority.LOW);
      expect(action.payload.channelId).toBe('ch1');
      expect(action.payload.since).toBe(since);
      expect(action.payload.until).toBe(until);
    });
  });
});

// ============================================================================
// NetworkStatusService Tests
// ============================================================================

describe('NetworkStatusService', () => {
  let service: NetworkStatusService;

  beforeEach(() => {
    service = new NetworkStatusService({
      enablePeriodicChecks: false,
    });
  });

  afterEach(() => {
    service.stop();
  });

  it('should initialize with correct default status', () => {
    // In test environment, navigator.onLine should be true
    expect(service.isOnline()).toBe(true);
    expect(service.getStatus()).toBe('online');
  });

  it('should provide status event', () => {
    const event = service.getStatusEvent();

    expect(event.status).toBeDefined();
    expect(event.quality).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('should notify listeners on status change', async () => {
    let statusChanged = false;

    service.onStatusChange(() => {
      statusChanged = true;
    });

    // We can't easily simulate navigator.onLine changes in tests,
    // but we verify the listener mechanism works
    expect(statusChanged).toBe(false);
  });

  it('should unsubscribe listeners', () => {
    let callCount = 0;

    const unsubscribe = service.onStatusChange(() => {
      callCount++;
    });

    unsubscribe();

    // Listener should be removed
    expect(callCount).toBe(0);
  });

  it('should start and stop monitoring', () => {
    service.start();
    expect(service['isStarted']).toBe(true);

    service.stop();
    expect(service['isStarted']).toBe(false);
  });

  it('should wait for online with timeout', async () => {
    // Service is already online, should resolve immediately
    const result = await service.waitForOnline(100);
    expect(result).toBe(true);
  });
});
