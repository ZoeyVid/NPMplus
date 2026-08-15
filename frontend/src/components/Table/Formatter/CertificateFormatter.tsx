import type { Certificate } from "src/api/backend";
import { T } from "src/locale";

const providerTranslations: Record<string, string> = {
	letsencrypt: "lets-encrypt",
	other: "certificates.custom",
	mtls: "mtls-certificate",
};

export function certificateProviderTranslation(provider: string) {
	return providerTranslations[provider] ?? provider;
}

interface Props {
	certificate?: Certificate;
}
export function CertificateFormatter({ certificate }: Props) {
	return <T id={certificate ? certificateProviderTranslation(certificate.provider) : "no-tls"} />;
}
