import { Client } from '@upstash/qstash';
import type { JobMap, JobName } from './jobs';

/**
 * Typed QStash publisher. Every job is enqueued (never run inline). Idempotency is provided via an
 * Upstash-Deduplication-Id so retries/double-enqueues don't double-process.
 */
export class JobPublisher {
  private readonly client: Client;
  private readonly baseUrl: string;

  constructor(opts?: { token?: string; baseUrl?: string }) {
    this.client = new Client({ token: opts?.token ?? process.env.QSTASH_TOKEN ?? '' });
    this.baseUrl = opts?.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  }

  async publish<T extends JobName>(
    job: T,
    body: JobMap[T],
    opts?: { dedupId?: string; delaySeconds?: number },
  ): Promise<void> {
    await this.client.publishJSON({
      url: `${this.baseUrl}/api/jobs/${job}`,
      body,
      ...(opts?.dedupId ? { deduplicationId: opts.dedupId } : {}),
      ...(opts?.delaySeconds ? { delay: opts.delaySeconds } : {}),
      retries: 3,
      failureCallback: `${this.baseUrl}/api/jobs/dlq-handler`,
    });
  }

  /** Core QueuePort impl — enqueue the post-vote receipt email. */
  async enqueueReceiptEmail(params: { userId: string; pollId: number; receiptId: string }): Promise<void> {
    await this.publish('receipt-email', params, { dedupId: `receipt:${params.receiptId}` });
  }

  async enqueueFreezeResults(pollId: number): Promise<void> {
    await this.publish('freeze-results', { pollId }, { dedupId: `freeze:${pollId}` });
  }

  async enqueueReconcile(pollId: number): Promise<void> {
    await this.publish('reconcile-counters', { pollId });
  }

  async enqueueAutomod(contentType: 'post' | 'thread' | 'qa', contentId: string): Promise<void> {
    await this.publish('automod-scan', { contentType, contentId }, { dedupId: `automod:${contentType}:${contentId}` });
  }
}

let _publisher: JobPublisher | undefined;
export function getPublisher(): JobPublisher {
  if (!_publisher) _publisher = new JobPublisher();
  return _publisher;
}
