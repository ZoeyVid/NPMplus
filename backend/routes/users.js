import express from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import internalMfa from "../internal/mfa.js";
import internalTotp from "../internal/totp.js";
import internalUser from "../internal/user.js";
import Access from "../lib/access.js";
import errs from "../lib/error.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import userIdFromMe from "../lib/express/user-id-from-me.js";
import apiValidator from "../lib/validator/api.js";
import validator from "../lib/validator/index.js";
import { debug, express as logger } from "../logger.js";
import { getValidationSchema } from "../schema/index.js";
import { isSetup } from "../setup.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

const limiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	limit: 5,
	message: { error: { message: "Too many requests, please try again later." } },
	standardHeaders: "draft-8",
	legacyHeaders: false,
	ipv6Subnet: 48,
	skipSuccessfulRequests: true,
	validate: { trustProxy: false },
});

router.use(limiter);

/**
 * /api/users
 */
router
	.route("/")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/users
	 *
	 * Retrieve all users
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(
				{
					additionalProperties: false,
					properties: {
						expand: {
							$ref: "common#/properties/expand",
						},
						query: {
							$ref: "common#/properties/query",
						},
					},
				},
				{
					expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
					query: typeof req.query.query === "string" ? req.query.query : null,
				},
			);
			const users = await internalUser.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(users);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/users
	 *
	 * Create a new User
	 */
	.post(async (req, res, next) => {
		const { body } = req;

		try {
			// If we are in setup mode, we don't check access for current user
			const setup = await isSetup();
			if (!setup) {
				logger.info("Creating a new user in setup mode");
				const access = new Access(null);
				await access.load(true);
				res.locals.access = access;

				// We are in setup mode, set some defaults for this first new user, such as making
				// them an admin.
				body.is_disabled = false;
				if (typeof body.roles !== "object" || body.roles === null) {
					body.roles = [];
				}
				if (body.roles.indexOf("admin") === -1) {
					body.roles.push("admin");
				}
			}

			const payload = apiValidator(getValidationSchema("/users", "post"), body);
			const user = await internalUser.create(res.locals.access, payload);
			res.status(201).send(user);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific user
 *
 * /api/users/123
 */
router
	.route("/:user_id")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * GET /users/123 or /users/me
	 *
	 * Retrieve a specific user
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(
				{
					required: ["user_id"],
					additionalProperties: false,
					properties: {
						user_id: {
							$ref: "common#/properties/id",
						},
						expand: {
							$ref: "common#/properties/expand",
						},
					},
				},
				{
					user_id: req.params.user_id,
					expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
				},
			);

			const user = await internalUser.get(res.locals.access, {
				id: data.user_id,
				expand: data.expand,
				omit: internalUser.getUserOmisionsByAccess(res.locals.access, data.user_id),
			});
			res.status(200).send(user);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/users/123
	 *
	 * Update and existing user
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/users/{userID}", "put"), req.body);
			payload.id = req.params.user_id;
			const result = await internalUser.update(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/users/123
	 *
	 * Update and existing user
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalUser.delete(res.locals.access, {
				id: req.params.user_id,
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific user auth
 *
 * /api/users/123/auth
 */
router
	.route("/:user_id/auth")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * PUT /api/users/123/auth
	 *
	 * Update password for a user
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/users/{userID}/auth", "put"), req.body);
			payload.id = req.params.user_id;
			const result = await internalUser.setPassword(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific user permissions
 *
 * /api/users/123/permissions
 */
router
	.route("/:user_id/permissions")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * PUT /api/users/123/permissions
	 *
	 * Set some or all permissions for a user
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/users/{userID}/permissions", "put"), req.body);
			payload.id = req.params.user_id;
			const result = await internalUser.setPermissions(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * User MFA
 *
 * /api/users/123/mfa
 */
router
	.route("/:user_id/mfa")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * GET /api/users/123/mfa
	 *
	 * Get MFA status for a user (all factors and backup codes)
	 */
	.get(async (req, res, next) => {
		try {
			const status = await internalMfa.getStatus(res.locals.access, req.params.user_id);
			res.status(200).send(status);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/users/123/mfa
	 *
	 * Admin reset: disable all second factors and backup codes for a user
	 */
	.delete(async (req, res, next) => {
		try {
			await internalMfa.adminDisable(res.locals.access, req.params.user_id);
			res.status(200).send(true);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * User TOTP
 *
 * /api/users/123/mfa/totp
 */
router
	.route("/:user_id/mfa/totp")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * POST /api/users/123/mfa/totp
	 *
	 * Start TOTP setup, returns QR code URL
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalTotp.startSetup(res.locals.access, req.params.user_id);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/users/123/mfa/totp?code=XXXXXX
	 *
	 * Disable TOTP for a user
	 */
	.delete(async (req, res, next) => {
		try {
			const code = typeof req.query.code === "string" ? req.query.code : null;
			if (!code) throw new errs.ValidationError("Missing required parameter: code");
			await internalMfa.disableTotp(res.locals.access, req.params.user_id, code);
			res.status(200).send(true);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * User TOTP enable
 *
 * /api/users/123/mfa/totp/enable
 */
router
	.route("/:user_id/mfa/totp/enable")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * POST /api/users/123/mfa/totp/enable
	 *
	 * Verify code and enable TOTP
	 */
	.post(async (req, res, next) => {
		try {
			const { code } = apiValidator(getValidationSchema("/users/{userID}/mfa/totp/enable", "post"), req.body);
			const result = await internalMfa.enableTotp(res.locals.access, req.params.user_id, code);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * User TOTP backup codes
 *
 * /api/users/123/mfa/backup-codes
 */
router
	.route("/:user_id/mfa/backup-codes")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * POST /api/users/123/mfa/backup-codes
	 *
	 * Regenerate backup codes
	 */
	.post(async (req, res, next) => {
		try {
			const { code } = apiValidator(getValidationSchema("/users/{userID}/mfa/backup-codes", "post"), req.body);
			const result = await internalMfa.regenerateBackupCodes(res.locals.access, req.params.user_id, code);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

router
	.route("/:user_id/sessions")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * DELETE /api/users/123/sessions
	 *
	 * Revoke all of a user's sessions (self or admin)
	 */
	.delete(async (req, res, next) => {
		try {
			await internalUser.revokeSessions(res.locals.access, req.params.user_id);
			if (Number(req.params.user_id) === res.locals.access.token.getUserId(0)) {
				res.clearCookie("__Host-Http-token", {
					httpOnly: true,
					secure: true,
					sameSite: "Strict",
				});
			}
			res.status(200).send(true);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * User avatar
 *
 * /api/users/123/avatar
 */
router
	.route("/:user_id/avatar")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.all(userIdFromMe)

	/**
	 * POST /api/users/123/avatar
	 *
	 * Upload a custom avatar
	 */
	.post(
		multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } }).single("avatar"),
		async (req, res, next) => {
			try {
				const result = await internalUser.setAvatar(res.locals.access, req.params.user_id, req.file);
				res.status(200).send(result);
			} catch (err) {
				debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
				next(err);
			}
		},
	)

	/**
	 * DELETE /api/users/123/avatar
	 *
	 * Remove the custom avatar, falling back to gravatar
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalUser.deleteAvatar(res.locals.access, req.params.user_id);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
