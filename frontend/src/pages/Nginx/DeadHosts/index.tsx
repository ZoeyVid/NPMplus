import { HasPermission } from "src/components";
import { DEAD_HOSTS, VIEW } from "src/modules/Permissions";
import TableWrapper from "./TableWrapper";

const DeadHosts = () => (
	<HasPermission section={DEAD_HOSTS} permission={VIEW} pageLoading loadingNoLogo>
		<TableWrapper />
	</HasPermission>
);

export default DeadHosts;
