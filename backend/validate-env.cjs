const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Utility to read env vars with defaults
const getEnv = (key, defaultVal) => process.env[key] || defaultVal;
const getEnvBool = (key, defaultVal) => {
    const val = process.env[key];
    if (val === undefined) return defaultVal;
    return val === 'true';
};

// Check if a string is a valid IPv4
const isIPv4 = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);

// Check if a string is a valid IPv6
const isIPv6 = (ip) => /^\[[0-9a-f:]+\]$/.test(ip);

// Check if a string is a valid integer
const isInt = (val) => /^\d+$/.test(val);

// Log and Exit
const fatal = (msg) => {
    console.error(`ERROR: ${msg}`);
    process.exit(1);
};

// Log Info (to stderr so it doesn't break eval)
const info = (msg) => {
    console.error(msg);
}

// Check if boolean string
const checkBool = (key) => {
    const val = process.env[key];
    if (val && val !== 'true' && val !== 'false') {
        fatal(`${key} needs to be true or false.`);
    }
};

// Check if integer
const checkInt = (key) => {
    const val = process.env[key];
    if (val && !isInt(val)) {
        fatal(`${key} needs to be a number.`);
    }
};

const checkIP = (key, type) => {
    const val = process.env[key];
    if (!val) return;
    if (type === 'v4' && !isIPv4(val)) fatal(`${key} needs to be a IPv4-Address.`);
    if (type === 'v6' && !isIPv6(val)) fatal(`${key} needs to be a IPv6-Address inside [].`);
};

// Exports map
const exportsMap = {};
const setExport = (key, val) => {
    exportsMap[key] = val;
};

// Ensure default is set if missing
const ensureDefault = (key, defaultVal) => {
    if (!process.env[key]) {
        setExport(key, defaultVal);
    }
};

// --- Logic from envs.sh ---

// Deprecated Env Checks
const deprecated = [
    { key: 'NPM_DISABLE_IPV6', msg: 'NPM_DISABLE_IPV6 env is not supported. DISABLE_IPV6 now also disables IPv6 for the NPMplus web UI.' },
    { key: 'GOA_DISABLE_IPV6', msg: 'GOA_DISABLE_IPV6 env is not supported. DISABLE_IPV6 now also disables IPv6 for goaccess.' },
    { key: 'NIBEP', msg: 'NIBEP env is not supported. NPMplus now uses a unix socket instead.' },
    { key: 'GOAIWSP', msg: 'GOAIWSP env is not supported. NPMplus now uses a unix socket instead.' },
    { key: 'NGINX_HSTS_SUBDMAINS', msg: 'NGINX_HSTS_SUBDMAINS env is replaced by NGINX_HSTS_SUBDOMAINS, please change it to NGINX_HSTS_SUBDOMAINS' },
    { key: 'LE_SERVER', msg: 'LE_SERVER env is replaced by ACME_SERVER, please change it to ACME_SERVER' },
    { key: 'LE_STAGING', msg: 'LE_STAGING env is not supported, please use ACME_SERVER.' },
    { key: 'DEBUG', msg: 'DEBUG env is not supported.' },
    { key: 'SKIP_CERTBOT_OWNERSHIP', msg: 'SKIP_CERTBOT_OWNERSHIP env is not supported.' },
    { key: 'IP_RANGES_FETCH_ENABLED', msg: 'IP_RANGES_FETCH_ENABLED env is not supported, please use SKIP_IP_RANGES.' },
    { key: 'DB_SQLITE_FILE', msg: 'DB_SQLITE_FILE env is not supported, the database needs to be in /data/npmplus/database.sqlite.' },
];

deprecated.forEach(item => {
    if (process.env[item.key]) fatal(item.msg);
});

// Timezone
if (!process.env.TZ || !fs.existsSync(`/usr/share/zoneinfo/${process.env.TZ}`)) {
    fatal('TZ is unset or invalid.');
}

// ACME Checks
ensureDefault('ACME_SERVER', 'https://acme-v02.api.letsencrypt.org/directory');
const acmeServer = getEnv('ACME_SERVER', 'https://acme-v02.api.letsencrypt.org/directory');

