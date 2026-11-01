import {
	getPathParameters,
	getQueryParameters,
	getQuerySchema,
	getRequestBody,
	getValidationSchema,
} from "../../schema/index.js";
import errs from "../error.js";
import apiValidator from "../validator/api.js";

const apiPrefix = /^\/api/u;
const trailingSlash = /\/$/u;
const pathParams = /:(?<name>\w+)/gu;

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

	const query = { ...req.query };
	for (const { name, explode } of getQueryParameters(path, method)) {
		if (explode === false && typeof query[name] === "string") query[name] = query[name].split(",");
	}
	res.locals.query = apiValidator(getQuerySchema(path, method), query);

	if (!getRequestBody(path, method) && (req.get("transfer-encoding") || Number(req.get("content-length")) > 0)) {
		throw new errs.ValidationError("Request body is not allowed");
	}
	const bodySchema = getValidationSchema(path, method);
	if (bodySchema) res.locals.body = apiValidator(bodySchema, req.body);

	next();
};
