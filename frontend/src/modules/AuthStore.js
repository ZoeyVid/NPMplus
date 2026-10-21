import { getUnixTime, parseISO } from "date-fns";

const TOKEN_KEY = "auth";

export default {
	hasActiveToken() {
		const expires = localStorage.getItem(TOKEN_KEY);
		return expires !== null && getUnixTime(parseISO(expires)) - 60 > Math.round(Date.now() / 1000);
	},

	set({ expires }) {
		localStorage.setItem(TOKEN_KEY, expires);
	},

	clear() {
		localStorage.removeItem(TOKEN_KEY);
	},
};
