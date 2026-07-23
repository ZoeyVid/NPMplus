import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useIntervalWhen } from "rooks";
import {
	deleteToken,
	getToken,
	isTwoFactorChallenge,
	refreshToken,
	revokeSessions,
	type TokenResponse,
	verify2FA,
} from "src/api/backend";
import AuthStore from "src/modules/AuthStore";

// 2FA challenge state
export interface TwoFactorChallenge {
	challengeToken: string;
}

// Context
export interface AuthContextType {
	authenticated: boolean;
	twoFactorChallenge: TwoFactorChallenge | null;
	login: (username: string, password: string) => Promise<void>;
	verifyTwoFactor: (code: string) => Promise<void>;
	cancelTwoFactor: () => void;
	logout: () => void;
	logoutEverywhere: () => void;
}

const initalValue = null;
const AuthContext = createContext<AuthContextType | null>(initalValue);

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
	const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallenge | null>(() => {
		const challenge = getCookie("__Host-npmplus_oidc_2fa_challenge");
		return challenge ? { challengeToken: challenge } : null;
	});

	const handleTokenUpdate = (response: TokenResponse) => {
		AuthStore.set(response);
		setAuthenticated(true);
		setTwoFactorChallenge(null);
	};

	const login = async (identity: string, secret: string) => {
		const response = await getToken(identity, secret);
		if (isTwoFactorChallenge(response)) {
			setTwoFactorChallenge({ challengeToken: response.challengeToken });
			return;
		}
		handleTokenUpdate(response);
	};

	const verifyTwoFactor = async (code: string) => {
		if (!twoFactorChallenge) {
			throw new Error("No 2FA challenge pending");
		}
		const response = await verify2FA(twoFactorChallenge.challengeToken, code);
		handleTokenUpdate(response);
	};

	const cancelTwoFactor = () => {
		setTwoFactorChallenge(null);
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
			if (twoFactorChallenge) {
				window.cookieStore.delete("__Host-npmplus_oidc_2fa_challenge");
				return;
			}
			refresh(false).catch(() => {});
		}
	});

	useIntervalWhen(
		() => {
			if (authenticated) {
				refresh();
			}
		},
		tokenRefreshInterval,
		true,
	);

	const value = {
		authenticated,
		twoFactorChallenge,
		login,
		verifyTwoFactor,
		cancelTwoFactor,
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
export default AuthContext;
