import * as api from "./base";
import type { User } from "./models";

interface AuthOptions {
	type: string;
	secret: string;
}

interface NewUser {
	name: string;
	nickname: string;
	email: string;
	isDisabled?: boolean;
	auth?: AuthOptions;
	roles?: string[];
}

export async function createUser(item: NewUser): Promise<User> {
	return await api.post({
		url: "/users",
		data: item,
	});
}
