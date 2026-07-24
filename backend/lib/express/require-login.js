import errs from "../error.js";
import jwtdecode from "./jwt-decode.js";

export default () => [
	jwtdecode(),
	(_, res, next) => {
		if (!res.locals.access?.token.getUserId(0)) return next(new errs.PermissionError());
		next();
	},
];
