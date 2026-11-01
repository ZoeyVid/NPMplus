const positiveInteger = /^[1-9]\d*$/u;

export default (_, __, next, value, name) => {
	if (name === "user_id" && value === "me") return next();
	if (positiveInteger.test(value) && Number(value) <= 2147483647) return next();
	next("router");
};
