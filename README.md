# native-sqlite-queue

A lightweight, native SQLite-based queue implementation for Node.js applications. This package provides a robust and persistent job queue system using SQLite as the backend storage.

## Features

- 🚀 Native SQLite implementation
- 💪 Persistent storage
- 🔄 Job retry mechanism
- ⚡ Priority queue support
- 🔒 Concurrent processing safety
- 🎯 Simple and intuitive API

## Requirements

- Node.js >= 22.13.0
- pnpm (recommended package manager)

## Installation
```bash
pnpm add native-sqlite-queue
```

## Usage

```ts
import {Queue} from 'native-sqlite-queue';
// Create a new queue
const queue = new Queue('./my_queue.db');
// Add a job to the queue
queue.add('{"task": "send_email", "to": "user@example.com"}');
// Process jobs
await queue.process(async (job) => {
console.log('Processing:', job.payload);
// Your job processing logic here
return 'Job completed successfully';
});
```

## API Reference

### Queue Constructor
The Queue class accepts a database path parameter:
```ts
const queue = new Queue(databasePath);
```

Parameters:
databasePath: String - Path to SQLite database file or ':memory:' for in-memory database

### Adding Jobs
Add jobs to the queue with optional priority:
```ts
const queue = new Queue(':memory:');
queue.add('{"task": "send_email"}', 2);
```

Parameters:
payload: String - Job data (typically JSON)
priority: Number (optional) - Higher numbers = higher priority (default: 0)
Processing Jobs
Process jobs using an async handler function:
```ts
const queue = new Queue(':memory:');
await queue.process(async (job) => {
const data = JSON.parse(job.payload);
// Process job data
return 'Success!';
});
```

The job object contains:
id: Number - Unique identifier
payload: String - Job data
status: String - Current status
priority: Number - Job priority
created_at: String - Creation timestamp
updated_at: String - Last update timestamp
retry_count: Number - Number of retry attempts

### Job States
Jobs can be in the following states:
waiting: Ready to be processed
active: Currently processing
completed: Successfully processed
failed: Processing failed
delayed: Scheduled for future processing
paused: Processing paused
stalled: Processing stalled
removed: Job removed

### Error Handling & Retries
Handle failed jobs with retry functionality:
```ts
const queue = new Queue(':memory:');
try {
await queue.process(async (job) => {
// Potentially failing operation
throw new Error('Processing failed');
});
} catch (error) {
// Retry the failed job after 5 seconds
queue.retry(job.id, 5000);
}
```

### Examples

#### Basic Queue Operations
```ts
const queue = new Queue('./queue.db');
// Add jobs with priorities
queue.add('{"task": "low_priority"}', 1);
queue.add('{"task": "high_priority"}', 2);
// Process jobs
await queue.process(async (job) => {
const data = JSON.parse(job.payload);
console.log(Processing ${data.task});
return 'Processed';
});
```

#### Concurrent Processing
```ts
const queue = new Queue('./queue.db');
// Add multiple jobs
queue.add('{"task": "task1"}');
queue.add('{"task": "task2"}');
// Process concurrently
await Promise.all([
queue.process(async (job) => process1(job)),
queue.process(async (job) => process2(job))
]);
```

## Testing
Run the test suite:
```bash
pnpm test
```

## Contributing
- Fork the repository
- Create your feature branch
- Commit your changes
- Push to the branch
- Create a Pull Request

## License
ISC

## Author
Cavit Baturalp Gürdin
