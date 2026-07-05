/** Job catalogue — names map 1:1 to /api/jobs/* route handlers. Payloads are typed end-to-end. */
export interface JobMap {
  'otp-send': { userId: string; channel: 'sms' | 'email'; purpose: string };
  'kyc-verify': { userId: string; provider: string; providerRef: string };
  'reconcile-counters': { pollId: number };
  'freeze-results': { pollId: number };
  'audit-checkpoint': { pollId?: number };
  'decay-trends': Record<string, never>;
  'campaign-send': { campaignId: string; batch: number };
  'export-build': { exportId: string; pollId: number; format: 'csv' | 'parquet' };
  'media-process': { objectKey: string; candidateId: string };
  'partition-maintenance': Record<string, never>;
  'receipt-email': { userId: string; pollId: number; receiptId: string };
  'retention-sweep': Record<string, never>;
  'pii-assertion': Record<string, never>;
  'automod-scan': { contentType: 'post' | 'thread' | 'qa'; contentId: string };
  'dlq-handler': { failedUrl?: string; messageId?: string };
}

export type JobName = keyof JobMap;
