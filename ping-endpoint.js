
const express = require('express');
const router = express.Router();

// Simple ping endpoint for uptime monitoring
router.get('/ping', (req, res) => {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${days}d ${hours}h ${minutes}m`,
        uptimeSeconds: uptimeSeconds,
        service: 'flora-bot',
        version: '1.5.35',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
    });
});

module.exports = router;
