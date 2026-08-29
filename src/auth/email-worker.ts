import { and, eq, gt, isNull, lt, lte, or } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';

import { db } from '../database/index.js';
import { emailJobs } from '../database/schema.js';
import { decryptLoginCode, sendLoginCode } from './email.js';

const pollIntervalMs = 5_000;
const staleLockMs = 60_000;
const maxAttempts = 5;

export class EmailWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private activeRun: Promise<void> | undefined;

  constructor(private readonly log: FastifyBaseLogger) {}

  start(): void {
    if (this.timer) return;

    this.run();
    this.timer = setInterval(() => this.run(), pollIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    await this.activeRun;
  }

  private run(): void {
    if (this.activeRun) return;

    this.activeRun = this.processJobs()
      .catch((error) => this.log.error({ err: error }, 'Email worker failed'))
      .finally(() => {
        this.activeRun = undefined;
      });
  }

  private async claimJobs() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - staleLockMs);

    return db.transaction(async (tx) => {
      const jobs = await tx
        .select()
        .from(emailJobs)
        .where(
          and(
            lt(emailJobs.attemptCount, maxAttempts),
            lte(emailJobs.nextAttemptAt, now),
            gt(emailJobs.expiresAt, now),
            or(isNull(emailJobs.lockedAt), lt(emailJobs.lockedAt, staleBefore))
          )
        )
        .orderBy(emailJobs.createdAt)
        .limit(10)
        .for('update', { skipLocked: true });

      for (const job of jobs) {
        await tx
          .update(emailJobs)
          .set({ lockedAt: now })
          .where(eq(emailJobs.id, job.id));
      }

      return jobs;
    });
  }

  private async processJobs(): Promise<void> {
    const jobs = await this.claimJobs();

    for (const job of jobs) {
      try {
        await sendLoginCode(job.recipient, decryptLoginCode(job.encryptedCode));
        await db.delete(emailJobs).where(eq(emailJobs.id, job.id));
      } catch (error) {
        const nextAttemptCount = job.attemptCount + 1;
        const retryDelayMs = Math.min(
          2 ** nextAttemptCount * pollIntervalMs,
          staleLockMs
        );

        await db
          .update(emailJobs)
          .set({
            attemptCount: nextAttemptCount,
            lockedAt: null,
            lastError:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : 'Unknown error',
            nextAttemptAt: new Date(Date.now() + retryDelayMs),
          })
          .where(eq(emailJobs.id, job.id));

        this.log.error(
          { err: error, emailJobId: job.id },
          'Could not send queued email'
        );
      }
    }

    await db.delete(emailJobs).where(lte(emailJobs.expiresAt, new Date()));
  }
}
