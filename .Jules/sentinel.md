## 2025-12-10 - Command Injection in Startup Script
**Schwachstelle:** Command Injection in `backend/validate-env.cjs` via `ACME_SERVER` environment variable being interpolated into `execSync('curl ...')`.
**Erkenntnis:** Der Startup-Script nutzte `execSync` mit String-Interpolation statt `execFileSync` mit Argumenten-Array. Dies erlaubte das Einschleusen von Shell-Befehlen durch Manipulation der Umgebungsvariable.
**Prävention:** Nutzung von `execFileSync` (Node.js) für externe Befehle, um Shell-Interpretation zu verhindern.
