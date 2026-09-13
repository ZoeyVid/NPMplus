import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import express from "express";
import errs from "./lib/error.js";
import { debug, express as logger } from "./logger.js";
import mainRoutes from "./routes/main.js";

/**
 * App
 */
const app = express();

app.enable("trust proxy");
app.use((req, _res, next) => {
	req.headers["x-forwarded-for"] = req.header("x-real-ip");
	return next();
});

app.disable("x-powered-by");
app.set("json spaces", 2);

app.use(cookieParser(process.env.COOKIE_SECRET || crypto.randomBytes(16).toString("hex")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * General Logging, BEFORE routes
 */

app.use((req, res, next) => {
	if (
		req.method === "GET" &&
		req.path === "/api/oidc/callback" &&
		req.get("sec-fetch-mode") === "navigate" &&
		req.get("sec-fetch-dest") === "document"
	) {
		return next();
	}

	if (req.get("origin") && req.get("origin") !== `${req.protocol}://${req.host}`) {
		return res.status(403).json({
			error: { message: "Rejected Origin." },
		});
	}
	if (["same-origin", "none", undefined].includes(req.get("sec-fetch-site"))) {
		return next();
	}

	res.status(403).json({
		error: { message: "Rejected Sec-Fetch-Site Value." },
	});
});

app.use("/", mainRoutes);

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, _) => {
	const status = err.status === 403 && !req.signedCookies?.["__Host-Http-token"] ? 401 : err.status || 500;
	const payload = {
		error: {
			code: status,
			message: err.public ? err.message : "Internal Error",
		},
	};

	if (err.message_i18n) {
		payload.error.message_i18n = err.message_i18n;
	}

	if (err instanceof errs.CommandError) {
		payload.error.output = err.message;
	}

	// Not every error is worth logging - but this is good for now until it gets annoying.
	if (err.stack) {
		debug(logger, err.stack);
		if (!err.public) {
			logger.warn(`${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
		}
	}

	res.status(status).send(payload);
});

export default app;
