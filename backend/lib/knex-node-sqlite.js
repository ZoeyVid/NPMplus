import { Database } from "node:sqlite";
import Client_BetterSQLite3 from "knex/lib/dialects/better-sqlite3/index.js";
import Transaction_Sqlite from "knex/lib/dialects/sqlite3/execution/sqlite-transaction.js";

class Transaction_NodeSQLite extends Transaction_Sqlite {
	query(conn, sql, status, value) {
		return super.query(conn, sql === "BEGIN;" && !this.readOnly ? "BEGIN IMMEDIATE;" : sql, status, value);
	}
}

class Client_NodeSQLite extends Client_BetterSQLite3 {
	transaction(...args) {
		return new Transaction_NodeSQLite(this, ...args);
	}

	acquireRawConnection() {
		return new this.driver(this.connectionSettings.filename, this.connectionSettings.options ?? {});
	}

	_query(connection, obj) {
		return Promise.try(() => {
			if (!obj.sql) throw new Error("The query is empty");
			if (!connection) throw new Error("No connection provided");

			const statement = connection.prepare(obj.sql);
			const safeIntegers = this._optSafeIntegers(obj.options);
			if (safeIntegers !== undefined) statement.setReadBigInts(safeIntegers);

			const bindings = this._formatBindings(obj.bindings);
			if (statement.columns().length > 0) {
				obj.response = statement.all(...bindings).map((row) => ({ ...row }));
				return obj;
			}

			obj.response = statement.run(...bindings);
			obj.context = { lastID: obj.response.lastInsertRowid, changes: obj.response.changes };
			return obj;
		});
	}
}

Object.assign(Client_NodeSQLite.prototype, { driverName: "node:sqlite", _driver: () => Database });

export default Client_NodeSQLite;
