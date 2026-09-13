import cn from "clsx";
import { Button, HasPermission } from "src/components";
import { T } from "src/locale";
import { MANAGE } from "src/modules/Permissions";

function EmptyData({
	tableInstance,
	onNew,
	isFiltered,
	object,
	objects,
	color = "primary",
	customAddBtn,
	permissionSection,
	permission,
}) {
	return (
		<tr>
			<td colSpan={tableInstance.getAllFlatColumns().length}>
				<div className="text-center my-4">
					{isFiltered ? (
						<h2>
							<T id="empty-search" />
						</h2>
					) : (
						<>
							<h2>
								<T id="object.empty" tData={{ objects }} />
							</h2>
							<HasPermission section={permissionSection} permission={permission || MANAGE} hideError>
								<p className="text-muted">
									<T id="empty-subtitle" />
								</p>
								{customAddBtn ? (
									customAddBtn
								) : (
									<Button className={cn("my-3", `btn-${color}`)} onClick={onNew}>
										<T id="object.add" tData={{ object }} />
									</Button>
								)}
							</HasPermission>
						</>
					)}
				</div>
			</td>
		</tr>
	);
}

export { EmptyData };
