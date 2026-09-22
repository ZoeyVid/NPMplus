const errs = {
	PermissionError: function (message, messageI18n) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message || "Permission Denied";
		this.message_i18n = messageI18n;
		this.public = true;
		this.status = 403;
	},

	ItemNotFoundError: function (id) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = "Not Found";
		if (id) {
			this.message = `Not Found - ${id}`;
		}
		this.public = true;
		this.status = 404;
	},

	AuthError: function (message, messageI18n) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message;
		this.message_i18n = messageI18n;
		this.public = true;
		this.status = 401;
	},

	InternalValidationError: function (message) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message;
		this.status = 400;
		this.public = false;
	},

	ConfigurationError: function (message) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message;
		this.status = 400;
		this.public = true;
	},

	ValidationError: function (message) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message;
		this.public = true;
		this.status = 400;
	},

	AssertionFailedError: function (message) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = message;
		this.public = false;
		this.status = 400;
	},

	CommandError: function (stdErr) {
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.message = stdErr;
		this.public = false;
	},
};

for (const err of Object.values(errs)) {
	err.prototype = Object.create(Error.prototype);
}

export default errs;
