import {
	IconAlertTriangle,
	IconArrowDown,
	IconArrowUp,
	IconLock,
	IconLockOpen2,
	IconWorld,
	IconX,
} from "@tabler/icons-react";
import { Field, FieldArray, getIn, useFormikContext } from "formik";
import { useMemo } from "react";
import Select, { components } from "react-select";
import { useAccessLists } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";
import { selectClassNames } from "src/modules/Select";

const OptionContent = (label, subLabel, icon) => (
	<div className="flex-fill">
		<div className="font-weight-medium">
			{icon}
			<strong className="ms-1">{label}</strong>
		</div>
		<div className="text-secondary mt-1 ps-3">{subLabel}</div>
	</div>
);

const Option = (props) => (
	<components.Option {...props}>{OptionContent(props.data.label, props.data.subLabel)}</components.Option>
);

const TypeOption = (props) => (
	<components.Option {...props}>
		{OptionContent(props.data.label, props.data.subLabel, props.data.icon)}
	</components.Option>
);

const createDefaultItem = (item) => ({
	value: item.id,
	label: item.name,
	subLabel: intl.formatMessage(
		{ id: "access-list.subtitle" },
		{
			users: item?.items?.length,
			rules: item?.clients?.filter(({ address }) => address.toLowerCase() !== "all").length,
			date: formatDateTime(item?.createdOn),
		},
	),
	meta: item,
});

export function AccessFields({ location, name, typeFieldName, authRequest, disabled }) {
	const { values: formValues, setFieldValue } = useFormikContext();
	const values = getIn(formValues, name);
	const aclValue = getIn(formValues, typeFieldName);
	const { isPending, isError, error, data } = useAccessLists(["owner", "items", "clients"]);

	const createOption = (type) => {
		if (type === "global") {
			return {
				icon: <IconWorld size={14} className="text-cyan" />,
				type,
				label: intl.formatMessage({ id: "access-list.global" }),
				subLabel: intl.formatMessage({ id: "access-list.global.subtitle" }),
			};
		}
		if (type === "custom") {
			return {
				icon: <IconLock size={14} className="text-lime" />,
				type,
				label: intl.formatMessage({ id: "access-list.custom" }),
				subLabel: intl.formatMessage({ id: "access-list.custom.subtitle" }),
			};
		}
		return {
			icon: <IconLockOpen2 size={14} className="text-red" />,
			type,
			label: intl.formatMessage({ id: "access-list.public" }),
			subLabel: intl.formatMessage({ id: "access-list.public.subtitle" }),
		};
	};

	const defaultOptions = useMemo(() => data?.map(createDefaultItem) || [], [data]);
	const valuesSet = new Set(values);
	const options = defaultOptions.filter((option) => !valuesSet.has(option.value));

	const typeOptions = () => {
		const ret = [];
		if (!isPending && !isError && location !== undefined) {
			ret.push(createOption("global"));
		}
		ret.push(createOption("public"));
		if (!isPending && !isError && defaultOptions.length > 0) {
			ret.push(createOption("custom"));
		}
		return ret;
	};

	const handleTypeChange = (e, push) => {
		void setFieldValue(typeFieldName, e.type);
		if (e.type === "custom" && values.length === 0) push(options[0].value);
	};

	const aclIds =
		{
			custom: values,
			global: formValues.npmplusAccessListType === "custom" ? formValues.npmplusAccessListIds : [],
		}[aclValue] ?? [];
	const acls = aclIds.map((id) => data?.find((acl) => acl.id === id)).filter(Boolean);
	const first = data?.find((acl) => acl.id === aclIds[0]);

	return (
		<div className="mb-3">
			{isPending ? <div className="placeholder placeholder-lg col-12 my-3 placeholder-glow" /> : null}
			{isError ? (
				<div className="invalid-feedback d-block">
					<T id={error.message} />
				</div>
			) : null}
			<FieldArray name={name} validateOnChange={false}>
				{({ push, remove, replace, swap }) => (
					<>
						<div className="row mb-3">
							<div className="col-md-10">
								<div className="input-group shadow-none">
									<Field name={typeFieldName}>
										{({ field }) => (
											<Select
												className="col-md-8"
												unstyled
												classNames={selectClassNames}
												isSearchable={false}
												isDisabled={disabled}
												getOptionValue={(o) => o.type}
												value={createOption(field.value)}
												options={typeOptions()}
												components={{ Option: TypeOption }}
												onChange={(e) => handleTypeChange(e, push)}
											/>
										)}
									</Field>
								</div>
							</div>
						</div>
						{!isPending && !isError && aclValue === "custom" ? (
							<>
								{values.map((item, idx) => (
									<div key={item} className="input-group mb-1 shadow-none">
										<Select
											className="col-md-8 mb-1"
											unstyled
											classNames={selectClassNames}
											value={
												defaultOptions.find((o) => o.value === item) ?? {
													value: item,
													label: `#${item}`,
												}
											}
											options={options}
											components={{ Option }}
											isDisabled={disabled}
											onChange={(e) => replace(idx, e.meta.id)}
										/>

										{idx > 0 ? (
											<button
												type="button"
												aria-label="Move up"
												className="btn mb-1 ms-1"
												onClick={() => swap(idx - 1, idx)}
											>
												<IconArrowUp size={16} />
											</button>
										) : null}
										{idx < values.length - 1 ? (
											<button
												type="button"
												aria-label="Move down"
												className="btn mb-1 ms-1"
												onClick={() => swap(idx, idx + 1)}
											>
												<IconArrowDown size={16} />
											</button>
										) : null}
										{values.length > 1 && (
											<button
												type="button"
												aria-label="Remove"
												className="btn btn-ghost btn-danger p-0 mb-1"
												onClick={() => remove(idx)}
											>
												<IconX size={16} />
											</button>
										)}
									</div>
								))}
								{values.length === 0 ? (
									<>
										<input className="visually-hidden" tabIndex={-1} required defaultValue="" />
										<div className="invalid-feedback d-block">
											<T id="error.required" />
										</div>
									</>
								) : null}
								{options.length > 0 && ( // only show add button if there are more acls that can be added
									<div className="text-center">
										<button
											type="button"
											className="btn my-3"
											onClick={() => push(options[0].value)}
										>
											<T id="action.add" />
										</button>
									</div>
								)}
							</>
						) : null}
					</>
				)}
			</FieldArray>
			{authRequest !== "none" &&
				data &&
				aclIds.length > 0 &&
				(!first ||
					(first.satisfyAny &&
						(acls.length !== aclIds.length ||
							acls.some(
								(acl) =>
									acl.items?.length > 0 ||
									acl.clients?.some((client) => client.address?.toLowerCase() !== "all"),
							)))) && (
					<p className="text-warning">
						<IconAlertTriangle size={16} className="me-1" />
						<T
							id="access-list.satisfy-any-warning"
							data={{ name: first?.name ?? `#${aclIds[0]}`, visible: first ? "yes" : "no" }}
						/>
					</p>
				)}
			{data &&
				(acls.length !== aclIds.length ||
					(acls.some((acl) => acl.passAuth && acl.items?.length > 0) &&
						acls.some((acl) => !acl.passAuth && acl.items?.length > 0))) && (
					<p className="text-warning">
						<IconAlertTriangle size={16} className="me-1" />
						<T id="access-list.pass-auth-warning" />
					</p>
				)}
		</div>
	);
}
