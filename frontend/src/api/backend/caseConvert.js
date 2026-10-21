const separatorPattern = /[-_\s]+(?<char>.)?/gu;
const upperBoundaryPattern = /(?=[A-Z])/u;

const mapKeys = (fn) => {
	const walk = (o) => {
		if (Array.isArray(o)) return o.map(walk);
		if (o && typeof o === "object" && o.constructor === Object) {
			return Object.fromEntries(Object.entries(o).map(([k, v]) => [fn(k), walk(v)]));
		}
		return o;
	};
	return walk;
};
export const camelizeKeys = mapKeys((s) => s.replace(separatorPattern, (_, c) => c.toUpperCase()));
export const decamelizeKeys = mapKeys((s) => s.split(upperBoundaryPattern).join("_").toLowerCase());
