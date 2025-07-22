const express = require('express');
const validator = require('../../lib/validator');
const jwtdecode = require('../../lib/express/jwt-decode');
const internalDomainLog = require('../../internal/domain-log');

let router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/nginx/proxy-hosts/:host_id/logs
 */
router
	.route('/')
	.options((req, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/proxy-hosts/:host_id/logs
	 *
	 * プロキシホストのログを取得
	 */
	.get((req, res, next) => {
		validator(
			{
				required: ['host_id'],
				additionalProperties: false,
				properties: {
					host_id: {
						type: 'integer',
						minimum: 1,
					},
					log_type: {
						type: 'string',
						enum: ['access', 'error'],
					},
					lines: {
						type: 'integer',
						minimum: 1,
						maximum: 10000,
					},
					search: {
						anyOf: [{ type: 'string', minLength: 0 }, { type: 'null' }],
					},
					page: {
						type: 'integer',
						minimum: 1,
					},
					per_page: {
						type: 'integer',
						minimum: 1,
						maximum: 100,
					},
				},
			},
			{
				host_id: parseInt(req.params.host_id, 10),
				log_type: req.query.log_type || 'access',
				lines: parseInt(req.query.lines, 10) || 100,
				search: req.query.search && req.query.search.trim() ? req.query.search.trim() : null,
				page: parseInt(req.query.page, 10) || 1,
				per_page: parseInt(req.query.per_page, 10) || 10,
			},
		)
			.then((data) => {
				return internalDomainLog.getLogs(res.locals.access, data);
			})
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	});

/**
 * /api/nginx/logs/stats
 */
router
	.route('/stats')
	.options((req, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/logs/stats
	 *
	 * すべてのプロキシホストのログ統計を取得
	 */
	.get((req, res, next) => {
		internalDomainLog
			.getLogStats(res.locals.access)
			.then((stats) => {
				res.status(200).send(stats);
			})
			.catch(next);
	});

module.exports = router;
