export interface HealthResponse {
	status: string;
	setup: boolean;
	password: boolean;
	oidc: boolean;
}

export interface TokenResponse {
	expires: number;
}

export interface ValidatedCertificateResponse {
	certificate: Record<string, any>;
	certificateKey: boolean;
}

export interface VersionCheckResponse {
	current: string | null;
	latest: string | null;
	updateAvailable: boolean;
}

export interface TotpStatusResponse {
	enabled: boolean;
	backupCodesRemaining: number;
}

export interface TotpSetupResponse {
	secret: string;
	otpauthUrl: string;
}

export interface TotpEnableResponse {
	backupCodes: string[];
}
