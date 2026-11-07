import express from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import internalMfa from "../internal/mfa.js";
import internalToken from "../internal/token.js";
import internalTotp from "../internal/totp.js";
import internalUser from "../internal/user.js";
import Access from "../lib/access.js";
import errs from "../lib/error.js";
import idParam from "../lib/express/id-param.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import userIdFromMe from "../lib/express/user-id-from-me.js";
import validate from "../lib/express/validate.js";
import { express as logger } from "../logger.js";
import { isSetup } from "../setup.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

let setupRunning = false;

const limiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	limit: 5,
	message: { error: { message: "Too many requests, please try again later." } },
	standardHeaders: "draft-8",
	legacyHeaders: false,
	ipv6Subnet: 48,
	skipSuccessfulRequests: true,
});

router.use(limiter);
router.param("user_id", idParam);

/**
 * /api/users
 */
router
	.route("/")

	/**
	 * GET /api/users
	 *
	 * Retrieve all users
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const users = await internalUser.getAll(res.locals.access);
		res.status(200).send(users);
	})

	/**
	 * POST /api/users
	 *
	 * Create a new User
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const user = await internalUser.create(res.locals.access, res.locals.body);
		res.status(201).send(user);
	});

/**
 * Initial user
 *
 * /api/users/setup
 */
router
	.route("/setup")

	/**
	 * POST /api/users/setup
	 *
	 * Create the initial admin User, only possible while no User exists
	 */
	.post(validate, async (_, res) => {
		if (setupRunning) {
			throw new errs.PermissionError();
		}
		setupRunning = true;
		try {
			if (await isSetup()) {
				throw new errs.PermissionError();
			}
			logger.info("Creating a new user in setup mode");

			const access = new Access(null);
			await access.load(true);

			// Force this first user to be an admin.
			const user = await internalUser.create(access, { ...res.locals.body, npmplus_is_admin: true });
			res.status(201).send(user);
		} finally {
			setupRunning = false;
		}
	});

/**
 * Specific user
 *
 * /api/users/123
 */
router
	.route("/:user_id")

	/**
	 * GET /users/123 or /users/me
	 *
	 * Retrieve a specific user
	 */
	.get(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const user = await internalUser.get(res.locals.access, {
			id: Number(res.locals.params.user_id),
			expand: res.locals.query.expand,
		});
		res.status(200).send(user);
	})

	/**
	 * PUT /api/users/123
	 *
	 * Update and existing user
	 */
	.put(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalUser.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.user_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/users/123
	 *
	 * Update and existing user
	 */
	.delete(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalUser.delete(res.locals.access, {
			id: Number(res.locals.params.user_id),
		});
		res.status(200).send(result);
	});

/**
 * Specific user auth
 *
 * /api/users/123/auth
 */
router
	.route("/:user_id/auth")

	/**
	 * PUT /api/users/123/auth
	 *
	 * Update password for a user
	 */
	.put(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalUser.setPassword(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.user_id),
		});
		if (Number(res.locals.params.user_id) === res.locals.access.token.getUserId(0)) {
			const data = await internalToken.getFreshToken(res.locals.access, true);
			res.cookie("__Host-Http-token", data.token, {
				signed: true,
				httpOnly: true,
				secure: true,
				sameSite: "Strict",
				expires: new Date(data.expires),
			});
		}
		res.status(200).send(result);
	});

/**
 * Specific user permissions
 *
 * /api/users/123/permissions
 */
router
	.route("/:user_id/permissions")

	/**
	 * PUT /api/users/123/permissions
	 *
	 * Set some or all permissions for a user
	 */
	.put(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalUser.setPermissions(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.user_id),
		});
		res.status(200).send(result);
	});

/**
 * User MFA
 *
 * /api/users/123/mfa
 */
router
	.route("/:user_id/mfa")

	/**
	 * GET /api/users/123/mfa
	 *
	 * Get MFA status for a user (all factors and backup codes)
	 */
	.get(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const status = await internalMfa.getStatus(res.locals.access, Number(res.locals.params.user_id));
		res.status(200).send(status);
	})

	/**
	 * DELETE /api/users/123/mfa
	 *
	 * Admin reset: disable all second factors and backup codes for a user
	 */
	.delete(jwtdecode, userIdFromMe, validate, async (_, res) => {
		await internalMfa.adminDisable(res.locals.access, Number(res.locals.params.user_id));
		res.status(200).send(true);
	});

