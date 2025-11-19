import Database from 'better-sqlite3';

const db = new Database('whatsapp-monitor.db');

console.log('🔄 Running database migration...');

try {
  // Check if hasPrivacy column exists
  const tableInfo = db.prepare("PRAGMA table_info(accounts)").all();
  const hasPrivacyExists = tableInfo.some(col => col.name === 'hasPrivacy');
  
  if (!hasPrivacyExists) {
    console.log('📝 Adding hasPrivacy column to accounts table...');
    db.prepare('ALTER TABLE accounts ADD COLUMN hasPrivacy INTEGER DEFAULT 0').run();
    console.log('✅ hasPrivacy column added successfully');
  } else {
    console.log('✅ hasPrivacy column already exists');
  }
  
  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

db.close();
