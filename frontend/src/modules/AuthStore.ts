import { getUnixTime, parseISO } from "date-fns";
import type { TokenResponse } from "src/api/backend";

const TOKEN_KEY = "auth";

class AuthStore {
	// Get all tokens from stack
	get tokens() {
		const t = localStorage.getItem(TOKEN_KEY);
		let tokens: TokenResponse[] = [];
		if (t !== null) {
			try {
				tokens = JSON.parse(t);
			} catch (e) {
				console.error("Failed to parse tokens from localStorage", e);
			}
		}
		return tokens;
	}

	// Filter out invalid tokens and return true if we find one that is valid
	// hasActiveToken() {
	// 	const t = this.tokens;
	// 	return t.length > 0;
	// }
	// Start from the END of the stack and work backwards
	hasActiveToken() {
		const t = this.tokens;
		if (t.length === 0) {
			return false;
		}

		const now = Math.round(Date.now() / 1000);
		const oneMinuteBuffer = 60;
		for (let i = t.length - 1; i >= 0; i--) {
			const dte = getUnixTime(parseISO(t[i].expires));
			const valid = dte - oneMinuteBuffer > now;
			if (valid) {
				return true;
			}
			this.drop();
		}
		return false;
	}

	// Set a single token on the stack (only saves expires)
	set({ expires }: TokenResponse) {
		localStorage.setItem(TOKEN_KEY, JSON.stringify([{ expires }]));
	}

	// Drop a token from the END of the stack
	drop() {
		const t = this.tokens;
		t.splice(-1, 1);
		localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
	}

	clear() {
		localStorage.removeItem(TOKEN_KEY);
	}
}

export default new AuthStore();
