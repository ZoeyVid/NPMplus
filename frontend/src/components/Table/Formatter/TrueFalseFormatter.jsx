import cn from "clsx";
import { T } from "src/locale";

export function TrueFalseFormatter({
	value,
	trueLabel = "enabled",
	trueColor = "lime",
	falseLabel = "disabled",
	falseColor = "red",
}) {
	return (
		<span className={cn("status", `status-${value ? trueColor : falseColor}`)}>
			<span className="status-dot status-dot-animated" />
			<T id={value ? trueLabel : falseLabel} />
		</span>
	);
}
