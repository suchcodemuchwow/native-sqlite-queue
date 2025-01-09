import {DatabaseSync} from 'node:sqlite';
import {readSqlFile} from './utils/file';
import * as path from 'path';

/**
 * Representss a path to a SQLite database file or an in-memory database.
 * @typedef {string | ":memory:"} Path
 */
export type Path = string | ':memory:';

interface Job {
  id: number;
  payload: string;
  status:
    | 'waiting'
    | 'active'
    | 'completed'
    | 'failed'
    | 'delayed'
    | 'paused'
    | 'stalled'
    | 'removed';
  priority: number;
  created_at: string;
  updated_at: string;
  locked_by?: string;
  result?: string;
  error?: string;
  retry_count: number;
  available_at: string;
}

/**
 * A queue implementation using SQLite as the backend storage.
 *
 * @example
 * import {Queue} from 'native-sqlite-queue';
 *
 * const queue = new Queue(':memory:');
 * queue.add('{"task": "process_image"}');
 * const nextJob = queue.nextJob();
 */
export class Queue {
  private db: DatabaseSync;

  /**
   * Creates a new Sqlite Queue instance.
   *
   * @param {Path} database - The path to the SQLite database file or ':memory:' for an in-memory database.
   *
   * @example
   * // Create an in-memory queue
   * const memoryQueue = new Queue(':memory:');
   *
   * @example
   * // Create a queue with a file-based database
   * const fileQueue = new Queue('./my_queue.db');
   */
  constructor(database: Path) {
    this.db = new DatabaseSync(database);
    this.checkTables();
  }

  /**
   * Ensures the required tables exist in the database.
   * This method is called automatically by the constructor.
   *
   * @private
   */
  private checkTables() {
    const jobsSql = readSqlFile(path.join(__dirname, 'sql', 'jobs.sql'));
    this.db.exec(jobsSql);
  }

  /**
   * Adds a new job to the queue.
   *
   * @param {string} payload - The job payload, typically a JSON string.
   * @param {number} [priority=0] - The job priority.
   *
   * @example
   * const queue = new Queue(':memory:');
   * queue.add('{"task": "send_email", "to": "user@example.com"}');
   */
  add(payload: string, priority = 0) {
    const sql = `INSERT INTO jobs (payload, status, priority)
                 VALUES (?, 'waiting', ?)`;
    const addJob = this.db.prepare(sql);
    addJob.run(payload, priority);
  }

  /**
   * Retrieves the next waiting job from the queue.
   * Jobs are ordered by priority (ascending) and creation time (ascending).
   *
   * @returns {Job | undefined} The next job object, or undefined if no pending jobs are available.
   *
   * @example
   * const queue = new Queue(':memory:');
   * queue.add('{"task": "process_data"}');
   * const nextJob = queue.next();
   * if (nextJob) {
   *   console.log(nextJob.payload); // '{"task": "process_data"}'
   *   console.log(nextJob.status);  // 'processing'
   * }
   */
  private next(): Job | undefined {
    const sql = `
      SELECT * FROM jobs
      WHERE status = 'waiting' AND locked_by IS NULL
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `;
    const job = this.db.prepare(sql);
    const jobRow = job.get() as Job | undefined;

    if (jobRow) {
      // Update the job status to "active" and set the lock
      const updateSql = `
        UPDATE jobs
        SET status = 'active', locked_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND locked_by IS NULL
      `;
      const updateJob = this.db.prepare(updateSql);
      const lockId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = updateJob.run(lockId, jobRow.id);

      if (result.changes === 1) {
        // Job was successfully locked and updated
        return {...jobRow, status: 'active', locked_by: lockId};
      } else {
        // Job was locked by another worker, try again
        return this.next();
      }
    }

    return undefined;
  }

  /**
   * Process the next available job in the queue.
   *
   * @param {function} processor - A function that processes the job payload.
   * @returns {Promise<Job | undefined>} The processed job or undefined if no job was available.
   *
   * @example
   * const queue = new Queue(':memory:');
   * await queue.process(async (job) => {
   *   console.log('Processing job:', job.payload);
   *   // Process the job...
   *   return 'Job result';
   * });
   */
  async process(
    processor: (job: Job) => Promise<any>
  ): Promise<Job | undefined> {
    const job = this.next();
    if (!job) return undefined;

    try {
      const result = await processor(job);
      this.complete(job.id, result);
      return {...job, status: 'completed', result};
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error).replace(/^Error:\s*/, '');
      this.fail(job.id, errorMessage);
      return {...job, status: 'failed', error: errorMessage};
    }
  }

  /**
   * Mark a job as completed.
   *
   * @param {number} jobId - The ID of the job to mark as completed.
   * @param {any} [result] - Optional result of the job processing.
   */
  complete(jobId: number, result?: any) {
    const sql = `
      UPDATE jobs
      SET status = 'completed', locked_by = NULL, updated_at = CURRENT_TIMESTAMP, result = ?
      WHERE id = ?
    `;
    const completeJob = this.db.prepare(sql);
    completeJob.run(result ? JSON.stringify(result) : null, jobId);
  }

  /**
   * Mark a job as failed.
   *
   * @param {number} jobId - The ID of the job to mark as failed.
   * @param {string} [error] - Optional error message describing why the job failed.
   */
  fail(jobId: number, error?: string) {
    const sql = `
      UPDATE jobs
      SET status = 'failed', locked_by = NULL, updated_at = CURRENT_TIMESTAMP, error = ?
      WHERE id = ?
    `;
    const failJob = this.db.prepare(sql);
    failJob.run(error || null, jobId);
  }

  /**
   * Retry a failed job.
   *
   * @param {number} jobId - The ID of the failed job to retry.
   * @param {number} [delay=0] - The delay in milliseconds before the job should be retried.
   */
  retry(jobId: number, delay = 0) {
    const sql = `
      UPDATE jobs
      SET status = 'waiting', locked_by = NULL, updated_at = CURRENT_TIMESTAMP,
          error = NULL, retry_count = COALESCE(retry_count, 0) + 1,
          available_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
      WHERE id = ? AND status = 'failed'
    `;
    const retryJob = this.db.prepare(sql);
    retryJob.run(Math.floor(delay / 1000), jobId);
  }
}
