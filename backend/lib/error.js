const errs = {
	PermissionError: class extends Error {
		name = this.constructor.name;
		public = true;
		status = 403;

		constructor(message, messageI18n, options) {
			super(message || "Permission Denied", options);
			this.message_i18n = messageI18n;
		}
	},

	ItemNotFoundError: class extends Error {
		name = this.constructor.name;
		public = true;
		status = 404;

		constructor(id, options) {
			super(id ? `Not Found - ${id}` : "Not Found", options);
		}
	},

	AuthError: class extends Error {
		name = this.constructor.name;
		public = true;
		status = 401;

		constructor(message, messageI18n, options) {
			super(message, options);
			this.message_i18n = messageI18n;
		}
	},

	InternalValidationError: class extends Error {
		name = this.constructor.name;
		public = false;
		status = 400;
	},

	ConfigurationError: class extends Error {
		name = this.constructor.name;
		public = true;
		status = 400;
	},

	ValidationError: class extends Error {
		name = this.constructor.name;
		public = true;
		status = 400;

		constructor(message, messageI18n, options) {
			super(message, options);
			this.message_i18n = messageI18n;
		}
	},

	AssertionFailedError: class extends Error {
		name = this.constructor.name;
		public = false;
		status = 400;
	},

	CommandError: class extends Error {
		name = this.constructor.name;
		public = false;
	},
};

export default errs;
