const separatorPattern = /[-_\s]+(.)?/g;
const firstCharPattern = /^./;
const upperBoundaryPattern = /(?=[A-Z])/;

const camelize = (s: string) =>
	s.replace(separatorPattern, (_, c) => (c ? c.toUpperCase() : "")).replace(firstCharPattern, (c) => c.toLowerCase());
export const decamelize = (s: string) => s.split(upperBoundaryPattern).join("_").toLowerCase();
const mapKeys = (fn: (k: string) => string) => {
	const walk = (o: any): any => {
		if (Array.isArray(o)) return o.map(walk);
		if (o && typeof o === "object" && o.constructor === Object)
			return Object.fromEntries(Object.entries(o).map(([k, v]) => [fn(k), walk(v)]));
		return o;
	};
	return walk;
};
export const camelizeKeys = mapKeys(camelize);
export const decamelizeKeys = mapKeys(decamelize);
