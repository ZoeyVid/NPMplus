import knex from "knex";
import { configGet } from "./lib/config.js";

let instance = null;

const generateDbConfig = () => {
	const cfg = configGet("database");

	if (cfg.engine === "knex-native") {
		return cfg.knex;
	}

	return {
		client: cfg.engine,
		connection: {
			host: cfg.host,
			user: cfg.user,
			password: cfg.password,
			database: cfg.name,
			port: cfg.port,
			...(cfg.ssl ? { ssl: cfg.ssl } : {}),
		},
		migrations: {
			tableName: "migrations",
		},
	};
};

const getInstance = () => {
	instance ??= knex(generateDbConfig());
	return instance;
};

export default getInstance;
