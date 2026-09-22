import { IconArrowDown, IconArrowUp, IconLock, IconLockOpen2, IconWorld, IconX } from "@tabler/icons-react";
import { useFormikContext } from "formik";
import { useState } from "react";
import Select, { components } from "react-select";
import { useAccessLists } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";

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

export function AccessFields({ initialAccessListType, location, initialAccessListIds, name, typeFieldName, onChange }) {
	const [values, setValues] = useState(initialAccessListIds || []);
	const [aclValue, setAclValue] = useState(initialAccessListType);
	const { setFieldValue } = useFormikContext();
	const { isLoading, isError, error, data } = useAccessLists(["owner", "items", "clients"]);

	const createDefaultItem = (item) => ({
		value: item.id || 0,
		label: item.name,
		subLabel: intl.formatMessage(
			{ id: "access-list.subtitle" },
			{
				users: item?.items?.length,
				rules: item?.clients?.length,
				date: item?.createdOn ? formatDateTime(item?.createdOn) : "N/A",
			},
		),
		meta: item,
	});

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

	const defaultOptions = data?.map(createDefaultItem) || [];
	const valuesSet = new Set(values?.map((item) => item || 0) || []);
	const options = defaultOptions.filter((option) => !valuesSet.has(option.value));

	const typeOptions = () => {
		const ret = [];
		if (!isLoading && !isError && location !== undefined) {
			ret.push(createOption("global"));
		}
		ret.push(createOption("public"));
		if (!isLoading && !isError && defaultOptions.length > 0) {
			ret.push(createOption("custom"));
		}
		return ret;
	};

	const applyUpdatedValues = (newValues) => {
		setValues(newValues);
		void setFieldValue(name, newValues);
		onChange?.({ npmplusAccessListIds: newValues });
	};

	const onAccessListChange = (acl, idx) => {
		const newValues = values.map((id, i) => (i === idx ? acl.id || 0 : id));
		applyUpdatedValues(newValues);
	};

	const handleAdd = () => {
		const newAccessOption = options[0];
		if (newAccessOption?.meta.id) {
			const newValues = [...values, newAccessOption.meta.id];
			applyUpdatedValues(newValues);
		}
	};

	const handleMoveUp = (idx) => {
		if (idx > 0) {
			const newIdx = idx - 1;
			const newValues = [...values];
			const aclId = newValues[idx];
			newValues[idx] = newValues[newIdx];
			newValues[newIdx] = aclId;
			applyUpdatedValues(newValues);
		}
	};

	const handleMoveDown = (idx) => {
		if (idx < values.length - 1) {
			const newIdx = idx + 1;
			const newValues = [...values];
			const aclId = newValues[idx];
			newValues[idx] = newValues[newIdx];
			newValues[newIdx] = aclId;
			applyUpdatedValues(newValues);
		}
	};

	const handleRemove = (aclId) => {
		const newValues = values.filter((id) => id !== aclId);
		applyUpdatedValues(newValues);
	};

	return (
		<div className="mb-3">
			{isLoading ? <div className="placeholder placeholder-lg col-12 my-3 placeholder-glow" /> : null}
			{isError ? <div className="invalid-feedback">{`${error}`}</div> : null}
			<div className="row">
				<div className="col-md-10">
					<div className="input-group mb-3 shadow-none">
						<Select
							className="react-select-container col-md-8"
							classNamePrefix="react-select"
							isSearchable={false}
							defaultValue={createOption(initialAccessListType)}
							options={typeOptions()}
							components={{ Option: TypeOption }}
							styles={{
								option: (base) => ({
									...base,
									height: "100%",
								}),
							}}
							onChange={(e) => {
								if (!e || Array.isArray(e)) return;
								const value = e.type;
								setAclValue(value);
								void setFieldValue(typeFieldName, value);
								onChange?.({ npmplusAccessListType: value });
							}}
						/>
					</div>
				</div>
			</div>
			{!isLoading && !isError && aclValue === "custom" ? (
				<>
					{values.map((item, idx) => (
						<div key={item ?? idx} className="input-group mb-1 shadow-none">
							<Select
								className="react-select-container col-md-8 mb-1"
								classNamePrefix="react-select"
								value={defaultOptions.find((o) => o.value === item) ?? null}
								options={options}
								components={{ Option }}
								styles={{
									option: (base) => ({
										...base,
										height: "100%",
									}),
								}}
								onChange={(e) => {
									if (!e || Array.isArray(e)) return;
									onAccessListChange(e.meta, idx);
								}}
								isDisabled={aclValue !== "custom"}
							/>

							{idx > 0 ? (
								<button
									type="button"
									aria-label="Move up"
									className="btn mb-1 ms-1"
									onClick={() => {
										handleMoveUp(idx);
									}}
								>
									<IconArrowUp size={16} />
								</button>
							) : null}
							{idx < values.length - 1 ? (
								<button
									type="button"
									aria-label="Move down"
									className="btn mb-1 ms-1"
									onClick={() => {
										handleMoveDown(idx);
									}}
								>
									<IconArrowDown size={16} />
								</button>
							) : null}
							<button
								type="button"
								aria-label="Remove"
								className="btn btn-ghost btn-danger p-0 mb-1"
								onClick={() => {
									handleRemove(item);
								}}
							>
								<IconX size={16} />
							</button>
						</div>
					))}
					{values.length < defaultOptions.length && ( // only show add button if there are more acls that can be added
						<div className="text-center">
							<button type="button" className="btn my-3" onClick={handleAdd}>
								<T id="action.add" />
							</button>
						</div>
					)}
				</>
			) : null}
		</div>
	);
}
