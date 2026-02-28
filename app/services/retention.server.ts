export type RetentionRunResult = {
  deletedRequests: number;
  deletedReplayAttempts: number;
};

export interface RetentionJob {
  run(endpointId: string, retainDays: number): Promise<RetentionRunResult>;
}

export class NoopRetentionJob implements RetentionJob {
  async run(): Promise<RetentionRunResult> {
    return { deletedRequests: 0, deletedReplayAttempts: 0 };
  }
}
