class PermissionError extends Error {
	constructor(message, previous) {
		super(message || "Permission Denied");
		this.name = "PermissionError";
		this.previous = previous;
		this.public = true;
		this.status = 403;
		Error.captureStackTrace(this, this.constructor);
	}
}

class ItemNotFoundError extends Error {
	constructor(id, previous) {
		super(id ? `Not Found - ${id}` : "Not Found");
		this.name = "ItemNotFoundError";
		this.previous = previous;
		this.public = true;
		this.status = 404;
		Error.captureStackTrace(this, this.constructor);
	}
}

class AuthError extends Error {
	constructor(message, messageI18n, previous) {
		super(message);
		this.name = "AuthError";
		this.previous = previous;
		this.message_i18n = messageI18n;
		this.public = true;
		this.status = 400;
		Error.captureStackTrace(this, this.constructor);
	}
}

class InternalError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "InternalError";
		this.previous = previous;
		this.status = 500;
		this.public = false;
		Error.captureStackTrace(this, this.constructor);
	}
}

class InternalValidationError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "InternalValidationError";
		this.previous = previous;
		this.status = 400;
		this.public = false;
		Error.captureStackTrace(this, this.constructor);
	}
}

class ConfigurationError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "ConfigurationError";
		this.previous = previous;
		this.status = 400;
		this.public = true;
		Error.captureStackTrace(this, this.constructor);
	}
}

class CacheError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "CacheError";
		this.previous = previous;
		this.status = 500;
		this.public = false;
		Error.captureStackTrace(this, this.constructor);
	}
}

class ValidationError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "ValidationError";
		this.previous = previous;
		this.public = true;
		this.status = 400;
		Error.captureStackTrace(this, this.constructor);
	}
}

class AssertionFailedError extends Error {
	constructor(message, previous) {
		super(message);
		this.name = "AssertionFailedError";
		this.previous = previous;
		this.public = false;
		this.status = 400;
		Error.captureStackTrace(this, this.constructor);
	}
}

class CommandError extends Error {
	constructor(stdErr, code, previous) {
		super(stdErr);
		this.name = "CommandError";
		this.previous = previous;
		this.code = code;
		this.public = false;
		Error.captureStackTrace(this, this.constructor);
	}
}

const errs = {
	PermissionError,
	ItemNotFoundError,
	AuthError,
	InternalError,
	InternalValidationError,
	ConfigurationError,
	CacheError,
	ValidationError,
	AssertionFailedError,
	CommandError,
};

export default errs;
