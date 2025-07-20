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
	.all(jwtdecode())
	/**
	 * GET /api/acme-servers
	 *
	 * Retrieve all ACME servers
	 */
	.get((req, res, next) => {
		console.log('ACME Servers GET - Token:', res.locals.token ? 'Present' : 'Missing');
		console.log('ACME Servers GET - Access:', res.locals.access ? 'Present' : 'Missing');
		
		let expand = null;
		if (typeof req.query.expand === 'string' && req.query.expand.length > 0) {
			expand = req.query.expand.split(',');
		}

		let search = null;
		if (typeof req.query.search === 'string' && req.query.search.length > 0) {
			search = req.query.search;
		}

		validator(
			{
				additionalProperties: false,
				properties: {
					expand: {
						anyOf: [{ type: 'null' }, { type: 'array' }],
					},
					search: {
						anyOf: [{ type: 'null' }, { type: 'string' }],
					},
				},
			},
			{
				expand: expand,
				search: search,
			},
		)
			.then((data) => {
				return internalAcmeServer.getAll(res.locals.access, data.expand, data.search);
			})
			.then((result) => {
				// Add no-cache headers
				res.set({
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0'
				});
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
		console.log('ACME Servers POST - Token:', res.locals.token ? 'Present' : 'Missing');
		console.log('ACME Servers POST - Access:', res.locals.access ? 'Present' : 'Missing');
		
		// Remove show_eab from request body if it exists (frontend checkbox artifact)
		if (req.body.show_eab !== undefined) {
			delete req.body.show_eab;
		}

		// Set default values for missing fields
		const payload = {
			must_staple: false,
			ocsp_stapling: false,
			tls_verify: true,
			profile: 'none',
			key_type: 'ecdsa',
			description: '',
			email: '',
			eab_kid: '',
			eab_hmac_key: '',
			meta: {},
			...req.body
		};

		apiValidator(
			{
				type: 'object',
				additionalProperties: false,
				required: ['name', 'server_url'],
				properties: {
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
					},
					description: {
						type: 'string',
						maxLength: 255,
					},
					server_url: {
						type: 'string',
						maxLength: 500,
					},
					email: {
						type: 'string',
						maxLength: 255,
					},
					eab_kid: {
						type: 'string',
						maxLength: 255,
					},
					eab_hmac_key: {
						type: 'string',
						maxLength: 500,
					},
					profile: {
						type: 'string',
						enum: ['none', 'shortlived', 'tlsserver'],
					},
					key_type: {
						type: 'string',
						enum: ['ecdsa', 'rsa'],
					},
					must_staple: {
						type: 'boolean',
					},
					ocsp_stapling: {
						type: 'boolean',
					},
					tls_verify: {
						type: 'boolean',
					},
					meta: {
						type: 'object',
					},
				},
			},
			payload,
		)
			.then((validatedPayload) => {
				return internalAcmeServer.create(res.locals.access, validatedPayload);
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
		// Remove show_eab from request body if it exists (frontend checkbox artifact)
		if (req.body.show_eab !== undefined) {
			delete req.body.show_eab;
		}

		const payload = Object.assign(req.body, {
			id: parseInt(req.params.server_id, 10),
		});

		apiValidator(
			{
				type: 'object',
				additionalProperties: false,
				required: ['id'],
				properties: {
					id: {
						type: 'integer',
						minimum: 1,
					},
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
					},
					description: {
						type: 'string',
						maxLength: 255,
					},
					server_url: {
						type: 'string',
						maxLength: 500,
					},
					email: {
						type: 'string',
						maxLength: 255,
					},
					eab_kid: {
						type: 'string',
						maxLength: 255,
					},
					eab_hmac_key: {
						type: 'string',
						maxLength: 500,
					},
					profile: {
						type: 'string',
						enum: ['none', 'shortlived', 'tlsserver'],
					},
					key_type: {
						type: 'string',
						enum: ['ecdsa', 'rsa'],
					},
					must_staple: {
						type: 'boolean',
					},
					ocsp_stapling: {
						type: 'boolean',
					},
					tls_verify: {
						type: 'boolean',
					},
					meta: {
						type: 'object',
					},
				},
			},
			payload,
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

module.exports = router;
