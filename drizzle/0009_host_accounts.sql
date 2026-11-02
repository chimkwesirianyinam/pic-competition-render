CREATE TABLE host_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL);
CREATE TABLE host_sessions(token_hash TEXT PRIMARY KEY,host_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX host_session_owner ON host_sessions(host_id);
CREATE TABLE login_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
