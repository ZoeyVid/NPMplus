import cn from "clsx";
import { useContext } from "react";
import EasyModal from "src/modules/easyModal";

export function Page({ children, className }) {
	return (
		<div
			className={cn("page", className)}
			inert={Object.values(useContext(EasyModal.NiceModalContext)).some(({ visible }) => visible)}
		>
			{children}
		</div>
	);
}
