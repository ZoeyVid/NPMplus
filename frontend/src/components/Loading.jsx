import { T } from "src/locale";

export function Loading({ label, noLogo }) {
	return (
		<div className="empty text-center">
			{noLogo ? null : (
				<div className="mb-3">
					<img src="/icon.svg" width={100} alt="" />
				</div>
			)}
			<div className="text-secondary text-shimmer mb-3">{label || <T id="loading" />}</div>
			<div className="progress progress-sm">
				<div className="progress-bar progress-bar-indeterminate" />
			</div>
		</div>
	);
}
