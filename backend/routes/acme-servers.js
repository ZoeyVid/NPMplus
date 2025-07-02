const express = require('express');
const validator = require('../lib/validator');
const jwtdecode = require('../lib/express/jwt-decode');
const internalAcmeServer = require('../internal/acme-server');
const apiValidator = require('../lib/validator/api');

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/acme-servers
 */
router
	.route('/')
	.options((req, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode()) // TODO: add permission middleware
	/**
	 * GET /api/acme-servers
	 *
	 * Retrieve all ACME servers
	 */
	.get((req, res, next) => {
		validator(
			{
				additionalProperties: false,
				properties: {
					expand: {
						anyOf: [{ type: 'null' }, { type: 'string' }],
					},
					search: {
						anyOf: [{ type: 'null' }, { type: 'string' }],
					},
				},
			},
			{
				expand: (typeof req.query.expand === 'string' ? req.query.expand.split(',') : null),
				search: (typeof req.query.search === 'string' ? req.query.search : null),
			},
		)
			.then((data) => {
				return internalAcmeServer.getAll(res.locals.access, data.expand, data.search);
			})
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	})
	/**
	 * POST /api/acme-servers
	 *
	 * Create a new ACME server
	 */
	.post((req, res, next) => {
		apiValidator(
			{
				$schema: 'http://json-schema.org/draft-07/schema#',
				$id: 'acme-server',
				title: 'ACME Server',
				description: 'ACME Server configuration',
				type: 'object',
				additionalProperties: false,
				required: ['name', 'server_url'],
				properties: {
					name: {
						description: 'Name',
						type: 'string',
						minLength: 1,
						maxLength: 100,
					},
					description: {
						description: 'Description',
						type: 'string',
						maxLength: 255,
					},
					server_url: {
						description: 'ACME Server URL',
						type: 'string',
						format: 'uri',
						maxLength: 500,
					},
					email: {
						description: 'Email address for ACME account',
						type: 'string',
						format: 'email',
						maxLength: 255,
					},
					eab_kid: {
						description: 'External Account Binding Key Identifier',
						type: 'string',
						maxLength: 255,
					},
					eab_hmac_key: {
						description: 'External Account Binding HMAC Key',
						type: 'string',
						maxLength: 500,
					},
					profile: {
						description: 'ACME Profile',
						type: 'string',
						enum: ['none', 'shortlived', 'tlsserver'],
						default: 'none',
					},
					key_type: {
						description: 'Certificate Key Type',
						type: 'string',
						enum: ['ecdsa', 'rsa'],
						default: 'ecdsa',
					},
					must_staple: {
						description: 'Enable Must-Staple',
						type: 'boolean',
						default: false,
					},
					ocsp_stapling: {
						description: 'Enable OCSP Stapling',
						type: 'boolean',
						default: false,
					},
					tls_verify: {
						description: 'Enable TLS Verification',
						type: 'boolean',
						default: true,
					},
					is_default: {
						description: 'Set as default ACME server',
						type: 'boolean',
						default: false,
					},
					meta: {
						description: 'Metadata',
						type: 'object',
					},
				},
			},
			req.body,
		)
			.then((payload) => {
				return internalAcmeServer.create(res.locals.access, payload);
			})
			.then((result) => {
				res.status(201).send(result);
			})
			.catch(next);
	});

/**
 * Specific ACME server
 */
router
	.route('/:server_id')
	.options((req, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode()) // TODO: add permission middleware
	/**
	 * GET /api/acme-servers/123
	 *
	 * Retrieve a specific ACME server
	 */
	.get((req, res, next) => {
		validator(
			{
				additionalProperties: false,
				properties: {
					server_id: {
						anyOf: [{ type: 'number' }, { type: 'string', pattern: '^\\d+$' }],
					},
					expand: {
						anyOf: [{ type: 'null' }, { type: 'string' }],
					},
				},
			},
			{
				server_id: req.params.server_id,
				expand: (typeof req.query.expand === 'string' ? req.query.expand.split(',') : null),
			},
		)
			.then((data) => {
				return internalAcmeServer.get(res.locals.access, {
					id: parseInt(data.server_id, 10),
					expand: data.expand,
				});
			})
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	})
	/**
	 * PUT /api/acme-servers/123
	 *
	 * Update and existing ACME server
	 */
	.put((req, res, next) => {
		apiValidator(
			{
				$schema: 'http://json-schema.org/draft-07/schema#',
				$id: 'acme-server',
				title: 'ACME Server',
				description: 'ACME Server configuration',
				type: 'object',
				additionalProperties: false,
				required: ['id'],
				properties: {
					id: {
						description: 'ACME Server ID',
						type: 'integer',
						minimum: 1,
					},
					name: {
						description: 'Name',
						type: 'string',
						minLength: 1,
						maxLength: 100,
					},
					description: {
						description: 'Description',
						type: 'string',
						maxLength: 255,
					},
					server_url: {
						description: 'ACME Server URL',
						type: 'string',
						format: 'uri',
						maxLength: 500,
					},
					email: {
						description: 'Email address for ACME account',
						type: 'string',
						format: 'email',
						maxLength: 255,
					},
					eab_kid: {
						description: 'External Account Binding Key Identifier',
						type: 'string',
						maxLength: 255,
					},
					eab_hmac_key: {
						description: 'External Account Binding HMAC Key',
						type: 'string',
						maxLength: 500,
					},
					profile: {
						description: 'ACME Profile',
						type: 'string',
						enum: ['none', 'shortlived', 'tlsserver'],
					},
					key_type: {
						description: 'Certificate Key Type',
						type: 'string',
						enum: ['ecdsa', 'rsa'],
					},
					must_staple: {
						description: 'Enable Must-Staple',
						type: 'boolean',
					},
					ocsp_stapling: {
						description: 'Enable OCSP Stapling',
						type: 'boolean',
					},
					tls_verify: {
						description: 'Enable TLS Verification',
						type: 'boolean',
					},
					is_default: {
						description: 'Set as default ACME server',
						type: 'boolean',
					},
					meta: {
						description: 'Metadata',
						type: 'object',
					},
				},
			},
			Object.assign(req.body, {
				id: parseInt(req.params.server_id, 10),
			}),
		)
			.then((payload) => {
				return internalAcmeServer.update(res.locals.access, payload);
			})
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	})
	/**
	 * DELETE /api/acme-servers/123
	 *
	 * Delete and existing ACME server
	 */
	.delete((req, res, next) => {
		internalAcmeServer
			.delete(res.locals.access, { id: parseInt(req.params.server_id, 10) })
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	});

/**
 * Set as default
 */
router
	.route('/:server_id/default')
	.options((req, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode()) // TODO: add permission middleware
	/**
	 * PUT /api/acme-servers/123/default
	 *
	 * Set ACME server as default
	 */
	.put((req, res, next) => {
		internalAcmeServer
			.setDefault(res.locals.access, { id: parseInt(req.params.server_id, 10) })
			.then((result) => {
				res.status(200).send(result);
			})
			.catch(next);
	});

module.exports = router;
