const fs = require("fs-extra");
const nullAndUndefined = [undefined, null];
// const { config } = global.GoatBot;
// const { utils } = global;

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

function getLevenshteinDistance(str1, str2) {
	const matrix = [];
	const len1 = str1.length;
	const len2 = str2.length;

	for (let i = 0; i <= len2; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= len1; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= len2; i++) {
		for (let j = 1; j <= len1; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}

	return matrix[len2][len1];
}

function getRole(threadData, senderID) {
	const config = global.GoatBot.config;
	const adminBot = config.adminBot || [];
	const owner = config.owner || [];
	const vipUsers = config.vipUsers || [];

	if (!senderID)
		return 0;

	const adminBox = threadData ? threadData.adminIDs || [] : [];

	// Owner has highest priority (role 3)
	if (owner.includes(senderID))
		return 3;
	// Admin bot has second priority (role 2)
	if (adminBot.includes(senderID))
		return 2;
	// VIP users have elevated privileges (role 2)
	if (vipUsers.includes(senderID))
		return 2;
	// Group admin has role 1
	if (adminBox.includes(senderID))
		return 1;
	// Regular user has role 0
	return 0;
}

function getText(type, reason, time, targetID, lang) {
	const utils = global.utils;
	if (type == "userBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "userBanned", reason, time, targetID);
	else if (type == "threadBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "threadBanned", reason, time, targetID);
	else if (type == "onlyAdminBox")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBox");
	else if (type == "onlyAdminBot")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBot");
}

function replaceShortcutInLang(text, prefix, prefix2, commandName) {
	return text
		.replace(/\{(?:p|prefix)\}/g, prefix)
		.replace(/\{(?:p2|prefix2)\}/g, prefix2)
		.replace(/\{(?:n|name)\}/g, commandName)
		.replace(/\{pn\}/g, `${prefix}${commandName}`)
		.replace(/\{p2n\}/g, `${prefix2}${commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
	let roleConfig;
	if (utils.isNumber(command.config.role)) {
		roleConfig = {
			onStart: command.config.role
		};
	}
	else if (typeof command.config.role == "object" && !Array.isArray(command.config.role)) {
		if (!command.config.role.onStart)
			command.config.role.onStart = 0;
		roleConfig = command.config.role;
	}
	else {
		roleConfig = {
			onStart: 0
		};
	}

	if (isGroup)
		roleConfig.onStart = threadData.data.setRole?.[commandName] ?? roleConfig.onStart;

	for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
		if (roleConfig[key] == undefined)
			roleConfig[key] = roleConfig.onStart;
	}

	return roleConfig;
	// {
	// 	onChat,
	// 	onStart,
	// 	onReaction,
	// 	onReply
	// }
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
	const config = global.GoatBot.config;
	const { adminBot, hideNotiMessage } = config;

	// check if user banned
	const infoBannedUser = userData.banned;
	if (infoBannedUser.status == true) {
		const { reason, date } = infoBannedUser;
		if (hideNotiMessage.userBanned == false)
			message.reply(getText("userBanned", reason, date, senderID, lang));
		return true;
	}

	// check if only admin bot
	if (
		config.adminOnly.enable == true
		&& !adminBot.includes(senderID)
		&& !config.adminOnly.ignoreCommand.includes(commandName)
	) {
		if (hideNotiMessage.adminOnly == false)
			message.reply(getText("onlyAdminBot", null, null, null, lang));
		return true;
	}

	// ==========    Check Thread    ========== //
	if (isGroup == true) {
		if (
			threadData.data.onlyAdminBox === true
			&& !threadData.adminIDs.includes(senderID)
			&& !(threadData.data.ignoreCommanToOnlyAdminBox || []).includes(commandName)
		) {
			// check if only admin box
			if (!threadData.data.hideNotiMessageOnlyAdminBox)
				message.reply(getText("onlyAdminBox", null, null, null, lang));
			return true;
		}

		// check if thread banned
		const infoBannedThread = threadData.banned;
		if (infoBannedThread.status == true) {
			const { reason, date } = infoBannedThread;
			if (hideNotiMessage.threadBanned == false)
				message.reply(getText("threadBanned", reason, date, threadID, lang));
			return true;
		}
	}
	return false;
}


function createGetText2(langCode, pathCustomLang, prefix, prefix2, command) {
	const commandType = command.config.countDown ? "command" : "command event";
	const commandName = command.config.name;
	let customLang = {};
	let getText2 = () => { };
	if (fs.existsSync(pathCustomLang))
		customLang = require(pathCustomLang)[commandName]?.text || {};
	if (command.langs || customLang || {}) {
		getText2 = function (key, ...args) {
			let lang = command.langs?.[langCode]?.[key] || customLang[key] || "";
			lang = replaceShortcutInLang(lang, prefix, prefix2, commandName);
			for (let i = args.length - 1; i >= 0; i--)
				lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
			return lang || `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}" with key "${key}"`;
		};
	}
	return getText2;
}

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
	return async function (event, message) {

		const { utils, client, GoatBot } = global;
		const { getPrefix, removeHomeDir, log, getTime } = utils;
		const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
		const { autoRefreshThreadInfoFirstTime } = config.database;
		let { hideNotiMessage = {} } = config;

		const { body, messageID, threadID, isGroup } = event;

		// Check if has threadID
		if (!threadID)
			return;

		const senderID = event.userID || event.senderID || event.author;

		let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
		let userData = global.db.allUserData.find(u => u.userID == senderID);

		if (!userData && !isNaN(senderID))
			userData = await usersData.create(senderID);

		if (!threadData && !isNaN(threadID)) {
			if (global.temp.createThreadDataError.includes(threadID))
				return;
			threadData = await threadsData.create(threadID);
			global.db.receivedTheFirstMessage[threadID] = true;
		}
		else {
			if (
				autoRefreshThreadInfoFirstTime === true
				&& !global.db.receivedTheFirstMessage[threadID]
			) {
				global.db.receivedTheFirstMessage[threadID] = true;
				await threadsData.refreshInfo(threadID);
			}
		}

		if (typeof threadData.settings.hideNotiMessage == "object")
			hideNotiMessage = threadData.settings.hideNotiMessage;

		const prefix = getPrefix(threadID);
		const prefix2 = config.prefix2 || ""; // Add prefix2 from config
		const role = getRole(threadData, senderID);
		const parameters = {
			api, usersData, threadsData, message, event,
			userModel, threadModel, prefix, prefix2, dashBoardModel,
			globalModel, dashBoardData, globalData, envCommands,
			envEvents, envGlobal, role,
			removeCommandNameFromBody: function removeCommandNameFromBody(body_, prefix_, commandName_) {
				if ([body_, prefix_, commandName_].every(x => nullAndUndefined.includes(x)))
					throw new Error("Please provide body, prefix and commandName to use this function, this function without parameters only support for onStart");
				for (let i = 0; i < arguments.length; i++)
					if (typeof arguments[i] != "string")
						throw new Error(`The parameter "${i + 1}" must be a string, but got "${getType(arguments[i])}"`);

				return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
			}
		};
		const langCode = threadData.data.lang || config.language || "en";

		function createMessageSyntaxError(commandName) {
			message.SyntaxError = async function () {
				return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandSyntaxError", prefix, commandName));
			};
		}

		/*
			+-----------------------------------------------+
			|							 WHEN CALL COMMAND								|
			+-----------------------------------------------+
		*/
		let isUserCallCommand = false;
		async function onStart() {
			// —————————————— CHECK USE BOT —————————————— //
			if (!body || (!body.startsWith(prefix) && !(prefix2 && body.startsWith(prefix2))))
				return;

			// Check if using prefix2 and if sender is allowed
			const isUsingPrefix2 = prefix2 && body.startsWith(prefix2);
			const allowedPrefix2Users = config.owner || []; // Use owner IDs from config

			if (isUsingPrefix2 && !allowedPrefix2Users.includes(senderID)) {
				if (!hideNotiMessage.prefix2NotAllowed)
					return await message.reply("You are not allowed to use this prefix.");
				return;
			}

			const dateNow = Date.now();
			const usedPrefix = isUsingPrefix2 ? prefix2 : prefix;
			const args = body.slice(usedPrefix.length).trim().split(/ +/);
			// ————————————  CHECK HAS COMMAND ——————————— //
			let commandName = args.shift().toLowerCase();
			let command = GoatBot.commands.get(commandName) || GoatBot.commands.get(GoatBot.aliases.get(commandName));
			// ———————— CHECK ALIASES SET BY GROUP ———————— //
			const aliasesData = threadData.data.aliases || {};
			for (const cmdName in aliasesData) {
				if (aliasesData[cmdName].includes(commandName)) {
					command = GoatBot.commands.get(cmdName);
					break;
				}
			}
			// ————————————— SET COMMAND NAME ————————————— //
			if (command)
				commandName = command.config.name;
			// ——————— FUNCTION REMOVE COMMAND NAME ———————— //
			function removeCommandNameFromBody(body_, prefix_, commandName_) {
				if (arguments.length) {
					if (typeof body_ != "string")
						throw new Error(`The first argument (body) must be a string, but got "${getType(body_)}"`);
					if (typeof prefix_ != "string")
						throw new Error(`The second argument (prefix) must be a string, but got "${getType(prefix_)}"`);
					if (typeof commandName_ != "string")
						throw new Error(`The third argument (commandName) must be a string, but got "${getType(commandName_)}"`);

					return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
				}
				else {
					return body.replace(new RegExp(`^${usedPrefix}(\\s+|)${commandName}`, "i"), "").trim();
				}
			}

			// —————  CHECK BANNED OR ONLY ADMIN BOX  ————— //
			if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
				return;
			if (!command) {
				// Special handling for prefix2 without command name (owner only)
				if (isUsingPrefix2 && !commandName) {
					const randomMessages = [
						"✨ Master, your command echoes through the digital realm!\n\n🌸 FloraBot😍",
						"🌟 Your wish is my command, dear Master!\n\n🌸 FloraBot😍",
						"💫 At your service, Master! What shall we create today?\n\n🌸 FloraBot😍",
						"🎯 Master's command received with utmost priority!\n\n🌸 FloraBot😍",
						"🚀 Ready to execute your divine instructions, Master!\n\n🌸 FloraBot😍"
					];
					const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
					return await message.reply(randomMessage);
				}

				// Command suggestion system (only for prefix2)
				if (commandName && isUsingPrefix2) {
					const allCommands = Array.from(GoatBot.commands.keys());
					const suggestions = [];
					const inputLower = commandName.toLowerCase();

					// Find commands that start with the same characters sequentially
					for (const cmd of allCommands) {
						const cmdLower = cmd.toLowerCase();
						let matchLength = 0;

						// Check how many characters match from the beginning
						for (let i = 0; i < Math.min(inputLower.length, cmdLower.length); i++) {
							if (inputLower[i] === cmdLower[i]) {
								matchLength++;
							} else {
								break;
							}
						}

						// Only include if at least the first character matches and it's not an exact match
						if (matchLength > 0 && matchLength < cmdLower.length) {
							suggestions.push({ cmd, matchLength, totalLength: cmdLower.length });
						}
					}

					// Sort by match length (descending), then by total command length (ascending)
					suggestions.sort((a, b) => {
						if (a.matchLength !== b.matchLength) {
							return b.matchLength - a.matchLength;
						}
						return a.totalLength - b.totalLength;
					});

					// Take top 5 suggestions
					const topSuggestions = suggestions.slice(0, 5).map(s => s.cmd);

					if (topSuggestions.length > 0) {
						if (topSuggestions.length === 1) {
							const suggestionText = `❓ Command "✨${commandName}✨" not found. Are you looking for "🎯${topSuggestions[0]}🎯"?`;
							if (!hideNotiMessage.commandNotFound)
								return await message.reply(suggestionText);
						} else {
							const suggestionText = `❓ Command "✨${commandName}✨" not found. Did you mean:\n\n${topSuggestions.map((cmd, index) => `${index + 1}. 🎯${usedPrefix}${cmd}🎯`).join('\n')}\n\n💡 Use any of these commands!`;
							if (!hideNotiMessage.commandNotFound)
								return await message.reply(suggestionText);
						}
					} else {
						if (!hideNotiMessage.commandNotFound)
							return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound", commandName, usedPrefix));
					}
				} else if (commandName) {
					// Regular prefix - just show command not found without suggestions
					if (!hideNotiMessage.commandNotFound)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound", commandName, usedPrefix));
				} else {
					if (!hideNotiMessage.commandNotFound)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound2", usedPrefix));
				}

				return true;
			}

			// Check role permissions
			function getUserRole(senderID, isGroup, threadData) {
				const adminBot = global.GoatBot.config.adminBot || [];
				const owner = global.GoatBot.config.owner || [];
				const vipUsers = global.GoatBot.config.vipUsers || [];

				if (!senderID)
					return 0;

				// Check owner role first (highest priority)
				if (owner.includes(senderID)) return 4;

				// Check bot admin role
				if (adminBot.includes(senderID)) return 3;

				// Check VIP user role
				if (vipUsers.includes(senderID)) return 2;

				// Check group admin role (only for group chats)
				if (isGroup) {
					const adminBox = threadData ? threadData.adminIDs || [] : [];
					if (adminBox.includes(senderID)) return 1;
				}

				return 0; // Regular user
			}

			function hasPermission(userRole, requiredRole) {
				if (userRole === 4) return true; // Owner can use all roles
				if (requiredRole === 0) return true; // Everyone can use role 0
				if (userRole === 3 && requiredRole <= 3) return true; // Bot Admin
				if (userRole === 2 && requiredRole <= 2) return true; // Vip User
				if (userRole === 1 && requiredRole <= 1) return true; // Group admin
				return userRole >= requiredRole;
			}

			// Check role permissions
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const userRole = getUserRole(senderID, isGroup, threadData);
			const requiredRole = roleConfig.onStart;

			if (!hasPermission(userRole, requiredRole)) {
				if (!hideNotiMessage.needRoleToUseCmd) {
					const roleNames = {
						0: "Everyone",
						1: "Group Admin",
						2: "VIP User",
						3: "Bot Admin",
						4: "Owner"
					};
					return await message.reply(`⚠️ | You need ${roleNames[requiredRole]} role or higher to use this command!`);
				}
				return;
			}
			// ————————————— CHECK PERMISSION ———————————— //
			// const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName); // already called above
			// const needRole = roleConfig.onStart; // already called above

			// if (needRole > role) { // replaced by more detailed permission check above
			// 	if (!hideNotiMessage.needRoleToUseCmd) {
			// 		if (needRole == 1)
			// 			return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdmin", commandName));
			// 		else if (needRole == 2)
			// 			return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2", commandName));
			// 	}
			// 	else {
			// 		return true;
			// 	}
			// }
			// ———————————————— countDown ———————————————— //
			if (!client.countDown[commandName])
				client.countDown[commandName] = {};
			const timestamps = client.countDown[commandName];
			let getCoolDown = command.config.countDown;
			if (!getCoolDown && getCoolDown != 0 || isNaN(getCoolDown))
				getCoolDown = 1;
			const cooldownCommand = getCoolDown * 1000;
			if (timestamps[senderID]) {
				const expirationTime = timestamps[senderID] + cooldownCommand;
				if (dateNow < expirationTime)
					return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "waitingForCommand", ((expirationTime - dateNow) / 1000).toString().slice(0, 3)));
			}
			// ——————————————— RUN COMMAND ——————————————— //
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			isUserCallCommand = true;
			try {
				// analytics command call
				(async () => {
					const analytics = await globalData.get("analytics", "data", {});
					if (!analytics[commandName])
						analytics[commandName] = 0;
					analytics[commandName]++;
					await globalData.set("analytics", analytics, "data");
				})();

				createMessageSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, prefix2, command);
				await command.onStart({
					...parameters,
					args,
					commandName,
					getLang: getText2,
					removeCommandNameFromBody
				});
				timestamps[senderID] = dateNow;
				log.info("CALL COMMAND", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			}
			catch (err) {
				log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
				return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}


		}


		/*
		 +------------------------------------------------+
		 |                    ON CHAT                     |
		 +------------------------------------------------+
		*/
		async function onChat() {
			const allOnChat = GoatBot.onChat || [];
			const args = body ? body.split(/ +/) : [];
			for (const key of allOnChat) {
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;

				// —————————————— CHECK PERMISSION —————————————— //
				const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
				const needRole = roleConfig.onChat;
				if (needRole > role)
					continue;

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, prefix2, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				if (getType(command.onChat) == "Function") {
					const defaultOnChat = command.onChat;
					// convert to AsyncFunction
					command.onChat = async function () {
						return defaultOnChat(...arguments);
					};
				}

				command.onChat({
					...parameters,
					isUserCallCommand,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
								return;
							try {
								await handler();
								log.info("onChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
							}
							catch (err) {
								await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
							}
						}
					})
					.catch(err => {
						log.err("onChat", `An error occurred when calling the command onChat ${commandName}`, err);
					});
			}
		}


		/*
		 +------------------------------------------------+
		 |                   ON ANY EVENT                 |
		 +------------------------------------------------+
		*/
		async function onAnyEvent() {
			const allOnAnyEvent = GoatBot.onAnyEvent || [];
			let args = [];
			if (typeof event.body == "string" && (event.body.startsWith(prefix) || (prefix2 && event.body.startsWith(prefix2))))
				args = event.body.split(/ +/);

			for (const key of allOnAnyEvent) {
				if (typeof key !== "string")
					continue;
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, prefix2, command);

				if (getType(command.onAnyEvent) == "Function") {
					const defaultOnAnyEvent = command.onAnyEvent;
					// convert to AsyncFunction
					command.onAnyEvent = async function () {
						return defaultOnAnyEvent(...arguments);
					};
				}

				command.onAnyEvent({
					...parameters,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							try {
								await handler();
								log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData.name} | ${threadID}`);
							}
							catch (err) {
								message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred7", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
								log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
							}
						}
					})
					.catch(err => {
						log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
					});
			}
		}

		/*
		 +------------------------------------------------+
		 |                  ON FIRST CHAT                 |
		 +------------------------------------------------+
		*/
		async function onFirstChat() {
			const allOnFirstChat = GoatBot.onFirstChat || [];
			const args = body ? body.split(/ +/) : [];

			for (const itemOnFirstChat of allOnFirstChat) {
				const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat;
				if (threadIDsChattedFirstTime.includes(threadID))
					continue;
				const command = GoatBot.commands.get(commandName);
				if (!command)
					continue;

				itemOnFirstChat.threadIDsChattedFirstTime.push(threadID);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, prefix2, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				if (getType(command.onFirstChat) == "Function") {
					const defaultOnFirstChat = command.onFirstChat;
					// convert to AsyncFunction
					command.onFirstChat = async function () {
						return defaultOnFirstChat(...arguments);
					};
				}

				command.onFirstChat({
					...parameters,
					isUserCallCommand,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
								return;
							try {
								await handler();
								log.info("onFirstChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
							}
							catch (err) {
								await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
							}
						}
					})
					.catch(err => {
						log.err("onFirstChat", `An error occurred when calling the command onFirstChat ${commandName}`, err);
					});
			}
		}


		/* 
		 +------------------------------------------------+
		 |                    ON REPLY                    |
		 +------------------------------------------------+
		*/
		async function onReply() {
			if (!event.messageReply)
				return;
			const { onReply } = GoatBot;
			const Reply = onReply.get(event.messageReply.messageID);
			if (!Reply)
				return;
			Reply.delete = () => onReply.delete(messageID);
			const commandName = Reply.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReply", `Can't find command name to execute this reply!`, Reply);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReply", `Command "${commandName}" not found`, Reply);
			}

			// —————————————— CHECK PERMISSION —————————————— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReply;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReply) {
					if (needRole == 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReply", commandName));
					else if (needRole == 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReply", commandName));
				}
				else {
					return true;
				}
			}

			const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, prefix2, command);
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command)
					throw new Error(`Cannot find command with commandName: ${commandName}`);
				const args = body ? body.split(/ +/) : [];
				createMessageSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReply({
					...parameters,
					Reply,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReply", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			}
			catch (err) {
				log.err("onReply", `An error occurred when calling the command onReply ${commandName}`, err);
				await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred3", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}
		}


		/*
		 +------------------------------------------------+
		 |                   ON REACTION                  |
		 +------------------------------------------------+
		*/
		async function onReaction() {
			const { onReaction } = GoatBot;
			const Reaction = onReaction.get(messageID);
			if (!Reaction)
				return;
			Reaction.delete = () => onReaction.delete(messageID);
			const commandName = Reaction.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReaction", `Can't find command name to execute this reaction!`, Reaction);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReaction", `Command "${commandName}" not found`, Reaction);
			}

			// —————————————— CHECK PERMISSION —————————————— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReaction;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReaction) {
					if (needRole == 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReaction", commandName));
					else if (needRole == 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReaction", commandName));
				}
				else {
					return true;
				}
			}
			// —————————————————————————————————————————————— //

			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command)
					throw new Error(`Cannot find command with commandName: ${commandName}`);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, prefix2, command);
				const args = [];
				createMessageSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReaction({
					...parameters,
					Reaction,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReaction", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${event.reaction}`);
			}
			catch (err) {
				log.err("onReaction", `An error occurred when calling the command onReaction ${commandName}`, err);
				await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred4", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}
		}


		/*
		 +------------------------------------------------+
		 |                 EVENT COMMAND                  |
		 +------------------------------------------------+
		*/
		async function handlerEvent() {
			const { author } = event;
			const allEventCommand = GoatBot.eventCommands.entries();
			for (const [key] of allEventCommand) {
				const getEvent = GoatBot.eventCommands.get(key);
				if (!getEvent)
					continue;
				const commandName = getEvent.config.name;
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, prefix2, getEvent);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				try {
					const handler = await getEvent.onStart({
						...parameters,
						commandName,
						getLang: getText2
					});
					if (typeof handler == "function") {
						await handler();
						log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData.name} | ${threadID}`);
					}
				}
				catch (err) {
					log.err("EVENT COMMAND", `An error occurred when calling the command event ${commandName}`, err);
					await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred5", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
				}
			}
		}


		/*
		 +------------------------------------------------+
		 |                    ON EVENT                    |
		 +------------------------------------------------+
		*/
		async function onEvent() {
			const allOnEvent = GoatBot.onEvent || [];
			const args = [];
			const { author } = event;
			for (const key of allOnEvent) {
				if (typeof key !== "string")
					continue;
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, prefix2, command);

				if (getType(command.onEvent) == "Function") {
					const defaultOnEvent = command.onEvent;
					// convert to AsyncFunction
					command.onEvent = async function () {
						return defaultOnEvent(...arguments);
					};
				}

				command.onEvent({
					...parameters,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							try {
								await handler();
								log.info("onEvent", `${commandName} | ${author} | ${userData.name} | ${threadID}`);
							}
							catch (err) {
								message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred6", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
								log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err);
							}
						}
					})
					.catch(err => {
						log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err);
					});
			}
		}

		/*
		 +------------------------------------------------+
		 |                    PRESENCE                    |
		 +------------------------------------------------+
		*/
		async function presence() {
			// Your code here
		}

		/*
		 +------------------------------------------------+
		 |                  READ RECEIPT                  |
		 +------------------------------------------------+
		*/
		async function read_receipt() {
			// Your code here
		}

		/*
		 +------------------------------------------------+
		 |                   		 TYP                    	|
		 +------------------------------------------------+
		*/
		async function typ() {
			// Your code here
		}

		// ——————————————————— CHECK WHITELIST MODE ——————————————————— //
		if (config.whiteListMode?.enable == true) {
			// Check if user is in whitelist or is a privileged user
			const isInWhitelist = config.whiteListMode.whiteListIds.includes(senderID);
			const isPrivilegedUser = config.vipUsers.includes(senderID) ||
				config.adminBot.includes(senderID) ||
				config.owner.includes(senderID);

			if (!isInWhitelist && !isPrivilegedUser) {
				if (config.whiteListModeThread?.enable == true) {
					if (!config.whiteListModeThread.whiteListThreadIds.includes(threadID))
						return;
				}
				else
					return;
			}
		}

		return {
			onAnyEvent,
			onFirstChat,
			onChat,
			onStart,
			onReaction,
			onReply,
			onEvent,
			handlerEvent,
			presence,
			read_receipt,
			typ
		};
	};
};