import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { accountsDb, landingPagesDb, activityLogDb } from './database.js';
import whatsappClient from './whatsapp-selenium-client.js';
import monitoringService from './monitor.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    whatsapp: whatsappClient.getStatus(),
    monitoring: monitoringService.getStatus()
  });
});

// ============================================================================
// WHATSAPP ENDPOINTS
// ============================================================================

app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappClient.getStatus());
});

app.get('/api/whatsapp/qr', (req, res) => {
  const qrData = whatsappClient.getQRCode();
  
  if (!qrData.qrCode) {
    return res.status(404).json({
      error: 'No QR code available',
      isReady: qrData.isReady
    });
  }

  res.json(qrData);
});

// ============================================================================
// ACCOUNTS ENDPOINTS
// ============================================================================

// Create/track new account
app.post('/api/accounts/track', async (req, res) => {
  try {
    const { number, accountName, checkInterval } = req.body;

    if (!number || !accountName) {
      return res.status(400).json({ error: 'number and accountName are required' });
    }

    // Check if account already exists
    const existing = accountsDb.getByNumber(number);
    if (existing) {
      return res.status(409).json({
        error: 'Account already exists',
        account: existing
      });
    }

    // Create account
    const accountId = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    accountsDb.create(accountId, number, accountName, checkInterval || 30);

    const account = accountsDb.getById(accountId);

    res.status(201).json({
      success: true,
      account: account
    });

  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = accountsDb.getAll();
    
    // Add activity level to each account
    const accountsWithActivity = accounts.map(account => {
      let activityLevel = 'unknown';
      let minutesSinceLastSeen = null;

      if (account.isOnline) {
        activityLevel = 'online';
        minutesSinceLastSeen = 0;
      } else if (account.lastSeen) {
        minutesSinceLastSeen = Math.floor((Date.now() - account.lastSeen) / 60000);
        
        if (minutesSinceLastSeen < 30) {
          activityLevel = 'high';
        } else if (minutesSinceLastSeen < 120) {
          activityLevel = 'medium';
        } else {
          activityLevel = 'low';
        }
      }

      return {
        ...account,
        activityLevel,
        minutesSinceLastSeen,
        isOnline: account.isOnline === 1,
        lastSeenFormatted: account.lastSeen ? new Date(account.lastSeen).toISOString() : null
      };
    });

    res.json({
      accounts: accountsWithActivity,
      total: accounts.length
    });

  } catch (error) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account by number
app.get('/api/accounts/:number/status', (req, res) => {
  try {
    const { number } = req.params;
    const account = accountsDb.getByNumber(number);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let activityLevel = 'unknown';
    let minutesSinceLastSeen = null;

    if (account.isOnline) {
      activityLevel = 'online';
      minutesSinceLastSeen = 0;
    } else if (account.lastSeen) {
      minutesSinceLastSeen = Math.floor((Date.now() - account.lastSeen) / 60000);
      
      if (minutesSinceLastSeen < 30) {
        activityLevel = 'high';
      } else if (minutesSinceLastSeen < 120) {
        activityLevel = 'medium';
      } else {
        activityLevel = 'low';
      }
    }

    res.json({
      ...account,
      activityLevel,
      minutesSinceLastSeen,
      isOnline: account.isOnline === 1,
      lastSeenFormatted: account.lastSeen ? new Date(account.lastSeen).toISOString() : null
    });

  } catch (error) {
    console.error('Error getting account status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual check for account
app.post('/api/accounts/:number/check', async (req, res) => {
  try {
    const { number } = req.params;
    const account = accountsDb.getByNumber(number);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const status = await monitoringService.checkAccount(account.accountId);

    res.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('Error checking account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account activity history
app.get('/api/accounts/:number/history', (req, res) => {
  try {
    const { number } = req.params;
    const hours = parseInt(req.query.hours) || 24;

    const account = accountsDb.getByNumber(number);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const history = activityLogDb.getHistory(account.accountId, hours);

    res.json({
      account: account,
      history: history.map(entry => ({
        ...entry,
        isOnline: entry.isOnline === 1,
        lastSeenFormatted: entry.lastSeen ? new Date(entry.lastSeen).toISOString() : null,
        checkedAtFormatted: new Date(entry.checkedAt).toISOString()
      })),
      total: history.length
    });

  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete account
app.delete('/api/accounts/:number', (req, res) => {
  try {
    const { number } = req.params;
    const account = accountsDb.getByNumber(number);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    accountsDb.delete(account.accountId);

    res.json({
      success: true,
      message: 'Account deleted'
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LANDING PAGES ENDPOINTS
// ============================================================================

// Associate landing page with account
app.post('/api/accounts/:number/landing-pages', (req, res) => {
  try {
    const { number } = req.params;
    const { landingPageId, name, githubRepo, vercelURL } = req.body;

    const account = accountsDb.getByNumber(number);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!landingPageId || !name) {
      return res.status(400).json({ error: 'landingPageId and name are required' });
    }

    landingPagesDb.create(landingPageId, account.accountId, name, githubRepo, vercelURL);

    res.status(201).json({
      success: true,
      message: 'Landing page associated with account'
    });

  } catch (error) {
    console.error('Error creating landing page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get landing pages for account
app.get('/api/accounts/:number/landing-pages', (req, res) => {
  try {
    const { number } = req.params;
    const account = accountsDb.getByNumber(number);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const landingPages = landingPagesDb.getByAccount(account.accountId);

    res.json({
      account: account,
      landingPages: landingPages,
      total: landingPages.length
    });

  } catch (error) {
    console.error('Error getting landing pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete landing page
app.delete('/api/landing-pages/:landingPageId', (req, res) => {
  try {
    const { landingPageId } = req.params;
    landingPagesDb.delete(landingPageId);

    res.json({
      success: true,
      message: 'Landing page deleted'
    });

  } catch (error) {
    console.error('Error deleting landing page:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STATS ENDPOINTS
// ============================================================================

app.get('/api/stats', (req, res) => {
  try {
    const accounts = accountsDb.getAll();
    
    let online = 0;
    let recentlyActive = 0;
    let inactive = 0;

    const now = Date.now();
    
    accounts.forEach(account => {
      if (account.isOnline) {
        online++;
      } else if (account.lastSeen) {
        const minutesAgo = (now - account.lastSeen) / 60000;
        if (minutesAgo < 120) {
          recentlyActive++;
        } else {
          inactive++;
        }
      } else {
        inactive++;
      }
    });

    res.json({
      total: accounts.length,
      online: online,
      recentlyActive: recentlyActive,
      inactive: inactive,
      whatsappReady: whatsappClient.isReady,
      monitoringRunning: monitoringService.isRunning
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

async function startServer() {
  try {
    // Initialize WhatsApp client
    console.log('🚀 Starting WhatsApp Monitor Server...');
    await whatsappClient.initialize();

    // Wait for WhatsApp to be ready before starting monitoring
    const waitForWhatsApp = setInterval(() => {
      if (whatsappClient.isReady) {
        clearInterval(waitForWhatsApp);
        monitoringService.start();
      }
    }, 5000);

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📱 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 API: http://localhost:${PORT}/api/accounts`);
      console.log(`${'='.repeat(70)}\n`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  monitoringService.stop();
  // Selenium client doesn't need destroy
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  monitoringService.stop();
  // Selenium client doesn't need destroy
  process.exit(0);
});

// Start the server
startServer();
