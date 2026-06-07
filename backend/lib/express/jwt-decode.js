import Access from "../access.js";

export default () => {
	return async (req, res, next) => {
		const bearerHeader = req.headers.authorization;
		const bearerToken = bearerHeader?.startsWith("Bearer ") ? bearerHeader.slice(7) : null;
		const token = req.signedCookies?.["__Host-Http-token"] || bearerToken || null;

		//if (!token) {
		//	return res.status(401).json({
		//		error: {
		//			message: "Missing token",
		//		},
		//	});
		//}

		try {
			res.locals.access = null;
			const access = new Access(token);
			await access.load();
			res.locals.access = access;
			next();
		} catch {
			res.clearCookie("__Host-Http-token", {
				httpOnly: true,
				secure: true,
				sameSite: "Strict",
			});
			return res.status(403).json({
				error: {
					message: "Invalid or expired token",
				},
			});
		}
	};
};
