CREATE TABLE IF NOT EXISTS jobs
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    payload     TEXT                                                                       NOT NULL,
    status      VARCHAR(10) CHECK (status IN ('waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'stalled', 'removed')) NOT NULL DEFAULT 'waiting',
    priority    INTEGER                                                                    NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by   VARCHAR(255),
    result      TEXT,
    error       TEXT,
    retry_count INTEGER DEFAULT 0,
    available_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
