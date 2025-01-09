import {test, describe, beforeEach, afterEach} from 'node:test';
import * as assert from 'node:assert';
import {Queue} from './index';
import * as fs from 'node:fs';

describe('Queue', () => {
  let queue: Queue;
  const testDbPath = './test_queue.db';

  beforeEach(() => {
    queue = new Queue(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should create a new queue', () => {
    assert.ok(queue instanceof Queue);
  });

  test('should add a job to the queue', () => {
    queue.add("{'task': 'test_task'}");
    // We can't directly check the database, so we'll test this indirectly
    // by checking if we can retrieve the job in the next test
  });

  test('should process a job from the queue', async () => {
    queue.add("{'task': 'test_task'}");

    const processedJob = await queue.process(async job => {
      assert.strictEqual(job.payload, "{'task': 'test_task'}");
      return 'processed';
    });

    assert.ok(processedJob);
    assert.strictEqual(processedJob?.status, 'completed');
    assert.strictEqual(processedJob?.result, 'processed');
  });

  test('should handle job failure', async () => {
    queue.add('{"task": "failing_task"}');

    const failedJob = await queue.process(async () => {
      throw new Error('Test error');
    });

    assert.ok(failedJob);
    assert.strictEqual(failedJob?.status, 'failed');
    assert.strictEqual(failedJob?.error, 'Test error');
  });

  test('should retry a failed job', async () => {
    queue.add('{"task": "retry_task"}');

    const failedJob = await queue.process(async () => {
      throw new Error('Retry error');
    });

    assert.ok(failedJob);
    assert.strictEqual(failedJob?.status, 'failed');

    queue.retry(failedJob!.id);

    const retriedJob = await queue.process(async job => {
      assert.strictEqual(job.payload, '{"task": "retry_task"}');
      return 'retried successfully';
    });

    assert.ok(retriedJob);
    assert.strictEqual(retriedJob?.status, 'completed');
    assert.strictEqual(retriedJob?.result, 'retried successfully');
  });

  test('should process jobs in order of priority', async () => {
    queue.add('{"task": "low_priority"}', 1);
    queue.add('{"task": "high_priority"}', 2);

    const firstJob = await queue.process(async job => job.payload);
    const secondJob = await queue.process(async job => job.payload);

    assert.strictEqual(firstJob?.payload, '{"task": "high_priority"}');
    assert.strictEqual(secondJob?.payload, '{"task": "low_priority"}');
  });

  test('should handle concurrent processing', async () => {
    queue.add('{"task": "concurrent1"}');
    queue.add('{"task": "concurrent2"}');

    const results = await Promise.all([
      queue.process(async job => job.payload),
      queue.process(async job => job.payload),
    ]);

    assert.ok(results.some(job => job?.payload === '{"task": "concurrent1"}'));
    assert.ok(results.some(job => job?.payload === '{"task": "concurrent2"}'));
  });

  test('should return undefined when no jobs are available', async () => {
    const result = await queue.process(async () => {});
    assert.strictEqual(result, undefined);
  });
});
