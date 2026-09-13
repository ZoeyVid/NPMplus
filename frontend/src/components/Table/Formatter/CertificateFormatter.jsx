import { T } from "src/locale";

const providerTranslations = {
	letsencrypt: "lets-encrypt",
	other: "certificates.custom",
	mtls: "mtls-certificate",
};

export function certificateProviderTranslation(provider) {
	return providerTranslations[provider] ?? provider;
}

export function CertificateFormatter({ certificate }) {
	return <T id={certificate ? certificateProviderTranslation(certificate.provider) : "no-tls"} />;
}
