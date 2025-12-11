## 2025-12-10 - Command Injection in Startup Script
**Schwachstelle:** Command Injection in `backend/validate-env.cjs` via `ACME_SERVER` environment variable being interpolated into `execSync('curl ...')`.
**Erkenntnis:** Der Startup-Script nutzte `execSync` mit String-Interpolation statt `execFileSync` mit Argumenten-Array. Dies erlaubte das Einschleusen von Shell-Befehlen durch Manipulation der Umgebungsvariable.
**Prävention:** Nutzung von `execFileSync` (Node.js) für externe Befehle, um Shell-Interpretation zu verhindern.

## 2025-10-26 - Missing Rate Limiting on Authentication Endpoint
**Vulnerability:** The `/tokens` (login) endpoint lacked rate limiting, allowing brute force attacks.
**Learning:** Even with secure password hashing (bcrypt), unlimited attempts can eventually succeed or cause DoS. Express endpoints need explicit rate limiting.
**Prevention:** Implemented an in-memory rate limiter (Token Bucket / Counter) on the authentication route to block IPs after repeated failures.
