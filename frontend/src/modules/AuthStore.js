const TOKEN_KEY = "auth";

export default {
	hasActiveToken() {
		return Date.parse(localStorage.getItem(TOKEN_KEY)) - 60000 > Date.now();
	},

	set({ expires }) {
		localStorage.setItem(TOKEN_KEY, expires);
	},

	clear() {
		localStorage.removeItem(TOKEN_KEY);
	},
};
