import { formatDateTime, T } from "src/locale";

export function ValueWithDateFormatter({ value, createdOn, disabled }) {
	return (
		<div className="flex-fill">
			<div className="font-weight-medium">
				<div className={`font-weight-medium ${disabled ? "text-red" : ""}`}>{value}</div>
			</div>
			<div className={`text-secondary mt-1 ${disabled ? "text-red" : ""}`}>
				<T id={disabled ? "disabled" : "created-on"} data={{ date: formatDateTime(createdOn) }} />
			</div>
		</div>
	);
}
