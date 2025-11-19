import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppSeleniumClient {
  constructor() {
    this.isReady = false;
    this.isConnected = false;
    this.scriptPath = path.join(__dirname, 'whatsapp_scraper.py');
    this.queue = [];
    this.isProcessing = false;
  }

  async initialize() {
    console.log('✅ WhatsApp Selenium client initialized');
    this.isReady = true;
    this.isConnected = true;
    return true;
  }

  async getContactStatus(number) {
    return new Promise((resolve) => {
      // Add to queue
      this.queue.push({ number, resolve });
      
      // Start processing if not already
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const { number, resolve } = this.queue.shift();

    console.log(`🔍 Checking ${number} using Selenium (${this.queue.length} in queue)...`);

    try {
      const result = await this.runPythonScript(number);
      resolve(result);
    } catch (error) {
      console.error(`❌ Error checking ${number}:`, error.message);
      resolve({
        exists: false,
        number: number,
        isOnline: false,
        lastSeen: null,
        hasPrivacy: true,
        name: number,
        checkedAt: Date.now(),
        error: error.message
      });
    }

    // Wait 2 seconds before processing next (let Chrome cleanup)
    setTimeout(() => {
      this.processQueue();
    }, 2000);
  }

  runPythonScript(number) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.scriptPath, number], {
        cwd: __dirname,
        env: process.env
      });
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('error', (error) => {
        console.error(`❌ Failed to start Python script:`, error);
        reject(error);
      });
      
      python.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`❌ Python script exited with code ${code}`);
          if (stderr) console.error('stderr:', stderr.substring(0, 500));
          reject(new Error(`Script failed with code ${code}`));
          return;
        }

        if (code === null) {
          // Process was killed (timeout or error)
          reject(new Error('Script was terminated'));
          return;
        }
        
        try {
          // Find JSON in stdout
          const lines = stdout.split('\n');
          let resultJson = null;
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{') && trimmed.includes('"success"')) {
              try {
                JSON.parse(trimmed); // Validate
                resultJson = trimmed;
                break;
              } catch (e) {
                // Not valid JSON, continue
              }
            }
          }
          
          if (!resultJson) {
            console.error('❌ No valid JSON in output');
            console.error('stdout:', stdout.substring(0, 500));
            reject(new Error('No valid JSON output'));
            return;
          }

          const result = JSON.parse(resultJson);
          
          if (!result.success) {
            resolve({
              exists: false,
              number: number,
              isOnline: false,
              lastSeen: null,
              hasPrivacy: true,
              name: result.name || number,
              checkedAt: Date.now(),
              error: result.error
            });
            return;
          }

          // Calculate lastSeen timestamp
          let lastSeen = null;
          let hasPrivacy = false;
          
          if (result.is_online) {
            // Usuario está en línea ahora
            lastSeen = Date.now();
          } else if (result.status_text) {
            // Tiene texto de estado (aunque no tengamos minutes_ago exacto)
            // Intentar parsear de status_text si minutes_ago es null
            if (result.minutes_ago !== null && result.minutes_ago !== undefined) {
              lastSeen = Date.now() - (result.minutes_ago * 60 * 1000);
            } else {
              // Marcar como "visto recientemente" pero sin timestamp exacto
              // Para evitar marcar como privacidad cuando sí tenemos el texto
              lastSeen = Date.now() - (60 * 60 * 1000); // Hace 1 hora por defecto
            }
          } else {
            // No hay información de estado - privacidad activada
            hasPrivacy = true;
          }

          console.log(`✅ Result for ${number}:`, {
            isOnline: result.is_online,
            statusText: result.status_text,
            minutesAgo: result.minutes_ago,
            lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
            hasPrivacy
          });

          resolve({
            exists: true,
            number: number,
            isOnline: result.is_online,
            lastSeen: lastSeen,
            hasPrivacy: hasPrivacy,
            name: result.name || number,
            statusText: result.status_text,
            checkedAt: Date.now()
          });
        } catch (error) {
          console.error('❌ Error parsing output:', error);
          reject(error);
        }
      });

      // Timeout after 60 seconds
      const timeout = setTimeout(() => {
        python.kill('SIGTERM');
        reject(new Error('Script timeout'));
      }, 60000);

      python.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  getState() {
    return this.isReady ? 'READY' : 'INITIALIZING';
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isConnected: this.isConnected,
      state: this.getState(),
      platform: 'selenium',
      queueSize: this.queue.length,
      isProcessing: this.isProcessing
    };
  }

  getQRCode() {
    return {
      isReady: this.isReady,
      qrCode: null,
      message: 'Selenium uses persistent browser session. If needed, scan QR in Chrome window that opens.'
    };
  }
}

// Create singleton instance
const client = new WhatsAppSeleniumClient();

// Auto-initialize
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp Selenium client:', err);
});

export default client;
