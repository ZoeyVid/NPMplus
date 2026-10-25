import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";

function Pagination({ top, total, page, pageSize, onChange }) {
	if (total <= 25) return null;

	const pages = Math.ceil(total / pageSize);

	return (
		<div
			className={`card-footer d-flex flex-wrap align-items-center justify-content-end gap-2 py-1${top ? " border-top-0 border-bottom" : ""}`}
		>
			<select
				className="form-select form-select-sm w-auto me-auto"
				value={pageSize}
				onChange={(e) => {
					const size = Number(e.target.value);
					onChange(Math.floor((page * pageSize) / size), size);
				}}
			>
				{[25, 50, 75, 100].map((size) => (
					<option key={size}>{size}</option>
				))}
			</select>
			<div className="d-flex align-items-center gap-2 ms-auto">
				<button
					type="button"
					className="btn btn-sm btn-icon"
					disabled={!page}
					onClick={() => onChange(0, pageSize)}
				>
					<IconChevronsLeft size={16} />
				</button>
				<button
					type="button"
					className="btn btn-sm btn-icon"
					disabled={!page}
					onClick={() => onChange(page - 1, pageSize)}
				>
					<IconChevronLeft size={16} />
				</button>
				<form
					className="d-flex align-items-center gap-2 text-nowrap"
					onSubmit={(e) => {
						e.preventDefault();
						onChange(e.currentTarget.page.valueAsNumber - 1, pageSize);
					}}
				>
					<input
						key={page}
						name="page"
						type="number"
						className="form-control form-control-sm text-center"
						style={{ width: "5rem" }}
						min={1}
						max={pages}
						required
						defaultValue={page + 1}
					/>
					/ {pages}
				</form>
				<button
					type="button"
					className="btn btn-sm btn-icon"
					disabled={page >= pages - 1}
					onClick={() => onChange(page + 1, pageSize)}
				>
					<IconChevronRight size={16} />
				</button>
				<button
					type="button"
					className="btn btn-sm btn-icon"
					disabled={page >= pages - 1}
					onClick={() => onChange(pages - 1, pageSize)}
				>
					<IconChevronsRight size={16} />
				</button>
			</div>
		</div>
	);
}

export { Pagination };
