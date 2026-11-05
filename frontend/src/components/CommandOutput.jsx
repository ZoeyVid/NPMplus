import { CopyButton } from "src/components";

export function CommandOutput({ output }) {
	return (
		<div className="position-relative">
			<pre>
				<code>{output}</code>
			</pre>
			<span className="position-absolute top-0 end-0 m-2">
				<CopyButton text={output} />
			</span>
		</div>
	);
}
