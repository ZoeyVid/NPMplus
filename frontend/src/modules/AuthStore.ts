import { getUnixTime, parseISO } from "date-fns";
import type { TokenResponse } from "src/api/backend";

const TOKEN_KEY = "auth";

class AuthStore {
	hasActiveToken() {
		const expires = localStorage.getItem(TOKEN_KEY);
		return expires !== null && getUnixTime(parseISO(expires)) - 60 > Math.round(Date.now() / 1000);
	}

	set({ expires }: TokenResponse) {
		localStorage.setItem(TOKEN_KEY, expires);
	}

	clear() {
		localStorage.removeItem(TOKEN_KEY);
	}
}

export default new AuthStore();
