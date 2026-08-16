/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const up = (_knex) => Promise.resolve(true);

/**
 * Undo Migrate
 *
 * @param   {Object} _knex
 * @returns {Promise}
 */
const down = (_knex) => Promise.resolve(true);

export { down, up };
