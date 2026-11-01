import { getPathParameters, getQuerystringContent, getValidationSchema } from "../../schema/index.js";
import errs from "../error.js";
import apiValidator from "../validator/api.js";

const apiPrefix = /^\/api/u;
const trailingSlash = /\/$/u;
const pathParams = /:(?<name>\w+)/gu;
const noQuerystring = { type: "object", additionalProperties: false };

export default (req, res, next) => {
	const path =
		`${req.baseUrl}${req.route.path}`
			.replace(apiPrefix, "")
			.replace(trailingSlash, "")
			.replaceAll(pathParams, "{$<name>}") || "/";
	const method = req.method === "HEAD" ? "get" : req.method.toLowerCase();

	const pathParameters = getPathParameters(path, method);
	if (!pathParameters) throw new errs.InternalError(`No schema for ${method.toUpperCase()} ${path}`);
	res.locals.params = {};
	for (const { name, schema } of pathParameters) {
		res.locals.params[name] = apiValidator(schema, req.params[name], name);
	}

	const querystring = getQuerystringContent(path, method);
	const query = { ...req.query };
	for (const key of Object.keys(querystring?.encoding ?? {})) {
		if (querystring.encoding[key].explode === false && typeof query[key] === "string") {
			query[key] = query[key].split(",");
		}
	}
	res.locals.query = apiValidator(querystring?.schema ?? noQuerystring, query);

	const bodySchema = getValidationSchema(path, method);
	if (bodySchema) res.locals.body = apiValidator(bodySchema, req.body);

	next();
};
