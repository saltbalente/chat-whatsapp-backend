import cron from 'node-cron';
import { accountsDb, activityLogDb } from './database.js';
import whatsappClient from './whatsapp-selenium-client.js';

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.checkIntervals = new Map(); // accountId -> interval in minutes
    this.lastChecked = new Map(); // accountId -> timestamp
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Monitoring service is already running');
      return;
    }

    console.log('🚀 Starting monitoring service...');
    this.isRunning = true;

    // Run check every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.checkAllAccounts();
    });

    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkAllAccounts();
    }, 30000);

    console.log('✅ Monitoring service started (runs every 5 minutes)');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('🛑 Monitoring service stopped');
    }
  }

  async checkAllAccounts() {
    if (!whatsappClient.isReady) {
      console.log('⏳ WhatsApp client not ready yet, skipping check...');
      return;
    }

    const accounts = accountsDb.getAll();
    
    if (accounts.length === 0) {
      console.log('ℹ️  No accounts to monitor');
      return;
    }

    console.log(`🔍 Checking ${accounts.length} account(s)...`);

    for (const account of accounts) {
      try {
        // Check if we should check this account based on its interval
        const lastCheck = this.lastChecked.get(account.accountId);
        const checkInterval = account.checkInterval * 60 * 1000; // Convert to milliseconds
        const now = Date.now();

        if (lastCheck && (now - lastCheck) < checkInterval) {
          // Skip this account, not time yet
          continue;
        }

        console.log(`   Checking ${account.accountName} (${account.number})...`);

        // Check WhatsApp status
        const status = await whatsappClient.getContactStatus(account.number);

        if (status.exists) {
          // Update account status
          accountsDb.updateStatus(
            account.accountId,
            status.lastSeen,
            status.isOnline,
            status.hasPrivacy
          );

          // Log activity
          activityLogDb.create(
            account.accountId,
            status.lastSeen,
            status.isOnline
          );

          const minutesAgo = status.lastSeen 
            ? Math.floor((now - status.lastSeen) / 60000)
            : null;

          console.log(`   ✅ ${account.accountName}: ${
            status.isOnline 
              ? '🟢 Online' 
              : minutesAgo !== null 
                ? `🟡 Last seen ${minutesAgo} minutes ago`
                : '🔴 Unknown'
          }`);
        } else {
          console.log(`   ⚠️  ${account.accountName}: ${status.error || 'Not found'}`);
        }

        // Update last checked time
        this.lastChecked.set(account.accountId, now);

        // Delay between checks
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds

      } catch (error) {
        console.error(`   ❌ Error checking ${account.accountName}:`, error.message);
      }
    }

    console.log('✅ Check cycle completed');
  }

  async checkAccount(accountId) {
    const account = accountsDb.getById(accountId);
    
    if (!account) {
      throw new Error('Account not found');
    }

    if (!whatsappClient.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    console.log(`🔍 Manual check for ${account.accountName} (${account.number})`);

    const status = await whatsappClient.getContactStatus(account.number);

    if (status.exists) {
      accountsDb.updateStatus(
        account.accountId,
        status.lastSeen,
        status.isOnline,
        status.hasPrivacy
      );

      activityLogDb.create(
        account.accountId,
        status.lastSeen,
        status.isOnline
      );

      this.lastChecked.set(account.accountId, Date.now());
    }

    return status;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      accountsMonitored: this.lastChecked.size,
      whatsappReady: whatsappClient.isReady
    };
  }
}

const monitoringService = new MonitoringService();

export default monitoringService;
