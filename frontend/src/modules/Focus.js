export const dropdownToggle = (element) => element?.querySelector('[data-bs-toggle="dropdown"]');

export const focusRowMenu = (rows) => rows.map(dropdownToggle).find(Boolean)?.focus();
