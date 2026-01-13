/**
 * Rendering Performance Benchmarks
 *
 * Benchmarks for BitChat's UI rendering performance including:
 * - Message list rendering with 1000+ messages
 * - Channel list with 100+ channels
 * - Initial app load time
 * - Scroll performance (60fps target)
 *
 * ## Performance Targets
 * - First paint: < 2 seconds
 * - Render 1000 messages: < 200ms
 * - Scroll: 60fps (< 16.67ms per frame)
 * - Channel list render: < 50ms for 100 channels
 *
 * Note: These are synthetic benchmarks. For real-world measurements,
 * use the e2e/performance.spec.ts tests with actual browser rendering.
 *
 * @module __benchmarks__/rendering.bench
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  Timer,
  runBenchmark,
  formatBenchmarkResults,
  PERFORMANCE_THRESHOLDS,
  type PerformanceResult,
} from '../utils/performance';
import type { Message, Channel } from '../stores/types';

// Benchmark results collector
const benchmarkResults: PerformanceResult[] = [];

// MARK: - Test Data Generators

/**
 * Generate mock messages for testing
 */
function generateMockMessages(count: number): Message[] {
  const messages: Message[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const isOwn = Math.random() > 0.5;
    messages.push({
      id: `msg_${i}`,
      channelId: 'channel_test',
      senderId: isOwn ? 'self' : `user_${Math.floor(Math.random() * 10)}`,
      senderNickname: isOwn ? 'You' : `User ${Math.floor(Math.random() * 10)}`,
      content: generateRandomContent(),
      timestamp: now - (count - i) * 60000, // 1 minute apart
      status: isOwn ? (['sent', 'delivered', 'pending'] as const)[Math.floor(Math.random() * 3)] ?? 'sent' : 'sent',
      isOwn,
      encrypted: true,
      verified: true,
    });
  }

  return messages;
}

/**
 * Generate random message content
 */
function generateRandomContent(): string {
  const contents = [
    'Hello there!',
    'How are you doing today?',
    'This is a test message with some longer content to simulate real-world usage patterns.',
    'Short msg',
    'The quick brown fox jumps over the lazy dog. This is a classic pangram used for testing.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Check out this link: https://example.com/very/long/path/to/something/interesting',
    'Message with an emoji reference [smile]',
    'Reply to your earlier message - yes, I agree with that approach!',
    'Multi-line message:\n- Point 1\n- Point 2\n- Point 3',
  ];

  return contents[Math.floor(Math.random() * contents.length)]!;
}

/**
 * Generate mock channels for testing
 */
function generateMockChannels(count: number): Channel[] {
  const channels: Channel[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const type = (['location', 'dm', 'public'] as const)[Math.floor(Math.random() * 3)] ?? 'public';
    channels.push({
      id: `channel_${i}`,
      name: type === 'location'
        ? `Location ${i}`
        : type === 'dm'
          ? `User ${i}`
          : `Public ${i}`,
      type,
      description: `Description for channel ${i}`,
      geohash: type === 'location' ? `geohash${i}` : undefined,
      createdAt: now - i * 86400000, // 1 day apart
      lastMessageAt: now - i * 3600000, // 1 hour apart
      unreadCount: Math.floor(Math.random() * 50),
      isPinned: false,
      isMuted: Math.random() > 0.9,
    });
  }

  return channels;
}

// MARK: - Virtual DOM Simulation

/**
 * Simulate message grouping logic (CPU-bound work that happens before render)
 */
function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();

  for (const message of messages) {
    const date = new Date(message.timestamp).toDateString();
    const group = groups.get(date) || [];
    group.push(message);
    groups.set(date, group);
  }

  return groups;
}

/**
 * Simulate channel filtering and grouping
 */
function processChannelList(channels: Channel[]): {
  location: Channel[];
  dm: Channel[];
  public: Channel[];
} {
  const result = {
    location: [] as Channel[],
    dm: [] as Channel[],
    public: [] as Channel[],
  };

  for (const channel of channels) {
    switch (channel.type) {
      case 'location':
        result.location.push(channel);
        break;
      case 'dm':
        result.dm.push(channel);
        break;
      case 'public':
        result.public.push(channel);
        break;
    }
  }

  // Sort each group by last message time
  result.location.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  result.dm.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  result.public.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

  return result;
}

