
const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.static('dashboard'));

// Get system information
function getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpus: os.cpus().length,
        totalMemory: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        usedMemory: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        freeMemory: (freeMem / 1024 / 1024 / 1024).toFixed(2),
        memoryUsage: ((usedMem / totalMem) * 100).toFixed(1),
        loadAverage: os.loadavg(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        processUptime: process.uptime()
    };
}

// Simple uptime endpoint for the main bot
app.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Flora Bot is healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: 3001
    });
});

app.get('/uptime', (req, res) => {
    res.json({
        status: 'success',
        uptime: process.uptime(),
        unit: 'seconds',
        botStatus: 'online',
        timestamp: new Date().toISOString()
    });
});

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: 'Flora Bot',
        port: 3001,
        system: getSystemInfo()
    });
});

// Main dashboard route - Flora Bot legendary system monitor
app.get('/', (req, res) => {
    const systemInfo = getSystemInfo();
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flora Bot - Legendary System Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Courier New', monospace;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            color: white;
            overflow-x: hidden;
            position: relative;
        }

        /* Animated background particles */
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }

        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            animation: float 15s infinite linear;
        }

        @keyframes float {
            0% { transform: translateY(100vh) translateX(0px); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-10vh) translateX(100px); opacity: 0; }
        }

        .container {
            position: relative;
            z-index: 2;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            backdrop-filter: blur(20px);
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .logo {
            font-size: 4em;
            margin-bottom: 10px;
            animation: pulse 2s infinite;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }

        .title {
            font-size: 3em;
            margin-bottom: 10px;
            font-weight: bold;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradientShift 3s ease infinite;
        }

        .subtitle {
            font-size: 1.3em;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        .status-badge {
            display: inline-block;
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            padding: 15px 30px;
            border-radius: 30px;
            font-weight: bold;
            font-size: 1.1em;
            animation: glow 2s infinite;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        }

        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(76, 175, 80, 0.5); }
            50% { box-shadow: 0 0 30px rgba(76, 175, 80, 0.8); }
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            backdrop-filter: blur(20px);
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }

        .stat-card h3 {
            font-size: 1.3em;
            margin-bottom: 15px;
            color: #FFD700;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #4ecdc4;
            margin-bottom: 5px;
            text-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
        }

        .stat-label {
            font-size: 0.9em;
            opacity: 0.8;
        }

        .uptime-display {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 20px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
            border: 2px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .uptime-value {
            font-size: 3em;
            font-weight: bold;
            color: #FFD700;
            font-family: 'JetBrains Mono', monospace;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
            margin-bottom: 10px;
        }

        .system-info {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
            border-radius: 15px;
            padding: 25px;
            margin-top: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .system-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .system-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            border-left: 4px solid #4ecdc4;
        }

        .progress-bar {
            width: 100%;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            overflow: hidden;
            margin-top: 10px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #45a049);
            border-radius: 10px;
            transition: width 0.5s ease;
            position: relative;
            overflow: hidden;
        }

        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.2),
                transparent
            );
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .live-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #ff4444;
            border-radius: 50%;
            margin-right: 8px;
            animation: blink 1s infinite;
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            opacity: 0.8;
            font-size: 0.9em;
        }

        .refresh-timer {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            z-index: 10;
        }
    </style>
