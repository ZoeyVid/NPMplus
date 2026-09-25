import cn from "clsx";

export const selectClassNames = {
	control: ({ isFocused, isDisabled }) =>
		cn("form-control", isFocused && "border-primary", isDisabled && "bg-surface-tertiary text-secondary"),
	valueContainer: ({ isMulti, hasValue }) => cn("gap-1", isMulti && hasValue && "my-n1"),
	placeholder: () => "text-secondary",
	indicatorsContainer: () => "gap-1",
	dropdownIndicator: () => "text-secondary",
	menu: () => "dropdown-menu show mt-1",
	option: ({ isFocused, isSelected }) =>
		cn("dropdown-item", "text-wrap", isSelected && "active", isFocused && "bg-primary bg-opacity-10"),
	noOptionsMessage: () => "text-secondary p-2",
	loadingMessage: () => "text-secondary p-2",
	multiValue: ({ isFocused }) => cn("tag gap-1 fs-5", isFocused && "border-primary"),
	multiValueRemove: () => "cursor-pointer link-secondary",
};
