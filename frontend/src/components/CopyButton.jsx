import { IconCopy } from "@tabler/icons-react";

export function CopyButton({ text }) {
	return (
		<button
			type="button"
			aria-label="copy"
			className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center"
			onClick={() => navigator.clipboard.writeText(text)}
		>
			<IconCopy size={18} />
		</button>
	);
}