</head>
<body>
    <!-- Animated particles -->
    <div class="particles" id="particles"></div>

    <!-- Live status indicator -->
    <div class="refresh-timer">
        <span class="live-indicator"></span>
        Live Dashboard - Port 3001
    </div>

    <div class="container">
        <div class="header">
            <div class="logo">🌸🚀</div>
            <h1 class="title">Flora Bot</h1>
            <p class="subtitle">Main Bot Dashboard - Port 3001</p>
            <div class="status-badge">
                <span class="live-indicator"></span>
                BOT ONLINE & OPERATIONAL
            </div>
        </div>

        <div class="uptime-display">
            <h2 style="margin-bottom: 15px; font-size: 1.5em;">⏱️ Bot Uptime</h2>
            <div class="uptime-value" id="uptime">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</div>
            <p style="opacity: 0.8;">Running continuously since startup</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>💾 Memory Usage</h3>
                <div class="stat-value">${systemInfo.memoryUsage}%</div>
                <div class="stat-label">${systemInfo.usedMemory} GB / ${systemInfo.totalMemory} GB</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${systemInfo.memoryUsage}%"></div>
                </div>
            </div>

            <div class="stat-card">
                <h3>🖥️ CPU Cores</h3>
                <div class="stat-value">${systemInfo.cpus}</div>
                <div class="stat-label">Available CPU cores</div>
            </div>

            <div class="stat-card">
                <h3>🌐 Platform</h3>
                <div class="stat-value">${systemInfo.platform}</div>
                <div class="stat-label">Architecture: ${systemInfo.arch}</div>
            </div>

            <div class="stat-card">
                <h3>⚡ Node.js</h3>
                <div class="stat-value">${systemInfo.nodeVersion}</div>
                <div class="stat-label">Runtime version</div>
            </div>
        </div>

        <div class="system-info">
            <h3 style="margin-bottom: 20px; font-size: 1.4em; color: #FFD700;">🔧 Bot Information</h3>
            <div class="system-grid">
                <div class="system-item">
                    <span>Hostname:</span>
                    <strong>${systemInfo.hostname}</strong>
                </div>
                <div class="system-item">
                    <span>Bot Port:</span>
                    <strong>3001 (Main)</strong>
                </div>
                <div class="system-item">
                    <span>Process Uptime:</span>
                    <strong>${Math.floor(systemInfo.processUptime / 3600)}h ${Math.floor((systemInfo.processUptime % 3600) / 60)}m</strong>
                </div>
                <div class="system-item">
                    <span>Free Memory:</span>
                    <strong>${systemInfo.freeMemory} GB</strong>
                </div>
                <div class="system-item">
                    <span>Load Average:</span>
                    <strong>${systemInfo.loadAverage[0].toFixed(2)}</strong>
                </div>
                <div class="system-item">
                    <span>Bot Status:</span>
                    <strong style="color: #4CAF50;">Online ✅</strong>
                </div>
                <div class="system-item">
                    <span>Background Monitor:</span>
                    <strong style="color: #4CAF50;">Active ✅</strong>
                </div>
                <div class="system-item">
                    <span>Uptime Monitor:</span>
                    <strong style="color: #4CAF50;">Running ✅</strong>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🌸 Flora Bot - Created with ♡ by NTKhang | Main Bot Dashboard with Live Monitoring</p>
            <p style="margin-top: 10px; font-size: 0.8em;">
                Live at: <strong>Port 3001</strong> | Background Monitoring: <span style="color: #4CAF50;">Active</span> | Updated: <span id="timestamp">${new Date().toISOString()}</span>
            </p>
        </div>
    </div>

    <script>
        // Create animated particles
        function createParticles() {
            const particles = document.getElementById('particles');
            const particleCount = 50;

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 15 + 's';
                particle.style.animationDuration = (15 + Math.random() * 10) + 's';
                particles.appendChild(particle);
            }
        }

        // Update uptime counter
        let startTime = Date.now() - (${uptimeSeconds} * 1000);

        function updateUptime() {
            const now = Date.now();
            const uptimeMs = now - startTime;
            const uptimeSeconds = Math.floor(uptimeMs / 1000);

            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;

            document.getElementById('uptime').textContent = 
                hours.toString().padStart(2, '0') + ':' +
                minutes.toString().padStart(2, '0') + ':' +
                seconds.toString().padStart(2, '0');
        }

        // Initialize
        createParticles();
        setInterval(updateUptime, 1000);

        // Update timestamp every minute
        setInterval(() => {
            document.getElementById('timestamp').textContent = new Date().toISOString();
        }, 60000);
    </script>
</body>
</html>`;

    res.send(html);
});

// API endpoint for system data
app.get('/api/system', (req, res) => {
    res.json({
        uptime: process.uptime(),
        status: 'online',
        timestamp: new Date().toISOString(),
        system: getSystemInfo(),
        bot_port: 3001,
        main_port: 3001
    });
});

// Start the main bot server on port 3001 (externally accessible)
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Flora Bot main server running on port ${PORT}`);
    console.log(`🌸 Flora Bot dashboard available at http://0.0.0.0:${PORT}`);
});

module.exports = app;
