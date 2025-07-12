const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();

// Get system information
function getSystemInfo() {
    const uptime = os.uptime();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(2);

    // Get disk usage
    let diskUsage = 0;
    let diskUsagePercent = 0;
    try {
        const { execSync } = require('child_process');
        const diskInfo = execSync('df -h / | tail -1', { encoding: 'utf8' });
        const diskData = diskInfo.split(/\s+/);
        diskUsagePercent = parseInt(diskData[4].replace('%', ''));
        diskUsage = diskData[2];
    } catch (err) {
        diskUsage = 'N/A';
        diskUsagePercent = 0;
    }

    // Check for high usage and send alerts
    checkSystemAlerts(memUsage, diskUsagePercent);

    // Get network info
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = 'N/A';

    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ipAddress = net.address;
                break;
            }
        }
    }

    return {
        hostname: os.hostname(),
        platform: os.platform(),
        architecture: os.arch(),
        cpus: os.cpus().length,
        totalMemory: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        freeMemory: (freeMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        usedMemory: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        memoryUsage: memUsage + '%',
        diskUsage: diskUsage,
        diskUsagePercent: diskUsagePercent + '%',
        uptime: formatUptime(uptime),
        uptimeSeconds: uptime,
        ipAddress: ipAddress,
        nodeVersion: process.version,
        loadAverage: os.loadavg(),
        timestamp: new Date().toISOString()
    };
}

// System alert function
async function checkSystemAlerts(memUsage, diskUsagePercent) {
    const alertThreshold = 95;
    const restartThreshold = 97;

    // Check for automatic restart at 97%
    if (parseFloat(memUsage) >= restartThreshold || diskUsagePercent >= restartThreshold) {
        await sendRestartNotification(memUsage, diskUsagePercent);
        console.log(`🔄 AUTOMATIC RESTART: System usage exceeded 97% - Memory: ${memUsage}%, Disk: ${diskUsagePercent}%`);

        // Wait 2 seconds to ensure notification is sent
        setTimeout(() => {
            process.exit(2); // Exit code 2 triggers restart in index.js
        }, 2000);
        return;
    }

    // Send alert at 95% (only if not already restarting)
    if (parseFloat(memUsage) >= alertThreshold || diskUsagePercent >= alertThreshold) {
        await sendAlertToOwners(memUsage, diskUsagePercent);
    }
}

// Send alert to bot owners
async function sendAlertToOwners(memUsage, diskUsagePercent) {
    try {
        const config = require('./config.json');
        const { api } = global.GoatBot || {};

        if (!api || !config.adminBot) return;

        const alertMessage = `🚨 SYSTEM ALERT 🚨\n\n` +
            `⚠️ High resource usage detected!\n\n` +
            `💾 Memory Usage: ${memUsage}%\n` +
            `💿 Disk Usage: ${diskUsagePercent}%\n\n` +
            `🔄 System may need restart soon!\n` +
            `📍 Server: ${os.hostname()}\n` +
            `⏰ Time: ${new Date().toLocaleString()}`;

        // Send to all owners
        for (const ownerID of config.adminBot) {
            try {
                await api.sendMessage(alertMessage, ownerID);
            } catch (err) {
                console.error(`Failed to send alert to owner ${ownerID}:`, err.message);
            }
        }

        console.log(`🚨 System alert sent to owners - Memory: ${memUsage}%, Disk: ${diskUsagePercent}%`);

    } catch (error) {
        console.error('Error sending system alert:', error.message);
    }
}

