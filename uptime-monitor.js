const axios = require('axios');
const os = require('os');

// Configuration
const BOT_URL = process.env.BOT_URL || 'https://florabot-uptime-monitor.web.app';
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEALTH_CHECK_INTERVAL = 5 * 1000; // 5 seconds

// Store uptime data
let uptimeStats = {
    startTime: Date.now(),
    totalPings: 0,
    successfulPings: 0,
    failedPings: 0,
    lastPingTime: null,
    lastPingStatus: 'pending',
    lastError: null,
    botStatus: 'checking',
    firstSuccessNotified: false
};

// Send notification to bot owners with retry mechanism (removed thread notifications)
async function attemptNotificationWithRetry(message, retryCount) {
    const maxRetries = 5;
    const success = await sendNotificationToOwners(message);

    if (!success && retryCount < maxRetries) {
        console.log(`🔄 Retrying notification in 10 seconds... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
            attemptNotificationWithRetry(message, retryCount + 1);
        }, 10000);
    } else if (success) {
        console.log('🎉 Startup notification sent successfully!');
    } else {
        console.log('❌ Failed to send startup notification after all retries');
    }
}

// Send notification to bot owners only (no thread notifications)
async function sendNotificationToOwners(message) {
    try {
        const config = require('./config.json');
        if (!config.adminBot || config.adminBot.length === 0) {
            console.log('⚠️ No admin bot IDs configured');
            return false;
        }

        // Check multiple possible bot API locations
        let botApi = null;

        if (global.GoatBot && global.GoatBot.api && typeof global.GoatBot.api.sendMessage === 'function') {
            botApi = global.GoatBot.api;
        } else if (global.utils && global.utils.api && typeof global.utils.api.sendMessage === 'function') {
            botApi = global.utils.api;
        } else if (global.api && typeof global.api.sendMessage === 'function') {
            botApi = global.api;
        }

        if (!botApi) {
            console.log('⚠️ Bot API not available for notifications (will retry)');
            return false;
        }

        let successCount = 0;
        for (const ownerID of config.adminBot) {
            try {
                await botApi.sendMessage(message, ownerID);
                console.log(`✅ Notification sent to owner: ${ownerID}`);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error(`❌ Failed to send to owner ${ownerID}:`, err.message);
            }
        }

        console.log(`🚀 Notifications sent to ${successCount}/${config.adminBot.length} owners`);
        return successCount > 0;

    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        return false;
    }
}

// Function to check bot health
async function checkBotHealth() {
    try {
        // Try to ping the bot's main port (3001) - where the actual bot runs
        const botResponse = await axios.get(`http://127.0.0.1:3001/ping`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'FloraBot-Uptime-Monitor/1.0'
            }
        });

        uptimeStats.lastPingTime = Date.now();
        uptimeStats.lastPingStatus = 'success';
        uptimeStats.successfulPings++;
        uptimeStats.botStatus = 'online';
        uptimeStats.lastError = null;

        console.log(`✅ Bot health check successful - Status: ${botResponse.status}`);

        // Log successful startup instead of sending notification
        if (!uptimeStats.firstSuccessNotified) {
            uptimeStats.firstSuccessNotified = true;
            console.log('🎉 Bot startup notification skipped - Bot is healthy and responding!');
            console.log('✅ FloraBot is online and fully operational');
        }

        return true;

    } catch (error) {
        uptimeStats.lastPingTime = Date.now();
        uptimeStats.lastPingStatus = 'failed';
        uptimeStats.failedPings++;
        uptimeStats.botStatus = 'offline';
        uptimeStats.lastError = error.message;

        console.log(`❌ Bot health check failed: ${error.message}`);
        return false;
    } finally {
        uptimeStats.totalPings++;
    }
}

// External URL ping function (to keep bot alive on external platforms)
async function pingExternalUrl() {
    try {
        if (BOT_URL && BOT_URL !== 'https://florabot-uptime-monitor.web.app') {
            const response = await axios.get(BOT_URL, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'FloraBot-Uptime-Monitor/1.0'
                }
            });
            console.log(`🌍 External URL ping successful: ${BOT_URL}`);
        }
    } catch (error) {
        console.log(`🌍 External URL ping failed: ${error.message}`);
    }
}

// Start the uptime monitoring
function startUptimeMonitoring() {
    console.log('🚀 Starting Flora Bot Uptime Monitor...');
    console.log(`📊 Health checks every ${HEALTH_CHECK_INTERVAL / 1000} seconds`);
    console.log(`🌍 External pings every ${PING_INTERVAL / 60000} minutes`);

    // Initial health check
    checkBotHealth();

    // Regular health checks
    setInterval(checkBotHealth, HEALTH_CHECK_INTERVAL);

    // External URL pings (for platforms like Render, Railway, etc.)
    setInterval(pingExternalUrl, PING_INTERVAL);

    console.log('✅ Uptime monitoring started successfully!');
}

// Start monitoring immediately
console.log('🌸 Flora Bot Uptime Monitor (Background Mode)');
setTimeout(startUptimeMonitoring, 2000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Uptime monitor shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 Uptime monitor shutting down...');
    process.exit(0);
});

module.exports = { startUptimeMonitoring, uptimeStats };