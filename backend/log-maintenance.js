#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const proxyHostModel = require('./models/proxy_host');
const internalDomainLog = require('./internal/domain-log');
const logger = require('./logger').system;
const db = require('./db');

/**
 * ログローテーションとクリーンアップを実行
 */
async function performLogMaintenance() {
	try {
		logger.info('Starting log maintenance...');

		// データベース接続を初期化
		const knex = require('knex')(require('./knexfile'));
		
		// ログが有効なプロキシホストを取得
		const proxyHosts = await proxyHostModel
			.query()
			.where('is_deleted', 0)
			.andWhere('enable_logs', true);

		logger.info(`Found ${proxyHosts.length} proxy hosts with logging enabled`);

		for (const host of proxyHosts) {
			try {
				// ログディレクトリの確認/作成
				await internalDomainLog.ensureLogDirectory(host.id);

				// ログファイルのローテーション（毎日実行される場合）
				const today = moment().format('YYYY-MM-DD');
				const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
				
				await rotateLogsIfNeeded(host.id, yesterday);

				// 古いログファイルのクリーンアップ
				const retentionDays = host.log_retention_days || 30;
				await internalDomainLog.cleanupOldLogs(host.id, retentionDays);

				logger.info(`Completed log maintenance for proxy host ${host.id} (${host.domain_names.join(', ')})`);
			} catch (err) {
				logger.error(`Failed to maintain logs for proxy host ${host.id}:`, err.message);
			}
		}

		logger.info('Log maintenance completed successfully');
	} catch (err) {
		logger.error('Log maintenance failed:', err.message);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

/**
 * 必要に応じてログファイルをローテーション
 */
async function rotateLogsIfNeeded(proxyHostId, date) {
	const logDir = `/data/logs/proxy-host-${proxyHostId}`;
	
	for (const logType of ['access', 'error']) {
		const currentLogPath = path.join(logDir, `${logType}.log`);
		const rotatedLogPath = path.join(logDir, `${logType}-${date}.log`);

		try {
			// 現在のログファイルが存在し、ローテーション済みでない場合
			const currentStats = await fs.stat(currentLogPath);
			
			// ファイルが前日以前に最後に変更された場合、ローテーション
			const fileDate = moment(currentStats.mtime).format('YYYY-MM-DD');
			const today = moment().format('YYYY-MM-DD');

			if (fileDate < today) {
				try {
					await fs.access(rotatedLogPath);
					// 既にローテーション済み
				} catch (err) {
					if (err.code === 'ENOENT') {
						// ローテーション実行
						await fs.rename(currentLogPath, rotatedLogPath);
						
						// 新しいログファイルを作成
						await fs.writeFile(currentLogPath, '');
						
						// パーミッションを設定（NGINXが書き込めるように）
						await fs.chmod(currentLogPath, 0o644);
						
						logger.info(`Rotated log: ${currentLogPath} -> ${rotatedLogPath}`);
					} else {
						throw err;
					}
				}
			}
		} catch (err) {
			if (err.code !== 'ENOENT') {
				logger.error(`Failed to rotate log ${currentLogPath}:`, err.message);
			}
		}
	}
}

// スクリプトが直接実行された場合
if (require.main === module) {
	performLogMaintenance();
}

module.exports = {
	performLogMaintenance,
	rotateLogsIfNeeded
};
