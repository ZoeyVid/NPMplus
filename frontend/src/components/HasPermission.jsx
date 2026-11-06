import Alert from "react-bootstrap/Alert";
import { Loading, LoadingPage } from "src/components";
import { useUser } from "src/hooks";
import { T } from "src/locale";
import { hasPermission } from "src/modules/Permissions";

function HasPermission({ section, permission, children, hideError, pageLoading, loadingNoLogo }) {
	const { data, isPending } = useUser("me");

	if (!section) {
		return <>{children}</>;
	}

	if (isPending) {
		if (hideError) {
			return null;
		}
		if (pageLoading) {
			return <LoadingPage noLogo={loadingNoLogo} />;
		}
		return <Loading noLogo={loadingNoLogo} />;
	}

	const allowed = hasPermission(section, permission, data?.permissions, data?.npmplusIsAdmin);
	if (allowed) {
		return <>{children}</>;
	}

	return !hideError ? (
		<Alert variant="danger">
			<T id="no-permission-error" />
		</Alert>
	) : null;
}

export { HasPermission };
