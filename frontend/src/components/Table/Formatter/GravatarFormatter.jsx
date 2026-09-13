const defaultImg = "/images/default-avatar.jpg";

export function GravatarFormatter({ url, name }) {
	return (
		<div className="d-flex py-1 align-items-center">
			<span
				title={name}
				className="avatar avatar-square avatar-2 me-2"
				style={{
					backgroundImage: `url(${url || defaultImg})`,
				}}
			/>
		</div>
	);
}
