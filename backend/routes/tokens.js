import express from "express";
import { rateLimit } from "express-rate-limit";
import internalToken from "../internal/token.js";
import errs from "../lib/error.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";

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
});

router
	.route("/")

	/**
	 * GET /tokens
	 *
	 * Get a new Token, given they already have a token they want to refresh
	 * We also piggy back on to this method, allowing admins to get tokens
	 * for services like Job board and Worker.
	 */
	.get(validate, jwtdecode, async (_, res) => {
		const data = await internalToken.getFreshToken(res.locals.access, false, res.locals.query);

		res.cookie("__Host-Http-token", data.token, {
			signed: true,
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			expires: new Date(data.expires),
		});

		res.status(200).send({ expires: data.expires });
	})

	/**
	 * POST /tokens
	 *
	 * Create a new Token
	 */
	.post(limiter, validate, async (_, res) => {
		if (process.env.OIDC_DISABLE_PASSWORD === "true") {
			throw new errs.PermissionError("Non OIDC login is disabled");
		}

		const result = await internalToken.getTokenFromEmail(res.locals.body);
		const { token, ...responseBody } = result;

		if (result.requiresTotp) {
			res.cookie("__Host-Http-challenge_token", token, {
				signed: true,
				httpOnly: true,
				secure: true,
				sameSite: "Strict",
				expires: new Date(result.expires),
			});
		} else {
			res.cookie("__Host-Http-token", token, {
				signed: true,
				httpOnly: true,
				secure: true,
				sameSite: "Strict",
				expires: new Date(result.expires),
			});
		}

		res.status(200).send(responseBody);
	})

	/**
	 * DELETE /tokens
	 *
	 * Delete the Token
	 */
	.delete(validate, (_, res) => {
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
		res.status(200).send({ expires: new Date(0).toISOString() });
	});

router
	.route("/totp")

	/**
	 * POST /tokens/totp
	 *
	 * Verify TOTP code and get full token
	 */
	.post(limiter, validate, async (req, res) => {
		const result = await internalToken.verifyTotp(
			req.signedCookies?.["__Host-Http-challenge_token"],
			res.locals.body.code,
		);
		const { token, ...responseBody } = result;

		res.cookie("__Host-Http-token", token, {
			signed: true,
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			expires: new Date(result.expires),
		});
		res.clearCookie("__Host-Http-challenge_token", {
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
		});

		res.status(200).send(responseBody);
	});

export default router;
