function EmptyRow({ tableInstance }) {
	return (
		<tr>
			<td colSpan={tableInstance.getAllFlatColumns().length}>
				<p className="text-center">There are no items</p>
			</td>
		</tr>
	);
}

export { EmptyRow };