/**
 * Simulate virtual list calculations
 */
function calculateVisibleItems<T>(
  items: T[],
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number
): { startIndex: number; endIndex: number; visibleItems: T[] } {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2; // Buffer
  const endIndex = Math.min(startIndex + visibleCount, items.length);

  return {
    startIndex,
    endIndex,
    visibleItems: items.slice(startIndex, endIndex),
  };
}

/**
 * Simulate message bubble text processing
 */
function processMessageContent(content: string): {
  parts: Array<{ type: string; value: string }>;
  links: string[];
  mentions: string[];
} {
  const parts: Array<{ type: string; value: string }> = [];
  const links: string[] = [];
  const mentions: string[] = [];

  // URL regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  // Mention regex
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;

  let lastIndex = 0;
  let match;

  // Process URLs
  while ((match = urlRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', value: match[1]! });
    links.push(match[1]!);
    lastIndex = urlRegex.lastIndex;
  }

  // Process mentions
  let processed = parts.length > 0 ? '' : content;
  while ((match = mentionRegex.exec(processed)) !== null) {
    mentions.push(match[1]!);
  }

  if (lastIndex < content.length && parts.length > 0) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  } else if (parts.length === 0) {
    parts.push({ type: 'text', value: content });
  }

  return { parts, links, mentions };
}

// MARK: - Tests

