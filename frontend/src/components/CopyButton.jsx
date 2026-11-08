import { IconCopy } from "@tabler/icons-react";
import { intl } from "src/locale";

export function CopyButton({ text }) {
	return (
		<button
			type="button"
			title={intl.formatMessage({ id: "action.copy" })}
			className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center"
			onClick={() => navigator.clipboard.writeText(text)}
		>
			<IconCopy size={18} />
		</button>
	);
}
