import errs from "../error.js";

export default (req, res, next) => {
	if (req.params.user_id === "me" && res.locals.access) {
		req.params.user_id = res.locals.access.token.getUserId(0);
		if (!req.params.user_id) {
			return next(new errs.PermissionError());
		}
	} else {
		req.params.user_id = Number.parseInt(req.params.user_id, 10);
	}
	next();
};