// Send visitor info to owners
async function sendVisitorInfoToOwners(visitorData) {
    try {
        const config = require('./config.json');
        const { api } = global.GoatBot || {};

        if (!api || !config.adminBot) return false;

        const locationInfo = visitorData.ipInfo.country ? 
            `🌍 Location: ${visitorData.ipInfo.city}, ${visitorData.ipInfo.regionName}, ${visitorData.ipInfo.country}\n` +
            `🏙️ Region: ${visitorData.ipInfo.continent}\n` +
            `📍 Coordinates: ${visitorData.ipInfo.lat}, ${visitorData.ipInfo.lon}\n` +
            `🕒 Timezone: ${visitorData.ipInfo.timezone}\n` +
            `💰 Currency: ${visitorData.ipInfo.currency}\n` +
            `🌐 ISP: ${visitorData.ipInfo.isp}\n` +
            `🏢 Organization: ${visitorData.ipInfo.org}\n` +
            `📱 Mobile: ${visitorData.ipInfo.mobile ? 'Yes' : 'No'}\n` +
            `🔐 Proxy: ${visitorData.ipInfo.proxy ? 'Yes' : 'No'}\n` +
            `🖥️ Hosting: ${visitorData.ipInfo.hosting ? 'Yes' : 'No'}\n` : 
            '🌍 Location: Information not available\n';

        const visitorMessage = `🌟 NEW VISITOR DETECTED 🌟\n\n` +
            `📡 IP Address: ${visitorData.ip}\n` +
            `🖥️ User Agent: ${visitorData.userAgent}\n` +
            `🔗 Referer: ${visitorData.referer}\n` +
            `⏰ Visit Time: ${new Date(visitorData.timestamp).toLocaleString()}\n\n` +
            locationInfo +
            `\n🤖 Flora Bot Website Visit\n` +
            `📊 Visit tracked automatically`;

        // Send to all owners
        for (const ownerID of config.adminBot) {
            try {
                await api.sendMessage(visitorMessage, ownerID);
            } catch (err) {
                console.error(`Failed to send visitor info to owner ${ownerID}:`, err.message);
            }
        }

        console.log(`🌟 Visitor info sent to owners from IP: ${visitorData.ip}`);
        return true;

    } catch (error) {
        console.error('Error sending visitor info:', error.message);
        return false;
    }
}