if (!/^https?:\/\//.test(acmeServer)) fatal('ACME_SERVER needs to start with http:// or https://');

const acmeEmail = process.env.ACME_EMAIL;
if (acmeEmail && !acmeEmail.includes('@')) fatal('ACME_EMAIL needs to contains @.');

if ((process.env.ACME_EAB_KID || process.env.ACME_EAB_HMAC_KEY) &&
    (!process.env.ACME_EAB_KID || !process.env.ACME_EAB_HMAC_KEY || !acmeEmail)) {
    fatal('You need to set ACME_EAB_KID, ACME_EAB_HMAC_KEY AND ACME_EMAIL (all are needed) or none of them or ONLY ACME_EMAIL.');
}

ensureDefault('ACME_MUST_STAPLE', 'false');
checkBool('ACME_MUST_STAPLE');

ensureDefault('ACME_OCSP_STAPLING', 'false');
checkBool('ACME_OCSP_STAPLING');

ensureDefault('ACME_PROFILE', 'none');
ensureDefault('ACME_KEY_TYPE', 'ecdsa');
ensureDefault('ACME_SERVER_TLS_VERIFY', 'true');
ensureDefault('CUSTOM_OCSP_STAPLING', 'false');

checkBool('ACME_SERVER_TLS_VERIFY');
checkBool('CUSTOM_OCSP_STAPLING');

if (process.env.ACME_KEY_TYPE && !['ecdsa', 'rsa'].includes(process.env.ACME_KEY_TYPE)) {
    fatal('ACME_KEY_TYPE needs to be ecdsa or rsa.');
}

// ACME Profile Check
const acmeProfile = getEnv('ACME_PROFILE', 'none');
if (acmeProfile !== 'none') {
    try {
        const res = execFileSync('curl', ['-sSL', acmeServer], { encoding: 'utf8' });
        const json = JSON.parse(res);
        if (!json.meta || !json.meta.profiles || !json.meta.profiles[acmeProfile]) {
            fatal('The ACME_PROFILE seems to be not supported by the ACME_SERVER.');
        }
    } catch (e) {
        // Ignore curl errors
    }
}

// IDs
ensureDefault('PUID', '0');
ensureDefault('PGID', '0');

checkInt('PUID');
checkInt('PGID');
const puid = parseInt(getEnv('PUID', '0'));
const pgid = parseInt(getEnv('PGID', '0'));

if (pgid !== 0 && puid === 0) fatal("You've set PGID but not PUID. Which is required.");
if (pgid === 0 && puid !== 0) info("You've set PUID but not PGID. Are you sure that this is what you wanted?");

// Ports
ensureDefault('NPM_PORT', '81');
ensureDefault('GOA_PORT', '91');
ensureDefault('HTTP_PORT', '80');
ensureDefault('HTTPS_PORT', '443');
ensureDefault('HTTP3_ALT_SVC_PORT', '443');

checkInt('NPM_PORT');
checkInt('GOA_PORT');
checkInt('HTTP_PORT');
checkInt('HTTPS_PORT');
checkInt('HTTP3_ALT_SVC_PORT');

const httpPort = getEnv('HTTP_PORT', '80');
const httpsPort = getEnv('HTTPS_PORT', '443');
const disableHttp = getEnv('DISABLE_HTTP', 'false');

if (httpPort === httpsPort && disableHttp === 'false') {
    fatal('HTTP_PORT and HTTPS_PORT need to be different.');
}

// IP Bindings
ensureDefault('IPV4_BINDING', '0.0.0.0');
ensureDefault('NPM_IPV4_BINDING', '0.0.0.0');
ensureDefault('GOA_IPV4_BINDING', '0.0.0.0');
ensureDefault('IPV6_BINDING', '[::]');
ensureDefault('NPM_IPV6_BINDING', '[::]');
ensureDefault('GOA_IPV6_BINDING', '[::]');

checkIP('IPV4_BINDING', 'v4');
checkIP('NPM_IPV4_BINDING', 'v4');
checkIP('GOA_IPV4_BINDING', 'v4');
checkIP('IPV6_BINDING', 'v6');
checkIP('NPM_IPV6_BINDING', 'v6');
checkIP('GOA_IPV6_BINDING', 'v6');

// Booleans defaults
const boolDefaults = {
    'DISABLE_IPV6': 'false',
    'NPM_LISTEN_LOCALHOST': 'false',
    'GOA_LISTEN_LOCALHOST': 'false',
    'DISABLE_HTTP': 'false',
    'LISTEN_PROXY_PROTOCOL': 'false',
    'DISABLE_H3_QUIC': 'false',
    'NGINX_QUIC_BPF': 'false',
    'NGINX_LOG_NOT_FOUND': 'false',
    'NGINX_404_REDIRECT': 'false',
    'NGINX_HSTS_SUBDOMAINS': 'true',
    'NGINX_DISABLE_PROXY_BUFFERING': 'false',
    'DISABLE_NGINX_BEAUTIFIER': 'false',
    'FULLCLEAN': 'false',
    'SKIP_IP_RANGES': 'true',
    'LOGROTATE': 'false',
    'GOA': 'false',
    'PHP82': 'false',
    'PHP83': 'false',
    'PHP84': 'false',
    'NGINX_LOAD_OPENAPPSEC_ATTACHMENT_MODULE': 'false',
    'NGINX_LOAD_OPENTELEMETRY_MODULE': 'false',
    'NGINX_LOAD_GEOIP2_MODULE': 'false',
    'NGINX_LOAD_NJS_MODULE': 'false',
    'NGINX_LOAD_NTLM_MODULE': 'false',
    'NGINX_LOAD_VHOST_TRAFFIC_STATUS_MODULE': 'false',
    // NC_AIO is optional, no default
};

Object.keys(boolDefaults).forEach(key => {
    ensureDefault(key, boolDefaults[key]);
    checkBool(key);
});

if (process.env.NC_AIO) checkBool('NC_AIO');


// Special Logic for Localhost
if (getEnvBool('NPM_LISTEN_LOCALHOST', false)) {
    info("Setting NPM binding to localhost");
    // We print export commands for shell to eval
}

// X-Frame-Options
ensureDefault('X_FRAME_OPTIONS', 'sameorigin');
const xFrame = getEnv('X_FRAME_OPTIONS', 'sameorigin');
if (!['none', 'sameorigin', 'deny'].includes(xFrame)) fatal('X_FRAME_OPTIONS needs to be none, sameorigin or deny.');

// Workers
ensureDefault('NGINX_WORKER_PROCESSES', 'auto');
ensureDefault('NGINX_WORKER_CONNECTIONS', '512');

const workerProcesses = getEnv('NGINX_WORKER_PROCESSES', 'auto');
if (workerProcesses !== 'auto' && !isInt(workerProcesses)) fatal('NGINX_WORKER_PROCESSES needs to be auto or a number.');
checkInt('NGINX_WORKER_CONNECTIONS');

ensureDefault('LOGROTATIONS', '3');
ensureDefault('CRT', '23');
ensureDefault('IPRT', '1');
ensureDefault('DEFAULT_CERT_ID', '0');

checkInt('LOGROTATIONS');
checkInt('CRT');
checkInt('IPRT');
checkInt('DEFAULT_CERT_ID');

ensureDefault('GOACLA', "--agent-list --real-os --double-decode --anonymize-ip --anonymize-level=1 --keep-last=30 --with-output-resolver --no-query-string");
ensureDefault('INITIAL_DEFAULT_PAGE', 'congratulations');

// PHP APKs
const checkApk = (key) => {
    const val = process.env[key];
    if (val && !/^[a-z0-9 _-]+$/.test(val)) fatal(`${key} can consist of lower letters a-z, numbers 0-9, spaces, underscores and hyphens.`);
};
checkApk('PHP82_APKS');
checkApk('PHP83_APKS');
checkApk('PHP84_APKS');

// Initial Admin
const initEmail = process.env.INITIAL_ADMIN_EMAIL;
if (initEmail && !/@.*\./.test(initEmail)) fatal('INITIAL_ADMIN_EMAIL needs to contains a @ and one dot.');

const initPage = process.env.INITIAL_DEFAULT_PAGE;
if (initPage && !['404', '444', 'redirect', 'congratulations', 'html'].includes(initPage)) {
    fatal('INITIAL_DEFAULT_PAGE needs to be 404, 444, redirect, congratulations or html.');
}

// GOACLA
const goacla = process.env.GOACLA;
if (goacla && !/^-[a-zA-Z0-9 =/_.-]+$/.test(goacla)) {
    fatal('GOACLA must start with a hyphen and can consist of lower and upper letters a-z A-Z, numbers 0-9, spaces, equals signs, slashes, underscores, dots and hyphens.');
}

// NC_AIO
if (getEnvBool('NC_AIO', false)) {
    const ncDomain = process.env.NC_DOMAIN;
    if (!ncDomain || !ncDomain.includes('.')) {
        fatal('NC_DOMAIN is unset (but required in AIO mode) or invalid, it needs to contain a dot.');
    }
}

// Logic that modifies envs needs to be outputted to be eval'd by shell

if (getEnvBool('NPM_LISTEN_LOCALHOST', false)) {
    setExport('NPM_IPV4_BINDING', '127.0.0.1');
    setExport('NPM_IPV6_BINDING', '[::1]');
}
if (getEnvBool('GOA_LISTEN_LOCALHOST', false)) {
    setExport('GOA_IPV4_BINDING', '127.0.0.1');
    setExport('GOA_IPV6_BINDING', '[::1]');
}

// PHP Logic
if (process.env.PHP82_APKS && getEnv('PHP82', 'false') === 'false') setExport('PHP82', 'true');
if (process.env.PHP83_APKS && getEnv('PHP83', 'false') === 'false') setExport('PHP83', 'true');
if (process.env.PHP84_APKS && getEnv('PHP84', 'false') === 'false') setExport('PHP84', 'true');

// Note: Logic for checking PHP_APKS is tricky because we need to know if the others are effectively disabled.
// We use the "future" values from exportsMap if present, otherwise current env.
const isPhp82 = exportsMap.PHP82 === 'true' || (exportsMap.PHP82 === undefined && getEnv('PHP82', 'false') === 'true');
const isPhp83 = exportsMap.PHP83 === 'true' || (exportsMap.PHP83 === undefined && getEnv('PHP83', 'false') === 'true');
const isPhp84 = exportsMap.PHP84 === 'true' || (exportsMap.PHP84 === undefined && getEnv('PHP84', 'false') === 'true');

if (process.env.PHP_APKS && !isPhp82 && !isPhp83 && !isPhp84) {
    fatal('PHP_APKS is set, but PHP82, PHP83 and PHP84 is disabled.');
}

// ACME Stapling logic
if (getEnvBool('ACME_MUST_STAPLE', false) && getEnv('ACME_OCSP_STAPLING', 'false') === 'false') {
    setExport('ACME_OCSP_STAPLING', 'true');
    info('setting ACME_OCSP_STAPLING to true, since ACME_MUST_STAPLE is set to true.');
}

// Proxy Protocol logic
if (getEnvBool('LISTEN_PROXY_PROTOCOL', false) && getEnv('DISABLE_H3_QUIC', 'false') === 'false') {
    setExport('DISABLE_H3_QUIC', 'true');
    info('setting DISABLE_H3_QUIC to true, since LISTEN_PROXY_PROTOCOL is set to true.');
}

// GOA logic
if (getEnvBool('GOA', false) && getEnv('LOGROTATE', 'false') === 'false') {
    setExport('LOGROTATE', 'true');
    info('setting LOGROTATE to true, since GOA is set to true.');
}

// NC_AIO logic
if (getEnvBool('NC_AIO', false)) {
    if (!process.env.DISABLE_HTTP) setExport('DISABLE_HTTP', 'true');
}


// GeoIP check (filesystem check)
let currentGoacla = process.env.GOACLA || "--agent-list --real-os --double-decode --anonymize-ip --anonymize-level=1 --keep-last=30 --with-output-resolver --no-query-string";
if (currentGoacla.includes('geoip-database') === false) {
    // Check files
    const checkFile = (p) => fs.existsSync(p) && fs.statSync(p).size > 0;

    if (checkFile('/data/etc/goaccess/geoip/GeoLite2-City.mmdb') ||
        checkFile('/data/etc/goaccess/geoip/GeoLite2-Country.mmdb') ||
        checkFile('/data/etc/goaccess/geoip/GeoLite2-ASN.mmdb')) {
        fatal("All goaccess geoip databases need to be moved from etc/goaccess/geoip to goaccess/geoip inside the mounted data folder!");
    }

    if (checkFile('/data/goaccess/geoip/GeoLite2-City.mmdb')) {
        currentGoacla += " --geoip-database=/data/goaccess/geoip/GeoLite2-City.mmdb";
    }
    if (checkFile('/data/goaccess/geoip/GeoLite2-Country.mmdb')) {
        currentGoacla += " --geoip-database=/data/goaccess/geoip/GeoLite2-Country.mmdb";
    }
    if (checkFile('/data/goaccess/geoip/GeoLite2-ASN.mmdb')) {
        currentGoacla += " --geoip-database=/data/goaccess/geoip/GeoLite2-ASN.mmdb";
    }

    // Only export if changed and not already exported by ensureDefault
    // Actually, ensureDefault might have set it. We should update exportsMap if different.
    if (currentGoacla !== getEnv('GOACLA')) {
         setExport('GOACLA', currentGoacla);
    }
}

// Output exports for shell
Object.keys(exportsMap).forEach(key => {
    // Escape single quotes in values for single-quoted string context
    const safeVal = exportsMap[key].replace(/'/g, "'\\''");
    console.log(`export ${key}='${safeVal}'`);
});
