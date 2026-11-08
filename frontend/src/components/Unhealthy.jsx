import { Page } from "src/components";
import { T } from "src/locale";

export function Unhealthy() {
	return (
		<Page className="page-center">
			<div className="container-tight py-4">
				<div className="empty">
					<p className="empty-title">
						<T id="unhealthy.title" />
					</p>
					<p className="empty-subtitle text-secondary">
						<T id="unhealthy.content" />
					</p>
				</div>
			</div>
		</Page>
	);
}
