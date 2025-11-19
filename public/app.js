const API_BASE = window.location.origin;

let updateInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
    
    // Load initial data
    checkWhatsAppStatus();
    loadStats();
    loadAccounts();
    
    // Setup auto-refresh every 30 seconds
    updateInterval = setInterval(() => {
        checkWhatsAppStatus();
        loadStats();
        loadAccounts();
    }, 30000);
    
    // Setup event listeners
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadAccounts();
        loadStats();
    });
    
    document.getElementById('add-account-form').addEventListener('submit', handleAddAccount);
});

// Check WhatsApp status
async function checkWhatsAppStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/whatsapp/status`);
        const data = await response.json();
        
        const statusEl = document.getElementById('whatsapp-status');
        const monitorStatusEl = document.getElementById('monitor-status');
        
        if (data.isReady) {
            statusEl.textContent = '✅ Connected';
            statusEl.className = 'status status-connected';
            document.getElementById('qr-section').style.display = 'none';
            monitorStatusEl.textContent = '✅ Running';
            monitorStatusEl.className = 'status status-connected';
        } else if (data.needsQR) {
            statusEl.textContent = '⏳ Waiting for QR scan';
            statusEl.className = 'status status-waiting';
            loadQRCode();
        } else {
            statusEl.textContent = '🔄 Connecting...';
            statusEl.className = 'status status-connecting';
        }
        
    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
    }
}

// Load QR code
async function loadQRCode() {
    try {
        const response = await fetch(`${API_BASE}/api/whatsapp/qr`);
        const data = await response.json();
        
        if (data.qrCode) {
            document.getElementById('qr-code').src = data.qrCode;
            document.getElementById('qr-section').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading QR code:', error);
    }
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('total-accounts').textContent = data.total;
        document.getElementById('online-accounts').textContent = data.online;
        document.getElementById('recent-accounts').textContent = data.recentlyActive;
        document.getElementById('inactive-accounts').textContent = data.inactive;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load accounts
async function loadAccounts() {
    try {
        const response = await fetch(`${API_BASE}/api/accounts`);
        const data = await response.json();
        
        const listEl = document.getElementById('accounts-list');
        
        if (data.accounts.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No accounts yet. Add one below!</div>';
            return;
        }
        
        listEl.innerHTML = data.accounts.map(account => `
            <div class="account-card ${account.activityLevel}">
                <div class="account-header">
                    <div class="account-info">
                        <h3>${account.accountName}</h3>
                        <p class="account-number">📱 ${formatPhoneNumber(account.number)}</p>
                    </div>
                    <div class="account-status">
                        ${getStatusBadge(account)}
                    </div>
                </div>
                
                <div class="account-details">
                    <div class="detail-item">
                        <span class="label">Landing Pages:</span>
                        <span class="value">${account.landingPagesCount}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Last Seen:</span>
                        <span class="value">${formatLastSeen(account)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Check Interval:</span>
                        <span class="value">${account.checkInterval} min</span>
                    </div>
                </div>
                
                <div class="account-actions">
                    <button onclick="checkAccount('${account.number}')" class="btn btn-sm btn-primary">
                        Check Now
                    </button>
                    <button onclick="viewHistory('${account.number}')" class="btn btn-sm btn-secondary">
                        📊 History
                    </button>
                    <button onclick="deleteAccount('${account.number}')" class="btn btn-sm btn-danger">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        document.getElementById('accounts-list').innerHTML = 
            '<div class="error">Error loading accounts. Check console.</div>';
    }
}

// Handle add account
async function handleAddAccount(e) {
    e.preventDefault();
    
    const number = document.getElementById('account-number').value.trim();
    const name = document.getElementById('account-name').value.trim();
    const interval = parseInt(document.getElementById('check-interval').value);
    
    try {
        const response = await fetch(`${API_BASE}/api/accounts/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: number,
                accountName: name,
                checkInterval: interval
            })
        });
        
        if (response.ok) {
            alert('✅ Account added successfully!');
            document.getElementById('add-account-form').reset();
            loadAccounts();
            loadStats();
        } else {
            const error = await response.json();
            alert(`❌ Error: ${error.error}`);
        }
    } catch (error) {
        console.error('Error adding account:', error);
        alert('❌ Error adding account. Check console.');
    }
}

// Check account now
async function checkAccount(number) {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Checking...';
        
        const response = await fetch(`${API_BASE}/api/accounts/${number}/check`, {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('✅ Account checked successfully!');
            loadAccounts();
            loadStats();
        } else {
            const error = await response.json();
            alert(`❌ Error: ${error.error}`);
        }
        
        btn.disabled = false;
        btn.textContent = 'Check Now';
        
    } catch (error) {
        console.error('Error checking account:', error);
        alert('❌ Error checking account');
    }
}

// View history
async function viewHistory(number) {
    try {
        const response = await fetch(`${API_BASE}/api/accounts/${number}/history?hours=24`);
        const data = await response.json();
        
        let historyHTML = `
            <h3>Activity History - ${data.account.accountName}</h3>
            <p>Last 24 hours - ${data.total} checks</p>
            <ul>
        `;
        
        data.history.slice(0, 10).forEach(entry => {
            const time = new Date(entry.checkedAt).toLocaleString();
            const status = entry.isOnline ? '🟢 Online' : 
                          entry.lastSeen ? `🟡 Last seen: ${formatTimestamp(entry.lastSeen)}` : 
                          '🔴 Unknown';
            historyHTML += `<li>${time} - ${status}</li>`;
        });
        
        historyHTML += '</ul>';
        
        alert(historyHTML);
        
    } catch (error) {
        console.error('Error loading history:', error);
        alert('❌ Error loading history');
    }
}

// Delete account
async function deleteAccount(number) {
    if (!confirm(`Are you sure you want to delete account ${number}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/accounts/${number}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Account deleted!');
            loadAccounts();
            loadStats();
        } else {
            alert('❌ Error deleting account');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('❌ Error deleting account');
    }
}

// Helper functions
function formatPhoneNumber(number) {
    return `+${number}`;
}

function formatLastSeen(account) {
    if (account.isOnline) {
        return '🟢 Online now';
    }
    
    if (account.hasPrivacy) {
        return '🔒 Privacy enabled - can\'t see';
    }
    
    if (!account.lastSeen) {
        return '🔴 Never seen';
    }
    
    const minutes = account.minutesSinceLastSeen;
    
    if (minutes < 1) {
        return '🟢 Just now';
    } else if (minutes < 60) {
        return `🟡 ${minutes} min ago`;
    } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        return `🟡 ${hours}h ago`;
    } else {
        const days = Math.floor(minutes / 1440);
        return `🔴 ${days}d ago`;
    }
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function getStatusBadge(account) {
    if (account.isOnline) {
        return '<span class="badge badge-online">🟢 Online</span>';
    }
    
    // Check if privacy is enabled
    if (account.hasPrivacy) {
        return '<span class="badge badge-privacy">🔒 Privacy Enabled</span>';
    }
    
    switch (account.activityLevel) {
        case 'high':
            return '<span class="badge badge-high">🟡 Active</span>';
        case 'medium':
            return '<span class="badge badge-medium">🟠 Moderate</span>';
        case 'low':
            return '<span class="badge badge-low">🔴 Inactive</span>';
        default:
            return '<span class="badge badge-unknown">⚪ Unknown</span>';
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
