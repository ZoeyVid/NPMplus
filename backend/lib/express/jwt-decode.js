import Access from "../access.js";

export default () => {
	return async (req, res, next) => {
		const token = req.signedCookies?.["__Host-Http-token"] || null;

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
			res.cookie("__Host-npmplus_oidc_no_redirect", "true", {
				secure: true,
				sameSite: "Strict",
				maxAge: 60 * 60 * 1000,
			});
			return res.status(401).json({
				error: {
					message: "Invalid or expired token",
				},
			});
		}
	};
};
