const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const error = require('../lib/error');
const logger = require('../logger').nginx;
const proxyHostModel = require('../models/proxy_host');
const DomainLog = require('../models/domain_log');

const internalDomainLog = {
	/**
	 * ドメインのログディレクトリを作成
	 * @param {Number} proxyHostId
	 * @returns {Promise}
	 */
	ensureLogDirectory: async (proxyHostId) => {
		const logDir = `/data/logs/proxy-host-${proxyHostId}`;
		try {
			await fs.access(logDir);
		} catch (err) {
			if (err.code === 'ENOENT') {
				await fs.mkdir(logDir, { recursive: true });
				logger.info(`Created log directory: ${logDir}`);
			} else {
				throw err;
			}
		}

		// Ensure log files exist to prevent Nginx errors
		const accessLogPath = `${logDir}/access.log`;
		const errorLogPath = `${logDir}/error.log`;
		
		try {
			await fs.access(accessLogPath);
		} catch (err) {
			if (err.code === 'ENOENT') {
				await fs.writeFile(accessLogPath, '', { flag: 'wx' }).catch(() => {
					// File might have been created by another process, ignore error
				});
			}
		}

		try {
			await fs.access(errorLogPath);
		} catch (err) {
			if (err.code === 'ENOENT') {
				await fs.writeFile(errorLogPath, '', { flag: 'wx' }).catch(() => {
					// File might have been created by another process, ignore error
				});
			}
		}

		return logDir;
	},
	/**
	 * ログファイルを読み取り、解析する
	 * @param {Access} access
	 * @param {Object} data
	 * @returns {Promise}
	 */
	getLogs: async (access, data) => {
		const { host_id, log_type = 'access', lines = 100, search = null, page = 1, per_page = 10 } = data;

		return access
			.can('proxy_hosts:get', { id: host_id })
			.then(() => {
				return proxyHostModel.query().where('id', host_id).andWhere('is_deleted', 0).first();
			})
			.then(async (proxyHost) => {
				if (!proxyHost) {
					throw new error.ItemNotFoundError('Proxy Host');
				}

				const logPath = DomainLog.getLogPath(host_id, log_type);

				try {
					const stats = await fs.stat(logPath);
					const logResult = await internalDomainLog.readLogFile(logPath, lines, search, page, per_page);

					return {
						proxy_host_id: host_id,
						log_type,
						file_size: stats.size,
						last_modified: stats.mtime,
						entries: logResult.entries,
						total_lines: logResult.total_filtered,
						total_pages: Math.ceil(logResult.total_filtered / per_page),
						current_page: page,
						per_page: per_page,
						ip_stats: logResult.ip_stats,
					};
				} catch (err) {
					if (err.code === 'ENOENT') {
						return {
							proxy_host_id: host_id,
							log_type,
							file_size: 0,
							last_modified: null,
							entries: [],
							total_lines: 0,
							total_pages: 0,
							current_page: 1,
							per_page: per_page,
							ip_stats: [],
						};
					}
					throw err;
				}
			});
	},

	/**
	 * ログファイルを読み取る
	 * @param {String} logPath
	 * @param {Number} lines
	 * @param {String} search
	 * @param {Number} page
	 * @param {Number} per_page
	 * @returns {Promise<Object>}
	 */
	readLogFile: async (logPath, lines = 100, search = null, page = 1, per_page = 10) => {
		const fileStream = require('fs').createReadStream(logPath);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		const allLines = [];
		const ipCounts = {};
		const filteredLines = [];

		for await (const line of rl) {
			const parsed = internalDomainLog.parseLogLine(line);

			// IP統計を収集（全ログから）
			if (parsed.ip) {
				ipCounts[parsed.ip] = (ipCounts[parsed.ip] || 0) + 1;
			}

			allLines.push(line);

			// 検索フィルター
			let shouldInclude = true;
			if (search && search.trim().length > 0) {
				const searchTerm = search.trim().toLowerCase();
				shouldInclude = line.toLowerCase().includes(searchTerm) || (parsed.ip && parsed.ip.toLowerCase().includes(searchTerm)) || (parsed.method && parsed.method.toLowerCase().includes(searchTerm)) || (parsed.url && parsed.url.toLowerCase().includes(searchTerm)) || (parsed.status && parsed.status.toString().includes(searchTerm)) || (parsed.user_agent && parsed.user_agent.toLowerCase().includes(searchTerm));
			}

			if (shouldInclude) {
				filteredLines.push(line);
			}
		}

		// IP統計をソート（アクセス数順）
		const ip_stats = Object.entries(ipCounts)
			.map(([ip, count]) => ({ ip, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 20); // 上位20IP

		// 最新のログから取得（新しい順にするため配列を逆順にする）
		const reversedLines = filteredLines.reverse();
		
		// 指定された行数に制限
		const limitedLines = reversedLines.slice(0, lines);
		
		// ページネーション
		const startItem = (page - 1) * per_page;
		const endItem = startItem + per_page;
		const paginatedLines = limitedLines.slice(startItem, endItem);

		const entries = paginatedLines.map((line, index) => {
			const parsed = internalDomainLog.parseLogLine(line);
			return {
				line_number: startItem + index + 1,
				timestamp: parsed.timestamp,
				ip: parsed.ip,
				method: parsed.method,
				url: parsed.url,
				status: parsed.status,
				size: parsed.size,
				user_agent: parsed.user_agent,
				raw_line: line,
			};
		});

		return {
			entries,
			total_filtered: Math.min(limitedLines.length, lines),
			ip_stats,
		};
	},

	/**
	 * ログ行を解析する（NGINX detailed format）
	 * @param {String} line
	 * @returns {Object}
	 */
	parseLogLine: (line) => {
		// NGINX detailed format:
		// [$time_local] $remote_addr - $remote_user "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for" rt=$request_time uct="$upstream_connect_time" uht="$upstream_header_time" urt="$upstream_response_time"
		const regex = /^\[([^\]]+)\] (\S+) - (\S+) "([^"]*)" (\d+) (\d+|-) "([^"]*)" "([^"]*)" "([^"]*)" rt=(\S+) uct="([^"]*)" uht="([^"]*)" urt="([^"]*)"/;
		const match = line.match(regex);

		if (!match) {
			// Fallback to try standard combined format for backwards compatibility
			const combinedRegex = /^(\S+) - (\S+) \[([^\]]+)\] "([^"]*)" (\d+) (\d+|-) "([^"]*)" "([^"]*)"/;
			const combinedMatch = line.match(combinedRegex);

			if (!combinedMatch) {
				return {
					timestamp: null,
					ip: null,
					method: null,
					url: null,
					status: null,
					size: null,
					user_agent: null,
				};
			}

			const [, ip, , timestamp, request, status, size, , user_agent] = combinedMatch;
			const [method, url] = request.split(' ');

			return {
				timestamp: new Date(timestamp.replace(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/, '$3-$2-$1 $4:$5:$6 $7')),
				ip,
				method,
				url,
				status: parseInt(status),
				size: size === '-' ? 0 : parseInt(size),
				user_agent,
			};
		}

		const [, timestamp, ip, , request, status, size, , user_agent, x_forwarded_for] = match;
		const [method, url] = request.split(' ');

		// Use X-Forwarded-For if available (for real client IP behind proxy)
		const realIp = x_forwarded_for && x_forwarded_for !== '-' ? x_forwarded_for : ip;

		return {
			timestamp: new Date(timestamp.replace(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/, '$3-$2-$1 $4:$5:$6 $7')),
			ip: realIp,
			method,
			url,
			status: parseInt(status),
			size: size === '-' ? 0 : parseInt(size),
			user_agent,
		};
	},

	/**
	 * ログファイルのローテーション
	 * @param {Number} proxyHostId
	 * @returns {Promise}
	 */
	rotateLog: async (proxyHostId) => {
		const logDir = `/data/logs/proxy-host-${proxyHostId}`;
		const today = new Date().toISOString().split('T')[0];

		for (const logType of ['access', 'error']) {
			const currentLog = path.join(logDir, `${logType}.log`);
			const archivedLog = path.join(logDir, `${logType}-${today}.log`);

			try {
				await fs.access(currentLog);
				await fs.rename(currentLog, archivedLog);

				// 新しいログファイルを作成
				await fs.writeFile(currentLog, '');

				logger.info(`Rotated log: ${currentLog} -> ${archivedLog}`);
			} catch (err) {
				if (err.code !== 'ENOENT') {
					logger.error(`Failed to rotate log ${currentLog}:`, err.message);
				}
			}
		}
	},

	/**
	 * 古いログファイルを削除
	 * @param {Number} proxyHostId
	 * @param {Number} retentionDays
	 * @returns {Promise}
	 */
	cleanupOldLogs: async (proxyHostId, retentionDays = 30) => {
		const logDir = `/data/logs/proxy-host-${proxyHostId}`;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		try {
			const files = await fs.readdir(logDir);

			for (const file of files) {
				if (file.match(/\.(access|error)-\d{4}-\d{2}-\d{2}\.log$/)) {
					const filePath = path.join(logDir, file);
					const stats = await fs.stat(filePath);

					if (stats.mtime < cutoffDate) {
						await fs.unlink(filePath);
						logger.info(`Deleted old log file: ${filePath}`);
					}
				}
			}
		} catch (err) {
			logger.error(`Failed to cleanup logs for proxy host ${proxyHostId}:`, err.message);
		}
	},

	/**
	 * すべてのプロキシホストのログ統計を取得
	 * @param {Access} access
	 * @returns {Promise}
	 */
	getLogStats: async (access) => {
		return access
			.can('proxy_hosts:list')
			.then(() => {
				return proxyHostModel.query().where('is_deleted', 0).andWhere('enable_logs', true);
			})
			.then(async (proxyHosts) => {
				const stats = [];

				for (const host of proxyHosts) {
					const logDir = `/data/logs/proxy-host-${host.id}`;

					try {
						const accessLog = path.join(logDir, 'access.log');
						const errorLog = path.join(logDir, 'error.log');

						let accessSize = 0;
						let errorSize = 0;
						let lastModified = null;

						try {
							const accessStats = await fs.stat(accessLog);
							accessSize = accessStats.size;
							lastModified = accessStats.mtime;
						} catch {
							// ファイルが存在しない場合は無視
						}

						try {
							const errorStats = await fs.stat(errorLog);
							errorSize = errorStats.size;
							if (!lastModified || errorStats.mtime > lastModified) {
								lastModified = errorStats.mtime;
							}
						} catch {
							// ファイルが存在しない場合は無視
						}

						stats.push({
							proxy_host_id: host.id,
							domain_names: host.domain_names,
							access_log_size: accessSize,
							error_log_size: errorSize,
							total_log_size: accessSize + errorSize,
							last_modified: lastModified,
							log_retention_days: host.log_retention_days || 30,
						});
					} catch (err) {
						logger.error(`Failed to get log stats for proxy host ${host.id}:`, err.message);
					}
				}

				return stats;
			});
	},

	/**
	 * すべてのproxy-hostのログディレクトリを初期化
	 * @returns {Promise}
	 */
	initializeAllLogDirectories: async () => {
		try {
			const proxyHosts = await proxyHostModel.query().where('is_deleted', 0).select('id', 'enable_logs');

			const promises = proxyHosts.filter((host) => host.enable_logs !== false).map((host) => internalDomainLog.ensureLogDirectory(host.id));

			await Promise.all(promises);
			logger.info(`Initialized log directories for ${promises.length} proxy hosts`);
		} catch (err) {
			logger.error('Failed to initialize log directories:', err);
			throw err;
		}
	},
};

module.exports = internalDomainLog;
