import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(argon2);

/**
 * Hashes a secret with argon2id, encoded as JSON
 *
 * Defaults to the second recommended option of RFC 9106, minimal uses the OWASP minimum
 * and is meant for secrets that are randomly generated instead of chosen by a user
 *
 * @param   {String}  plain
 * @param   {Boolean} minimal
 * @returns {Promise<String>}
 */
const hash = async (plain, minimal = false) => {
	const params = minimal
		? { memory: 19456, passes: 2, parallelism: 1 }
		: { memory: 65536, passes: 3, parallelism: 4 };
	const nonce = randomBytes(16);
	const tag = await derive("argon2id", { message: plain, nonce, tagLength: 32, ...params });

	return JSON.stringify({ ...params, nonce: nonce.toString("base64"), tag: tag.toString("base64") });
};

/**
 * Verifies a secret against a stored hash, using the parameters it carries
 *
 * @param   {String} plain
 * @param   {String} stored
 * @returns {Promise<Boolean>}
 */
const verify = async (plain, stored) => {
	try {
		const { nonce, tag, ...params } = JSON.parse(stored);
		const expected = Buffer.from(tag, "base64");
		const actual = await derive("argon2id", {
			message: plain,
			nonce: Buffer.from(nonce, "base64"),
			tagLength: expected.length,
			...params,
		});

		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
};

export { hash, verify };