// Send automatic restart notification to owners
async function sendRestartNotification(memUsage, diskUsagePercent) {
    try {
        const config = require('./config.json');
        const { api } = global.GoatBot || {};

        if (!api || !config.adminBot) return;

        const restartMessage = `🔄 AUTOMATIC RESTART 🔄\n\n` +
            `⚡ Bot is automatically restarting due to high resource usage!\n\n` +
            `💾 Memory Usage: ${memUsage}%\n` +
            `💿 Disk Usage: ${diskUsagePercent}%\n\n` +
            `✅ The bot will restart automatically to prevent system overload.\n` +
            `🔄 No manual intervention required.\n\n` +
            `📍 Server: ${os.hostname()}\n` +
            `⏰ Restart Time: ${new Date().toLocaleString()}\n\n` +
            `ℹ️ The bot will be back online shortly!`;

        // Send to all owners
        for (const ownerID of config.adminBot) {
            try {
                await api.sendMessage(restartMessage, ownerID);
            } catch (err) {
                console.error(`Failed to send restart notification to owner ${ownerID}:`, err.message);
            }
        }

        console.log(`🔄 Automatic restart notification sent to owners - Memory: ${memUsage}%, Disk: ${diskUsagePercent}%`);

    } catch (error) {
        console.error('Error sending restart notification:', error.message);
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Contact owner handler
async function handleContactOwner(name, email, message) {
    try {
        const config = require('./config.json');
        const { api } = global.GoatBot || {};

        if (!api || !config.adminBot) return false;

        const contactMessage = `📬 NEW CONTACT MESSAGE 📬\n\n` +
            `👤 Name: ${name}\n` +
            `📧 Email: ${email}\n` +
            `💬 Message: ${message}\n\n` +
            `⏰ Time: ${new Date().toLocaleString()}\n` +
            `🔗 From: Flora Bot Website`;

        // Send to all owners
        for (const ownerID of config.adminBot) {
            try {
                await api.sendMessage(contactMessage, ownerID);
            } catch (err) {
                console.error(`Failed to send contact message to owner ${ownerID}:`, err.message);
            }
        }

        console.log(`📬 Contact message sent to owners from ${name} (${email})`);
        return true;

    } catch (error) {
        console.error('Error sending contact message:', error.message);
        return false;
    }
}

// HTML template for Flora Bot preview page
const floraPreviewHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flora Bot - Advanced AI Assistant</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            overflow-x: hidden;
            min-height: 100vh;
        }

        .background-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.3) 0%, transparent 50%);
            animation: backgroundMove 20s ease-in-out infinite;
            z-index: -1;
        }

        @keyframes backgroundMove {
            0%, 100% { transform: translateX(0) translateY(0); }
            25% { transform: translateX(-20px) translateY(-10px); }
            50% { transform: translateX(20px) translateY(-20px); }
            75% { transform: translateX(-10px) translateY(10px); }
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 1;
        }

        .header {
            text-align: center;
            margin-bottom: 50px;
        }

        .logo {
            font-size: 4em;
            font-weight: bold;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: gradientShift 3s ease-in-out infinite, bounce 2s ease-in-out infinite;
            margin-bottom: 20px;
            text-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
        }

        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        .subtitle {
            font-size: 1.5em;
            margin-bottom: 30px;
            opacity: 0.9;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 50px;
        }

        .feature-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .feature-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .feature-icon {
            font-size: 3em;
            margin-bottom: 20px;
            display: block;
        }

        .feature-title {
            font-size: 1.3em;
            margin-bottom: 15px;
            font-weight: bold;
        }

        .feature-description {
            opacity: 0.8;
            line-height: 1.6;
        }

        .action-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 50px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 25px;
            font-size: 1.1em;
            font-weight: bold;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .btn-primary {
            background: linear-gradient(45deg, #ff6b6b, #ee5a6f);
            color: white;
        }

        .btn-secondary {
            background: linear-gradient(45deg, #4ecdc4, #45b7d1);
            color: white;
        }

        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }

        .uptime-section {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .uptime-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .uptime-item {
            text-align: center;
        }

        .uptime-value {
            font-size: 2em;
            font-weight: bold;
            color: #4ecdc4;
        }

        .uptime-label {
            opacity: 0.8;
            margin-top: 5px;
        }

        .contact-form {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-top: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 1em;
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        .audio-control {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 50px;
            padding: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .audio-control:hover {
            transform: scale(1.1);
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-20px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }

        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #4CAF50;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 2s infinite;
        }

        @media (max-width: 768px) {
            .logo { font-size: 2.5em; }
            .container { padding: 15px; }
            .features-grid { grid-template-columns: 1fr; }
            .action-buttons { flex-direction: column; align-items: center; }
        }
    </style>
</head>
<body>
    <div class="background-animation"></div>

    <!-- Background Music -->
    <audio id="bgMusic" loop>
        <source src="https://www.soundjay.com/misc/sounds/fade.mp3" type="audio/mpeg">
        <!-- Fallback to YouTube audio (Note: This won't work directly, you'd need a proper audio file) -->
    </audio>

    <div class="container">
        <div class="header">
            <div class="logo">🌸 FLORA BOT 🌸</div>
            <div class="subtitle">
                <span class="status-indicator"></span>
                Advanced AI Assistant - Always Online
            </div>
        </div>

        <div class="features-grid">
            <div class="feature-card">
                <span class="feature-icon">🤖</span>
                <div class="feature-title">AI Powered</div>
                <div class="feature-description">Advanced artificial intelligence with natural language processing and smart responses</div>
            </div>

            <div class="feature-card">
                <span class="feature-icon">⚡</span>
                <div class="feature-title">Lightning Fast</div>
                <div class="feature-description">Ultra-fast response times with optimized performance and real-time processing</div>
            </div>

            <div class="feature-card">
                <span class="feature-icon">🔒</span>
                <div class="feature-title">Secure & Safe</div>
                <div class="feature-description">Bank-level security with encrypted communications and privacy protection</div>
            </div>

            <div class="feature-card">
                <span class="feature-icon">🌍</span>
                <div class="feature-title">24/7 Available</div>
                <div class="feature-description">Always online, ready to assist you anytime, anywhere around the globe</div>
            </div>
        </div>

        <div class="action-buttons">
            <a href="https://m.me/join/AbY8nGQo5zF9fQzx" target="_blank" class="btn btn-primary">
                💬 Join Messenger Group
            </a>
            <button onclick="toggleMusic()" class="btn btn-secondary" id="musicBtn">
                🎵 Play Music
            </button>
        </div>

        <div class="uptime-section">
            <h2 style="text-align: center; margin-bottom: 30px;">🚀 System Status</h2>
            <div class="uptime-grid">
                <div class="uptime-item">
                    <div class="uptime-value" id="uptime">Loading...</div>
                    <div class="uptime-label">Uptime</div>
                </div>
                <div class="uptime-item">
                    <div class="uptime-value" id="memory">Loading...</div>
                    <div class="uptime-label">Memory Usage</div>
                </div>
                <div class="uptime-item">
                    <div class="uptime-value" id="cpu">Loading...</div>
                    <div class="uptime-label">CPU Cores</div>
                </div>
                <div class="uptime-item">
                    <div class="uptime-value" id="status">🟢</div>
                    <div class="uptime-label">Status</div>
                </div>
            </div>
        </div>

        <div class="contact-form">
            <h2 style="text-align: center; margin-bottom: 30px;">📬 Contact Owner</h2>
            <form id="contactForm">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" placeholder="Your name" required>
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" placeholder="your@email.com" required>
                </div>
                <div class="form-group">
                    <label for="message">Message:</label>
                    <textarea id="message" name="message" rows="4" placeholder="Your message to the owner..." required></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                    📤 Send Message
                </button>
            </form>
        </div>
    </div>

    <div class="audio-control" onclick="toggleMusic()" id="audioControl">
        <span id="audioIcon">🎵</span>
    </div>

    <script>
        let musicPlaying = false;
        const bgMusic = document.getElementById('bgMusic');
        const musicBtn = document.getElementById('musicBtn');
        const audioIcon = document.getElementById('audioIcon');

        // Ensure elements exist before proceeding
        if (!bgMusic || !musicBtn || !audioIcon) {
            console.error('Required audio elements not found');
        }

        // Create a base64 encoded audio for better compatibility
        const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUZEVFQRV0h';

        // Set the audio source
        bgMusic.src = audioData;
        bgMusic.volume = 0.3; // Set volume to 30%

        // Handle audio loading
        bgMusic.addEventListener('canplaythrough', () => {
            console.log('🎵 Background music ready to play');
        });

        bgMusic.addEventListener('error', (e) => {
            console.log('Audio error:', e);
            // Create silent audio as ultimate fallback
            const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10BAAAAAEAAQAARAAAIlAAAIACABAAZGF0YQAAAAA=';
            bgMusic.src = silentAudio;
        });

        function toggleMusic() {
            if (musicPlaying) {
                bgMusic.pause();
                musicBtn.innerHTML = '🎵 Play Music';
                audioIcon.innerHTML = '🎵';
                musicPlaying = false;
            } else {
                bgMusic.play().catch(e => {
                    console.log('Audio play failed:', e);
                    alert('Audio play failed. Please interact with the page first.');
                });
                musicBtn.innerHTML = '⏸️ Pause Music';
                audioIcon.innerHTML = '⏸️';
                musicPlaying = true;
            }
        }

        // Enhanced autoplay with better browser compatibility
        let playAttempted = false;
        let userInteracted = false;

        function attemptAutoPlay() {
            if (playAttempted) return;
            playAttempted = true;

            // Try immediate autoplay
            bgMusic.play().then(() => {
                musicPlaying = true;
                musicBtn.innerHTML = '⏸️ Pause Music';
                audioIcon.innerHTML = '⏸️';
                console.log('🎵 Background music started automatically');
            }).catch(e => {
                console.log('Auto-play blocked by browser policy - waiting for user interaction');
                // Add visual indicator for manual play
                audioIcon.innerHTML = '🎵';
                audioIcon.style.animation = 'pulse 2s infinite';

                // Show a subtle notification
                const notification = document.createElement('div');
                notification.innerHTML = '🎵 Click anywhere to enable music';
                notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px 20px; border-radius: 25px; z-index: 1000; font-size: 14px; animation: fadeInOut 4s ease-in-out;';
                document.body.appendChild(notification);

                // Remove notification after 4 seconds
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 4000);
            });
        }

        // Start music on first user interaction
        function startMusicOnInteraction() {
            if (userInteracted || musicPlaying) return;
            userInteracted = true;

            bgMusic.play().then(() => {
                musicPlaying = true;
                musicBtn.innerHTML = '⏸️ Pause Music';
                audioIcon.innerHTML = '⏸️';
                audioIcon.style.animation = 'none';
                console.log('🎵 Background music started after user interaction');
            }).catch(e => {
                console.log('Music play failed even after user interaction:', e);
            });
        }

        // Add interaction listeners
        ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(eventType => {
            document.addEventListener(eventType, startMusicOnInteraction, { once: true });
        });

        // Auto-play attempt on page load
        window.addEventListener('load', () => {
            setTimeout(attemptAutoPlay, 1000);
        });

        // Also try when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(attemptAutoPlay, 1000);
            });
        } else {
            setTimeout(attemptAutoPlay, 1000);
        }

        // Update system info
        async function updateSystemInfo() {
            try {
                const response = await fetch('/api/system-info');
                const data = await response.json();

                document.getElementById('uptime').textContent = data.uptime;
                document.getElementById('memory').textContent = data.memoryUsage;
                document.getElementById('cpu').textContent = data.cpus;
            } catch (error) {
                console.error('Error updating system info:', error);
            }
        }

        // Contact form handler
        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                message: document.getElementById('message').value
            };

            try {
                const response = await fetch('/api/contact-owner', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    alert('✅ Message sent successfully! The owner will receive your message.');
                    document.getElementById('contactForm').reset();
                } else {
                    alert('❌ Failed to send message. Please try again.');
                }
            } catch (error) {
                console.error('Error sending message:', error);
                alert('❌ Error sending message. Please try again.');
            }
        });

        // Track visitor and send info to owners
        async function trackVisitor() {
            try {
                const response = await fetch('/api/track-visitor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    console.log('Visitor tracked successfully');
                }
            } catch (error) {
                console.error('Error tracking visitor:', error);
            }
        }

        // Track visitor on page load
        trackVisitor();

        // Initial load and auto-refresh (reduced frequency)
        updateSystemInfo();
        setInterval(updateSystemInfo, 300000); // Update every 5 minutes instead of 30 seconds

        // Add some interactive particles
        function createParticle() {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = 'rgba(255, 255, 255, 0.6)';
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.left = Math.random() * window.innerWidth + 'px';
            particle.style.top = '100vh';
            particle.style.zIndex = '-1';

            document.body.appendChild(particle);

            const animation = particle.animate([
                { transform: 'translateY(0px)', opacity: 1 },
                { transform: 'translateY(-100vh)', opacity: 0 }
            ], {
                duration: Math.random() * 3000 + 2000,
                easing: 'linear'
            });

            animation.onfinish = () => particle.remove();
        }

        // Create particles periodically (reduced frequency)
        setInterval(createParticle, 2000); // Create particles every 2 seconds instead of 0.5 seconds
    </script>
