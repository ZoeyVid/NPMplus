import { HasPermission } from "src/components";
import { CERTIFICATES, VIEW } from "src/modules/Permissions";
import TableWrapper from "./TableWrapper";

const Certificates = () => (
	<HasPermission section={CERTIFICATES} permission={VIEW} pageLoading loadingNoLogo>
		<TableWrapper />
	</HasPermission>
);

export default Certificates;
