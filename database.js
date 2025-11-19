import Database from 'better-sqlite3';

const db = new Database('whatsapp-monitor.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    accountId TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    accountName TEXT NOT NULL,
    lastSeen INTEGER,
    isOnline INTEGER DEFAULT 0,
    hasPrivacy INTEGER DEFAULT 0,
    checkInterval INTEGER DEFAULT 30,
    landingPagesCount INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS landing_pages (
    landingPageId TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    githubRepo TEXT,
    vercelURL TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (accountId) REFERENCES accounts(accountId) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId TEXT NOT NULL,
    lastSeen INTEGER,
    isOnline INTEGER NOT NULL,
    checkedAt INTEGER NOT NULL,
    FOREIGN KEY (accountId) REFERENCES accounts(accountId) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_activity_account ON activity_log(accountId);
  CREATE INDEX IF NOT EXISTS idx_activity_checked ON activity_log(checkedAt);
  CREATE INDEX IF NOT EXISTS idx_landing_account ON landing_pages(accountId);
`);

console.log('✅ Database initialized');

// Account operations
export const accountsDb = {
  create: (accountId, number, accountName, checkInterval = 30) => {
    const stmt = db.prepare(`
      INSERT INTO accounts (accountId, number, accountName, checkInterval, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(accountId, number, accountName, checkInterval, Date.now());
  },

  getByNumber: (number) => {
    const stmt = db.prepare('SELECT * FROM accounts WHERE number = ?');
    return stmt.get(number);
  },

  getById: (accountId) => {
    const stmt = db.prepare('SELECT * FROM accounts WHERE accountId = ?');
    return stmt.get(accountId);
  },

  getAll: () => {
    const stmt = db.prepare('SELECT * FROM accounts ORDER BY createdAt DESC');
    return stmt.all();
  },

  updateStatus: (accountId, lastSeen, isOnline, hasPrivacy = false) => {
    const stmt = db.prepare(`
      UPDATE accounts 
      SET lastSeen = ?, isOnline = ?, hasPrivacy = ?, updatedAt = ?
      WHERE accountId = ?
    `);
    return stmt.run(lastSeen, isOnline ? 1 : 0, hasPrivacy ? 1 : 0, Date.now(), accountId);
  },

  updateLandingPagesCount: (accountId) => {
    const stmt = db.prepare(`
      UPDATE accounts 
      SET landingPagesCount = (
        SELECT COUNT(*) FROM landing_pages WHERE accountId = ?
      )
      WHERE accountId = ?
    `);
    return stmt.run(accountId, accountId);
  },

  delete: (accountId) => {
    const stmt = db.prepare('DELETE FROM accounts WHERE accountId = ?');
    return stmt.run(accountId);
  }
};

// Landing pages operations
export const landingPagesDb = {
  create: (landingPageId, accountId, name, githubRepo, vercelURL) => {
    const stmt = db.prepare(`
      INSERT INTO landing_pages (landingPageId, accountId, name, githubRepo, vercelURL, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(landingPageId, accountId, name, githubRepo, vercelURL, Date.now());
    accountsDb.updateLandingPagesCount(accountId);
    return result;
  },

  getByAccount: (accountId) => {
    const stmt = db.prepare('SELECT * FROM landing_pages WHERE accountId = ? ORDER BY createdAt DESC');
    return stmt.all(accountId);
  },

  delete: (landingPageId) => {
    const stmt = db.prepare('SELECT accountId FROM landing_pages WHERE landingPageId = ?');
    const page = stmt.get(landingPageId);
    
    const deleteStmt = db.prepare('DELETE FROM landing_pages WHERE landingPageId = ?');
    const result = deleteStmt.run(landingPageId);
    
    if (page) {
      accountsDb.updateLandingPagesCount(page.accountId);
    }
    return result;
  }
};

// Activity log operations
export const activityLogDb = {
  create: (accountId, lastSeen, isOnline) => {
    const stmt = db.prepare(`
      INSERT INTO activity_log (accountId, lastSeen, isOnline, checkedAt)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(accountId, lastSeen, isOnline ? 1 : 0, Date.now());
  },

  getHistory: (accountId, hours = 24) => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const stmt = db.prepare(`
      SELECT * FROM activity_log 
      WHERE accountId = ? AND checkedAt >= ?
      ORDER BY checkedAt DESC
    `);
    return stmt.all(accountId, cutoff);
  },

  getRecent: (accountId, limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM activity_log 
      WHERE accountId = ?
      ORDER BY checkedAt DESC
      LIMIT ?
    `);
    return stmt.all(accountId, limit);
  },

  cleanup: (daysToKeep = 30) => {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const stmt = db.prepare('DELETE FROM activity_log WHERE checkedAt < ?');
    return stmt.run(cutoff);
  }
};

export default db;
