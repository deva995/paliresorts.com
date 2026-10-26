import { logger } from '../utils/logger.js';

export interface RealtimeEvent<T = unknown> {
  outletId: string;
  channel: string;
  sequenceNumber: number;
  eventType: string;
  payload: T;
  timestamp: string;
}

export interface RealtimeBroadcaster {
  publish(event: RealtimeEvent): Promise<void>;
  subscribe(
    outletId: string,
    channel: string,
    handler: (event: RealtimeEvent) => void
  ): Promise<() => void>;
}

/**
 * ARCHITECTURAL DECISION (Phase B0):
 * In a pooled connection architecture (Neon / PgBouncer in transaction pooling),
 * PostgreSQL LISTEN/NOTIFY is fundamentally incompatible because clients are multiplexed
 * and connections cannot maintain long-lived session state.
 *
 * For Phase B4, cross-instance event propagation across Cloud Run containers
 * will use Redis Pub/Sub via this RealtimeBroadcaster interface.
 * An In-Process Fallback Broadcaster is provided for single-container execution and tests.
 */
export class InMemoryRealtimeBroadcaster implements RealtimeBroadcaster {
  private handlers = new Map<string, Set<(event: RealtimeEvent) => void>>();

  async publish(event: RealtimeEvent): Promise<void> {
    const key = `${event.outletId}:${event.channel}`;
    const channelHandlers = this.handlers.get(key);
    if (channelHandlers) {
      for (const handler of channelHandlers) {
        try {
          handler(event);
        } catch (err) {
          logger.error('Error executing realtime event handler', {
            error: (err as Error).message,
            key
          });
        }
      }
    }
  }

  async subscribe(
    outletId: string,
    channel: string,
    handler: (event: RealtimeEvent) => void
  ): Promise<() => void> {
    const key = `${outletId}:${channel}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    const set = this.handlers.get(key)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(key);
      }
    };
  }
}

export const realtimeBroadcaster: RealtimeBroadcaster = new InMemoryRealtimeBroadcaster();
