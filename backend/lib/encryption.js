import crypto from "node:crypto";

// Generate a random key on startup.
// This implies that if the server restarts, all pending encrypted cookies (e.g. OIDC tokens waiting to be claimed) become invalid.
// This is acceptable for short-lived login flows.
const algorithm = "aes-256-gcm";
const key = crypto.randomBytes(32);

export const encrypt = (text) => {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(algorithm, key, iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag().toString("hex");
	return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

export const decrypt = (text) => {
	const parts = text.split(":");
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted text format");
	}
	const iv = Buffer.from(parts[0], "hex");
	const encryptedText = parts[1];
	const authTag = Buffer.from(parts[2], "hex");

	const decipher = crypto.createDecipheriv(algorithm, key, iv);
	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(encryptedText, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
};
