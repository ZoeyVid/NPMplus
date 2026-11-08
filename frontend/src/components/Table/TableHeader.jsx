import cn from "clsx";

function TableHeader(props) {
	const { tableInstance } = props;
	const headerGroups = tableInstance.getHeaderGroups();

	return (
		<thead>
			{headerGroups.map((headerGroup) => (
				<tr key={headerGroup.id}>
					{headerGroup.headers.map((header) => {
						const { column } = header;
						const { className } = column.columnDef.meta ?? {};
						const sorted = column.getIsSorted();
						const label = typeof column.columnDef.header === "string" ? column.columnDef.header : null;
						return (
							<th
								key={header.id}
								className={className}
								aria-sort={{ asc: "ascending", desc: "descending" }[sorted]}
							>
								{label && column.getCanSort() ? (
									<button
										type="button"
										className={cn("table-sort bg-transparent w-auto", sorted)}
										onClick={column.getToggleSortingHandler()}
									>
										{label}
									</button>
								) : (
									label
								)}
							</th>
						);
					})}
				</tr>
			))}
		</thead>
	);
}

export { TableHeader };
