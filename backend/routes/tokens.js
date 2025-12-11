import express from "express";
import internalToken from "../internal/token.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import apiValidator from "../lib/validator/api.js";
import { debug, express as logger } from "../logger.js";
import { getValidationSchema } from "../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

const loginAttempts = new Map();

// Clean up login attempts every 15 minutes to prevent memory leaks
setInterval(() => {
	const now = Date.now();
	for (const [ip, data] of loginAttempts.entries()) {
		if (now > data.blockedUntil && now - data.lastAttempt > 900000) {
			loginAttempts.delete(ip);
		}
	}
}, 900000);

router
	.route("/")
	.options((_, res) => {
		res.sendStatus(204);
	})

	/**
	 * GET /tokens
	 *
	 * Get a new Token, given they already have a token they want to refresh
	 * We also piggy back on to this method, allowing admins to get tokens
	 * for services like Job board and Worker.
	 */
	.get(jwtdecode(), async (req, res, next) => {
		try {
			const data = await internalToken.getFreshToken(res.locals.access, {
				expiry: typeof req.query.expiry !== "undefined" ? req.query.expiry : null,
				scope: typeof req.query.scope !== "undefined" ? req.query.scope : null,
			});
			// clear this temporary cookie following a successful oidc authentication
			res.clearCookie("npmplus_oidc");
			res.status(200).send(data);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /tokens
	 *
	 * Create a new Token
	 */
	.post(async (req, res, next) => {
		const ip = req.ip;
		const now = Date.now();
		const attempts = loginAttempts.get(ip) || { count: 0, blockedUntil: 0, lastAttempt: 0 };

		if (now < attempts.blockedUntil) {
			res.status(429).send({
				error: {
					code: 429,
					message: "Too many login attempts. Please try again later.",
				},
			});
			return;
		}

		try {
			const data = await apiValidator(getValidationSchema("/tokens", "post"), req.body);
			const result = await internalToken.getTokenFromEmail(data);
			loginAttempts.delete(ip);
			res.status(200).send(result);
		} catch (err) {
			attempts.count++;
			attempts.lastAttempt = now;
			if (attempts.count >= 5) {
				attempts.blockedUntil = now + 900000; // Block for 15 minutes
				logger.warn(`IP ${ip} blocked due to too many failed login attempts.`);
			}
			loginAttempts.set(ip, attempts);

			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			// Small delay to deter timing attacks
			await new Promise((resolve) => setTimeout(resolve, 500));
			next(err);
		}
	});

export default router;
