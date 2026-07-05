import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { PollSignals } from '@voter/redis';
import { computeSnapshot } from './snapshot';

/**
 * SSE hub (ADR-0005). Splits the two roles:
 *  - Aggregation: exactly ONE leader per poll (Redis lock) recomputes the snapshot on each tick and
 *    writes the single poll:{id}:snapshot key. Leader heartbeat-refreshes regardless of publishes.
 *  - Fan-out: THIS (and every) instance reads the snapshot key and pushes to its connected clients,
 *    so instances scale horizontally for connection count without write races.
 */
const TICK_MS = Number(process.env.SSE_TICK_MS ?? '1000');

export class SseHub {
  private readonly instanceId = randomUUID();
  private readonly signals = new PollSignals();
  private readonly clients = new Map<number, Set<ServerResponse>>();
  private timer: NodeJS.Timeout | undefined;

  start(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const set of this.clients.values()) for (const res of set) res.end();
    this.clients.clear();
  }

  get connectionCount(): number {
    let n = 0;
    for (const set of this.clients.values()) n += set.size;
    return n;
  }

  addClient(pollId: number, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    let set = this.clients.get(pollId);
    if (!set) {
      set = new Set();
      this.clients.set(pollId, set);
    }
    set.add(res);
    // Send the current snapshot immediately so a new client never sees an empty flash.
    void this.pushLatest(pollId, res);
    res.on('close', () => {
      set?.delete(res);
      if (set && set.size === 0) this.clients.delete(pollId);
    });
  }

  private async tick(): Promise<void> {
    for (const pollId of this.clients.keys()) {
      // Aggregation: only the leader recomputes + writes the snapshot.
      if (await this.signals.tryAcquireLeader(pollId, this.instanceId, Math.ceil((TICK_MS * 15) / 1000))) {
        const snapshot = await computeSnapshot(pollId);
        await this.signals.writeSnapshot(pollId, snapshot);
        await this.signals.clearDirty(pollId);
      }
      // Fan-out: every instance pushes the latest snapshot to its own clients.
      await this.broadcast(pollId);
    }
  }

  private async broadcast(pollId: number): Promise<void> {
    const set = this.clients.get(pollId);
    if (!set || set.size === 0) return;
    const snapshot = await this.signals.readSnapshot<unknown>(pollId);
    if (!snapshot) return;
    const frame = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
    for (const res of set) res.write(frame);
  }

  private async pushLatest(pollId: number, res: ServerResponse): Promise<void> {
    const snapshot = await this.signals.readSnapshot<unknown>(pollId);
    if (snapshot) res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }
}
