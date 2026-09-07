import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { intl, T } from "src/locale";
import styles from "./Dashboard.module.css";

const Metric = ({
	label,
	value,
	onClick,
	tone = "azure",
	description,
}: {
	label: ReactNode;
	value: string | number;
	onClick?: () => void;
	tone?: string;
	description?: ReactNode;
}) => {
	const content = (
		<>
			<div className={`card-status-start bg-${tone}`} />
			<div className="card-body">
				<div className="d-flex justify-content-between align-items-start gap-2">
					<div className={`${styles.metricLabel} text-secondary text-uppercase small`}>{label}</div>
					{onClick && <IconChevronRight size={16} className="text-secondary" aria-hidden="true" />}
				</div>
				<div className="h2 mb-0 mt-1">{typeof value === "number" ? intl.formatNumber(value) : value}</div>
				<div className={`${styles.metricDescription} text-secondary small mt-2`}>{description}</div>
				{onClick && (
					<span className="visually-hidden">
						<T id="crowdsec.kpi.open" />
					</span>
				)}
			</div>
		</>
	);
	return (
		<div className="col-sm-6 col-xl-3">
			{onClick ? (
				<button
					type="button"
					className={`${styles.metricCard} card card-sm h-100 w-100 text-start`}
					onClick={onClick}
					aria-haspopup="dialog"
				>
					{content}
				</button>
			) : (
				<div className={`${styles.metricCard} card card-sm h-100 w-100 text-start`}>{content}</div>
			)}
		</div>
	);
};

export default Metric;
