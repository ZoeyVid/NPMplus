import { Tab } from "@tabler/core";

export const dropdownToggle = (element) => element?.querySelector('[data-bs-toggle="dropdown"]');

export const focusMenuToggle = (element) => dropdownToggle(element?.closest(".dropdown"))?.focus();

export const focusRowMenu = (rows) => rows.map(dropdownToggle).find(Boolean)?.focus();

export const initTabs = (list) => {
	if (list) Tab.getOrCreateInstance(list.querySelector(".active"));
};