/**
 * User TOTP
 *
 * /api/users/123/mfa/totp
 */
router
	.route("/:user_id/mfa/totp")

	/**
	 * POST /api/users/123/mfa/totp
	 *
	 * Start TOTP setup, returns QR code URL
	 */
	.post(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalTotp.startSetup(res.locals.access, Number(res.locals.params.user_id));
		res.status(200).send(result);
	});

/**
 * User TOTP enable
 *
 * /api/users/123/mfa/totp/enable
 */
router
	.route("/:user_id/mfa/totp/enable")

	/**
	 * POST /api/users/123/mfa/totp/enable
	 *
	 * Verify code and enable TOTP
	 */
	.post(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalMfa.enableTotp(
			res.locals.access,
			Number(res.locals.params.user_id),
			res.locals.body.code,
		);
		const data = await internalToken.getFreshToken(res.locals.access, true);
		res.cookie("__Host-Http-token", data.token, {
			signed: true,
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			expires: new Date(data.expires),
		});
		res.status(200).send(result);
	});

router
	.route("/:user_id/mfa/totp/disable")

	/**
	 * POST /api/users/123/mfa/totp/disable
	 *
	 * Disable TOTP for a user
	 */
	.post(jwtdecode, userIdFromMe, validate, async (_, res) => {
		await internalMfa.disableTotp(res.locals.access, Number(res.locals.params.user_id), res.locals.body.code);
		res.status(200).send(true);
	});

/**
 * User TOTP backup codes
 *
 * /api/users/123/mfa/backup-codes
 */
router
	.route("/:user_id/mfa/backup-codes")

	/**
	 * POST /api/users/123/mfa/backup-codes
	 *
	 * Regenerate backup codes
	 */
	.post(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalMfa.regenerateBackupCodes(
			res.locals.access,
			Number(res.locals.params.user_id),
			res.locals.body.code,
		);
		const data = await internalToken.getFreshToken(res.locals.access, true);
		res.cookie("__Host-Http-token", data.token, {
			signed: true,
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			expires: new Date(data.expires),
		});
		res.status(200).send(result);
	});

router
	.route("/:user_id/sessions")

	/**
	 * DELETE /api/users/123/sessions
	 *
	 * Revoke all of a user's sessions (self or admin)
	 */
	.delete(jwtdecode, userIdFromMe, validate, async (_, res) => {
		await internalUser.revokeSessions(res.locals.access, Number(res.locals.params.user_id));
		if (Number(res.locals.params.user_id) === res.locals.access.token.getUserId(0)) {
			res.clearCookie("__Host-Http-token", {
				httpOnly: true,
				secure: true,
				sameSite: "Strict",
			});
			res.cookie("__Host-npmplus_oidc_no_redirect", "true", {
				secure: true,
				sameSite: "Strict",
				maxAge: 60 * 60 * 1000,
			});
		}
		res.status(200).send(true);
	});

/**
 * User avatar
 *
 * /api/users/123/avatar
 */
router
	.route("/:user_id/avatar")

	/**
	 * POST /api/users/123/avatar
	 *
	 * Upload a custom avatar
	 */
	.post(
		jwtdecode,
		userIdFromMe,
		validate,
		multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } }).single("avatar"),
		async (req, res) => {
			const result = await internalUser.setAvatar(res.locals.access, Number(res.locals.params.user_id), req.file);
			res.status(200).send(result);
		},
	)

	/**
	 * DELETE /api/users/123/avatar
	 *
	 * Remove the custom avatar, falling back to gravatar
	 */
	.delete(jwtdecode, userIdFromMe, validate, async (_, res) => {
		const result = await internalUser.deleteAvatar(res.locals.access, Number(res.locals.params.user_id));
		res.status(200).send(result);
	});

export default router;
