
const { spawn } = require('child_process');
const { config } = require('./config.json');

if (config.uptimeMonitor?.enable) {
    console.log('Starting uptime monitor...');
    const uptimeProcess = spawn('node', ['uptime.js'], {
        stdio: 'inherit',
        detached: false
    });

    uptimeProcess.on('error', (error) => {
        console.error('Uptime monitor error:', error);
    });

    uptimeProcess.on('close', (code) => {
        console.log(`Uptime monitor exited with code ${code}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        uptimeProcess.kill();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        uptimeProcess.kill();
        process.exit(0);
    });
}
