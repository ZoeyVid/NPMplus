import { toast } from "react-toastify";
import { intl } from "src/locale";
import { Msg } from "./Msg";

const showSuccess = (message) => {
	toast(Msg, {
		className: "bg-transparent shadow-none border-0",
		data: {
			type: "success",
			title: intl.formatMessage({ id: "notification.success" }),
			message,
		},
	});
};

const showError = (message) => {
	toast(<Msg />, {
		className: "bg-transparent shadow-none border-0",
		data: {
			type: "error",
			title: intl.formatMessage({ id: "notification.error" }),
			message,
		},
	});
};

const showObjectSuccess = (obj, action) => {
	showSuccess(
		intl.formatMessage(
			{
				id: `notification.object-${action}`,
			},
			{ object: intl.formatMessage({ id: obj }) },
		),
	);
};

export { showError, showObjectSuccess };