describe('Rendering Benchmarks', () => {
  afterAll(() => {
    console.log('\n=== Rendering Benchmark Results ===\n');
    console.log(formatBenchmarkResults(benchmarkResults));
  });

  describe('Message List Processing', () => {
    const messages100 = generateMockMessages(100);
    // Note: messages500 available for intermediate benchmark if needed
    void generateMockMessages(500);
    const messages1000 = generateMockMessages(1000);
    const messages5000 = generateMockMessages(5000);

    it('should benchmark message grouping for 100 messages', async () => {
      const result = await runBenchmark(
        { name: 'Group 100 Messages', iterations: 100, warmup: 10 },
        () => {
          groupMessagesByDate(messages100);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Group 100 messages: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(10);
    });

    it('should benchmark message grouping for 1000 messages', async () => {
      const result = await runBenchmark(
        { name: 'Group 1000 Messages', iterations: 50, warmup: 5 },
        () => {
          groupMessagesByDate(messages1000);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Group 1000 messages: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_1000_MESSAGES);
    });

    it('should benchmark message grouping for 5000 messages', async () => {
      const result = await runBenchmark(
        { name: 'Group 5000 Messages', iterations: 20, warmup: 3 },
        () => {
          groupMessagesByDate(messages5000);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Group 5000 messages: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      // Should still be under 1 second for 5000 messages
      expect(avgDuration).toBeLessThan(1000);
    });

    it('should benchmark message content processing', async () => {
      const result = await runBenchmark(
        { name: 'Process Message Content', iterations: 1000, warmup: 50 },
        () => {
          for (const message of messages100) {
            processMessageContent(message.content);
          }
        }
      );

      benchmarkResults.push(result);

      const avgPerMessage = (result.duration / result.operations) / 100;
      console.log(
        `Process message content: ${avgPerMessage.toFixed(4)}ms per message`
      );

      // Should be very fast
      expect(avgPerMessage).toBeLessThan(0.1);
    });

    it('should benchmark virtual list calculations', async () => {
      const result = await runBenchmark(
        { name: 'Virtual List Calc (1000)', iterations: 1000, warmup: 100 },
        () => {
          // Simulate scrolling through the list
          const scrollPositions = [0, 500, 1000, 5000, 10000, 20000];
          for (const scrollTop of scrollPositions) {
            calculateVisibleItems(messages1000, scrollTop, 600, 60);
          }
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Virtual list calc: ${avgDuration.toFixed(3)}ms per scroll event`
      );

      // Must be fast for 60fps scroll
      expect(avgDuration).toBeLessThan(1);
    });
  });

  describe('Channel List Processing', () => {
    const channels50 = generateMockChannels(50);
    const channels100 = generateMockChannels(100);
    const channels200 = generateMockChannels(200);

    it('should benchmark channel filtering for 50 channels', async () => {
      const result = await runBenchmark(
        { name: 'Process 50 Channels', iterations: 200, warmup: 20 },
        () => {
          processChannelList(channels50);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Process 50 channels: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(10);
    });

    it('should benchmark channel filtering for 100 channels', async () => {
      const result = await runBenchmark(
        { name: 'Process 100 Channels', iterations: 100, warmup: 10 },
        () => {
          processChannelList(channels100);
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Process 100 channels: ${avgDuration.toFixed(3)}ms, ${result.opsPerSecond.toFixed(0)} ops/sec`
      );

      expect(avgDuration).toBeLessThan(50);
    });

    it('should benchmark channel search/filter', async () => {
      const searchTerms = ['loc', 'user', 'public', 'test', 'channel'];

      const result = await runBenchmark(
        { name: 'Search 100 Channels', iterations: 200, warmup: 20 },
        () => {
          const term = searchTerms[Math.floor(Math.random() * searchTerms.length)]!;
          const lowerTerm = term.toLowerCase();

          channels100.filter(
            (channel) =>
              channel.name.toLowerCase().includes(lowerTerm) ||
              channel.description?.toLowerCase().includes(lowerTerm)
          );
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Search 100 channels: ${avgDuration.toFixed(3)}ms per search`
      );

      // Must be fast for responsive search
      expect(avgDuration).toBeLessThan(5);
    });

    it('should benchmark channel sort by activity', async () => {
      const result = await runBenchmark(
        { name: 'Sort 200 Channels', iterations: 100, warmup: 10 },
        () => {
          [...channels200].sort((a, b) => {
            // Sort by unread count first, then by last message
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
            return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
          });
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Sort 200 channels: ${avgDuration.toFixed(3)}ms per sort`
      );

      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Frame Budget Simulation', () => {
    it('should simulate frame budget for message scroll', async () => {
      const messages = generateMockMessages(1000);
      const frameTime = 16.67; // 60fps target
      const frameBudgets: number[] = [];

      for (let i = 0; i < 100; i++) {
        const timer = new Timer().start();

        // Simulate work done per frame during scroll
        const scrollTop = i * 100; // Scroll position
        const visible = calculateVisibleItems(messages, scrollTop, 600, 60);

        // Process visible messages
        for (const msg of visible.visibleItems) {
          processMessageContent(msg.content);
        }

        timer.stop();
        frameBudgets.push(timer.elapsed());
      }

      const avgFrameTime = frameBudgets.reduce((a, b) => a + b, 0) / frameBudgets.length;
      const maxFrameTime = Math.max(...frameBudgets);
      const framesOver = frameBudgets.filter(t => t > frameTime).length;

      console.log('\n=== Frame Budget Analysis ===');
      console.log(`Average frame time: ${avgFrameTime.toFixed(3)}ms`);
      console.log(`Max frame time: ${maxFrameTime.toFixed(3)}ms`);
      console.log(`Frames over budget: ${framesOver}/100`);
      console.log(`Frame budget: ${frameTime.toFixed(2)}ms (60fps)`);

      // Should maintain 60fps most of the time
      expect(avgFrameTime).toBeLessThan(frameTime);
      expect(framesOver).toBeLessThan(10); // Max 10% dropped frames
    });

    it('should simulate frame budget for channel list scroll', async () => {
      const channels = generateMockChannels(200);
      const frameTime = 16.67;
      const frameBudgets: number[] = [];

      for (let i = 0; i < 50; i++) {
        const timer = new Timer().start();

        // Simulate processing during scroll
        const scrollTop = i * 50;
        const visible = calculateVisibleItems(channels, scrollTop, 600, 70);

        // Process visible channels
        processChannelList(visible.visibleItems);

        timer.stop();
        frameBudgets.push(timer.elapsed());
      }

      const avgFrameTime = frameBudgets.reduce((a, b) => a + b, 0) / frameBudgets.length;
      const maxFrameTime = Math.max(...frameBudgets);

      console.log('\n=== Channel List Frame Budget ===');
      console.log(`Average frame time: ${avgFrameTime.toFixed(3)}ms`);
      console.log(`Max frame time: ${maxFrameTime.toFixed(3)}ms`);

      expect(avgFrameTime).toBeLessThan(frameTime);
    });
  });

  describe('Combined Rendering Scenarios', () => {
    it('should benchmark initial chat load scenario', async () => {
      const messages = generateMockMessages(100);
      const channels = generateMockChannels(50);

      const result = await runBenchmark(
        { name: 'Initial Chat Load', iterations: 50, warmup: 5 },
        () => {
          // Process channels
          processChannelList(channels);

          // Group and process messages
          const groups = groupMessagesByDate(messages);

          // Process message content
          for (const [, msgs] of groups) {
            for (const msg of msgs) {
              processMessageContent(msg.content);
            }
          }
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Initial chat load: ${avgDuration.toFixed(3)}ms (target: < ${PERFORMANCE_THRESHOLDS.FIRST_PAINT}ms)`
      );

      // Should be well under 2 seconds
      expect(avgDuration).toBeLessThan(100);
    });

    it('should benchmark channel switch scenario', async () => {
      const messages = generateMockMessages(200);

      const result = await runBenchmark(
        { name: 'Channel Switch', iterations: 100, warmup: 10 },
        () => {
          // Group messages for new channel
          const groups = groupMessagesByDate(messages);

          // Process visible messages (assume top 20 visible)
          let count = 0;
          for (const [, msgs] of groups) {
            for (const msg of msgs) {
              if (count >= 20) break;
              processMessageContent(msg.content);
              count++;
            }
            if (count >= 20) break;
          }
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `Channel switch: ${avgDuration.toFixed(3)}ms`
      );

      // Should be instant
      expect(avgDuration).toBeLessThan(50);
    });

    it('should benchmark new message arrival scenario', async () => {
      const existingMessages = generateMockMessages(500);
      const newMessage = generateMockMessages(1)[0]!;

      const result = await runBenchmark(
        { name: 'New Message Arrival', iterations: 200, warmup: 20 },
        () => {
          // Add new message
          const messages = [...existingMessages, newMessage];

          // Re-calculate visible items (scroll at bottom)
          const totalHeight = messages.length * 60;
          const visible = calculateVisibleItems(
            messages,
            totalHeight - 600, // Scrolled to bottom
            600,
            60
          );

          // Process the new visible messages
          for (const msg of visible.visibleItems.slice(-5)) {
            processMessageContent(msg.content);
          }
        }
      );

      benchmarkResults.push(result);

      const avgDuration = result.duration / result.operations;
      console.log(
        `New message arrival: ${avgDuration.toFixed(3)}ms`
      );

      // Must be instant for good UX
      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Memory Efficiency', () => {
    it('should efficiently handle large message arrays', () => {
      const timer = new Timer().start();

      // Create 10000 messages
      const messages = generateMockMessages(10000);

      // Process all
      groupMessagesByDate(messages);

      timer.stop();

      console.log(
        `Create and process 10000 messages: ${timer.elapsed().toFixed(0)}ms`
      );

      // Should complete in reasonable time
      expect(timer.elapsed()).toBeLessThan(5000);
    });

    it('should handle rapid filter updates', async () => {
      const channels = generateMockChannels(100);
      const searchTerms = ['a', 'ab', 'abc', 'test', 'loc', 'user', 'dm', 'public'];

      const result = await runBenchmark(
        { name: 'Rapid Filter Updates', iterations: 100, warmup: 10 },
        () => {
          // Simulate typing in search box
          for (const term of searchTerms) {
            const lowerTerm = term.toLowerCase();
            channels.filter(
              (c) =>
                c.name.toLowerCase().includes(lowerTerm) ||
                c.description?.toLowerCase().includes(lowerTerm)
            );
          }
        }
      );

      benchmarkResults.push(result);

      const avgPerKeystroke = (result.duration / result.operations) / searchTerms.length;
      console.log(
        `Filter per keystroke: ${avgPerKeystroke.toFixed(3)}ms`
      );

      // Must be instant for responsive typing
      expect(avgPerKeystroke).toBeLessThan(2);
    });
  });
});
