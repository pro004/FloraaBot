/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 */

const { spawn } = require("child_process");
const log = require("./logger/log.js");

function startProject() {
	const child = spawn("node", ["Goat.js"], {
		cwd: __dirname,
		stdio: "inherit",
		shell: true
	});

	child.on("close", (code) => {
		if (code == 2) {
			log.info("Restarting Project...");
			startProject();
		}
	});
}

// Simplified startup notification
async function sendStartupNotification() {
	console.log('🚀 Flora Bot startup complete - dashboard available on port 3001');
}

// Start background uptime monitoring (no server)
function startBackgroundMonitoring() {
	try {
		const config = require('./config.json');
		if (config.uptimeMonitor?.enable) {
			console.log('🌸 Starting Flora Bot background uptime monitoring...');
			// Wait 5 seconds before starting background monitoring
			setTimeout(() => {
				require('./uptime-monitor.js');
				console.log('📊 Background uptime monitor started - pinging bot on port 3001');
			}, 5000);
		}
	} catch (error) {
		console.error('❌ Error starting background monitoring:', error.message);
	}
}

// Start the main bot first
startProject();

// Start bot main server with dashboard on port 3001
setTimeout(() => {
	try {
		require('./bot-uptime-endpoint.js');
		console.log('✅ Flora Bot main server started on port 3001 with dashboard');
	} catch (error) {
		console.error('❌ Failed to start main server:', error.message);
	}
}, 8000);

// Wait for bot to be fully initialized, then start additional services
setTimeout(() => {
	console.log('🚀 Starting additional services...');
	
	// Start the background monitoring after bot is ready
	setTimeout(() => {
		startBackgroundMonitoring();
	}, 2000);

	// Simple startup notification
	setTimeout(() => {
		sendStartupNotification();
	}, 3000);
}, 12000); // Increased wait time to ensure bot is fully ready