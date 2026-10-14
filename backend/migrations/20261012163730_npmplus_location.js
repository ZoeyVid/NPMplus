import { migrate as logger } from "../logger.js";

const migrateName = "npmplus_location";

const boolFields = [
	"npmplus_noindex",
	"npmplus_crowdsec_appsec",
	"npmplus_proxy_request_buffering",
	"npmplus_proxy_response_buffering",
	"npmplus_upstream_compression",
	"npmplus_fancyindex",
];

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.createTable("npmplus_location", (table) => {
		table.increments().primary();
		table.integer("proxy_host_id").notNull().unsigned().index();
		table.integer("npmplus_enabled").notNull().unsigned().defaultTo(1);
		table.text("path").notNull();
		table.string("location_type").notNull().defaultTo("");
		table.string("forward_scheme").notNull().defaultTo("http");
		table.string("forward_host").notNull().defaultTo("");
		table.integer("forward_port").notNull().unsigned().defaultTo(0);
		for (const field of boolFields) table.integer(field).notNull().unsigned().defaultTo(0);
		table.string("npmplus_x_frame_options").notNull().defaultTo("SAMEORIGIN");
		table.string("npmplus_auth_request").notNull().defaultTo("none");
		table.string("npmplus_auth_request_upstream").notNull().defaultTo("");
		table.text("advanced_config").notNull().defaultTo("");
		table.string("npmplus_access_list_type").notNull().defaultTo("global");
	});

	logger.info(`[${migrateName}] npmplus_location Table created`);

	const hosts = await knex("proxy_host").select(
		"id",
		"locations",
		"npmplus_access_list_type",
		"npmplus_access_list_ids",
	);
	const locations = hosts.flatMap((host) =>
		(Array.isArray(host.locations) ? host.locations : JSON.parse(host.locations)).map((location) => ({
			...location,
			proxy_host_id: host.id,
		})),
	);

	await knex.batchInsert(
		"npmplus_location",
		locations.map((location) => ({
			proxy_host_id: location.proxy_host_id,
			npmplus_enabled: location.npmplus_enabled === false ? 0 : 1,
			path: location.path ?? "",
			location_type: location.location_type ?? "",
			forward_scheme: location.forward_scheme ?? "http",
			forward_host: location.forward_host ?? "",
			forward_port: Number.parseInt(location.forward_port, 10) || 0,
			...Object.fromEntries(boolFields.map((field) => [field, location[field] ? 1 : 0])),
			npmplus_x_frame_options: location.npmplus_x_frame_options ?? "SAMEORIGIN",
			npmplus_auth_request: location.npmplus_auth_request ?? "none",
			npmplus_auth_request_upstream: location.npmplus_auth_request_upstream ?? "",
			advanced_config: location.advanced_config ?? "",
			npmplus_access_list_type: location.npmplus_access_list_type ?? "global",
		})),
		100,
	);

	logger.info(`[${migrateName}] ${locations.length} locations moved to npmplus_location`);

	await knex.schema.dropTable("npmplus_proxy_host_access_list");
	await knex.schema.createTable("npmplus_proxy_host_access_list", (table) => {
		table.integer("proxy_host_id").notNull().unsigned();
		table.integer("location_id").notNull().unsigned().defaultTo(0);
		table.integer("access_list_id").notNull().unsigned();
		table.integer("position").notNull().unsigned().defaultTo(0);
		table.primary(["proxy_host_id", "location_id", "access_list_id"]);
	});

	const validIds = new Set(await knex("access_list").pluck("id"));
	const locationIds = await knex("npmplus_location").orderBy("id").pluck("id");
	const toRelations = (
		proxy_host_id,
		location_id,
		{ npmplus_access_list_type: type, npmplus_access_list_ids: ids },
	) => {
		if (type === "custom") {
			return [...new Set(Array.isArray(ids) ? ids : JSON.parse(ids))]
				.filter((id) => validIds.has(id))
				.map((access_list_id, position) => ({ proxy_host_id, location_id, access_list_id, position }));
		}
		return [];
	};
	const relations = [
		...hosts.flatMap((host) => toRelations(host.id, 0, host)),
		...locations.flatMap((location, index) => toRelations(location.proxy_host_id, locationIds[index], location)),
	];

	await knex.batchInsert("npmplus_proxy_host_access_list", relations, 100);

	logger.info(`[${migrateName}] ${relations.length} access list relations written to npmplus_proxy_host_access_list`);

	await knex("proxy_host").update({ locations: "[]" });
	await knex("proxy_host").whereNull("forward_port").update({ forward_port: 0 });
	await knex.schema.alterTable("proxy_host", (table) => {
		table.dropColumn("npmplus_access_list_ids");
		table.integer("forward_port").unsigned().notNull().defaultTo(0).alter();
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);
};

/**
 * Undo Migrate
 *
 * @param   {Object} _knex
 * @returns {Promise}
 */
const down = (_knex) => {
	throw new Error(`[${migrateName}] You can't migrate down this one.`);
};

export { down, up };
