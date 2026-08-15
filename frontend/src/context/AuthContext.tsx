import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useIntervalWhen } from "rooks";
import { deleteToken, getToken, refreshToken, revokeSessions, type TokenResponse, verifyTotp } from "src/api/backend";
import AuthStore from "src/modules/AuthStore";

// Context
interface AuthContextType {
	authenticated: boolean;
	totpChallenge: boolean;
	login: (username: string, password: string) => Promise<void>;
	submitTotp: (code: string) => Promise<void>;
	cancelTotp: () => void;
	logout: () => void;
	logoutEverywhere: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const getCookie = (name: string): string | undefined => {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop()?.split(";").shift();
	return undefined;
};

// Provider
interface Props {
	children?: ReactNode;
	tokenRefreshInterval?: number;
}
function AuthProvider({ children, tokenRefreshInterval = 5 * 60 * 1000 }: Props) {
	const queryClient = useQueryClient();
	const [authenticated, setAuthenticated] = useState(AuthStore.hasActiveToken());
	const [totpChallenge, setTotpChallenge] = useState<boolean>(
		() => getCookie("__Host-npmplus_oidc_totp_required") === "true",
	);

	const handleTokenUpdate = (response: TokenResponse) => {
		AuthStore.set(response);
		setAuthenticated(true);
		setTotpChallenge(false);
	};

	const login = async (identity: string, secret: string) => {
		const response = await getToken(identity, secret);
		if (response.requiresTotp) {
			setTotpChallenge(true);
			return;
		}
		handleTokenUpdate(response);
	};

	const submitTotp = async (code: string) => {
		if (!totpChallenge) {
			throw new Error("No TOTP challenge pending");
		}
		const response = await verifyTotp(code);
		handleTokenUpdate(response);
	};

	const cancelTotp = () => {
		setTotpChallenge(false);
	};

	const logout = async () => {
		await deleteToken();
		AuthStore.clear();
		setAuthenticated(false);
		queryClient.clear();
	};

	const logoutEverywhere = async () => {
		await revokeSessions("me");
		AuthStore.clear();
		setAuthenticated(false);
		queryClient.clear();
	};

	const refresh = async (reload = true) => {
		const response = await refreshToken(reload);
		handleTokenUpdate(response);
	};

	useEffect(() => {
		if (!authenticated) {
			if (totpChallenge) {
				window.cookieStore.delete("__Host-npmplus_oidc_totp_required");
				return;
			}
			refresh(false).catch(() => {});
		}
	});

	useIntervalWhen(
		() => {
			if (authenticated) {
				refresh().catch(() => {});
			}
		},
		tokenRefreshInterval,
		true,
	);

	const value = {
		authenticated,
		totpChallenge,
		login,
		submitTotp,
		cancelTotp,
		logout,
		logoutEverywhere,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthState() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuthState must be used within a AuthProvider");
	}
	return context;
}

export { AuthProvider, useAuthState };