</body>
</html>
`;

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.send(floraPreviewHTML);
});

app.get('/api/system-info', (req, res) => {
    res.json(getSystemInfo());
});

app.post('/api/contact-owner', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const success = await handleContactOwner(name, email, message);

        if (success) {
            res.json({ success: true, message: 'Message sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send message to owners' });
        }
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Server error occurred' });
    }
});

app.post('/api/track-visitor', async (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress ||
                  (req.connection.socket ? req.connection.socket.remoteAddress : null);

        const userAgent = req.headers['user-agent'];
        const referer = req.headers['referer'] || 'Direct visit';
        const timestamp = new Date().toISOString();

        // Get additional IP info
        let ipInfo = {};
        try {
            const axios = require('axios');
            const ipResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`);
            if (ipResponse.data.status === 'success') {
                ipInfo = ipResponse.data;
            }
        } catch (err) {
            console.error('Error getting IP info:', err.message);
        }

        const visitorData = {
            ip: ip,
            userAgent: userAgent,
            referer: referer,
            timestamp: timestamp,
            ipInfo: ipInfo
        };

        // Send visitor info to owners
        const success = await sendVisitorInfoToOwners(visitorData);

        if (success) {
            res.json({ success: true, message: 'Visitor tracked successfully' });
        } else {
            res.status(500).json({ error: 'Failed to track visitor' });
        }
    } catch (error) {
        console.error('Visitor tracking error:', error);
        res.status(500).json({ error: 'Server error occurred' });
    }
});

app.get('/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: os.uptime()
    });
});

// Note: Startup notification is now handled by uptime-monitor.js

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Flora Bot uptime preview running on port ${PORT}`);
    console.log(`🚀 Visit the preview to see Flora Bot uptime dashboard!`);
    console.log(`📊 Uptime URL: http://0.0.0.0:${PORT}`);
    console.log(`🌟 Default preview will show Flora Bot dashboard`);
    console.log(`🔗 Integrated with main bot process - no separate uptime command needed`);
    console.log(`📝 Note: Startup notifications are handled by uptime-monitor.js`);
});

// Log configuration on startup
console.log('🔧 Starting Flora Bot Uptime Monitor...');
try {
    const config = require('./config.json');
    const prefix2 = config.prefix || 'No prefix found';
    const owners = config.adminBot || [];

    console.log(`📝 Bot Prefix: ${prefix2}`);
    console.log(`👥 Bot Owners: ${owners.length > 0 ? owners.join(', ') : 'No owners configured'}`);
    console.log(`⚙️ Uptime Monitor Enabled: ${config.uptimeMonitor?.enable || false}`);
} catch (error) {
    console.error('❌ Error reading config:', error.message);
}

module.exports = app;