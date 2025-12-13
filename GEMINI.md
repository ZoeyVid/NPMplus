# NPMplus

## Project Overview
NPMplus is an advanced fork of Nginx Proxy Manager (NPM). It provides a user-friendly web interface for managing Nginx reverse proxies, with a focus on security, performance, and ease of use. It includes features like HTTP/3 (QUIC) support, CrowdSec integration, ModSecurity (WAF), and improved TLS certificate management (including OCSP Stapling).

**Key Technologies:**
*   **Backend:** Node.js, Express, Knex.js, Objection.js, SQLite (default), Better-SQLite3.
*   **Frontend:** React (v19), Vite (v7), TypeScript, Tabler UI, React Query.
*   **Infrastructure:** Docker, Nginx (with QUIC support), Certbot, CrowdSec.
*   **Language:** JavaScript/TypeScript.

## Building and Running

The project is designed to be run using Docker Compose.

### Prerequisites
*   Docker
*   Docker Compose

### Quick Start
To start the application in production mode:
```bash
docker compose up -d
```

### Development
The project uses a multi-stage `Dockerfile`.
*   **Frontend:** Built in the `frontend` stage using `yarn vite build`.
*   **Backend:** Dependencies installed in the `backend` stage.
*   **Final Image:** Combines frontend assets, backend code, and Nginx configuration into an Alpine-based image (`zoeyvid/nginx-quic`).

**Key Scripts (Backend):**
*   `test`: `vitest` - Runs unit tests.

**Key Scripts (Frontend):**
*   `build`: `yarn tsc && yarn vite build` - Builds the frontend application.
*   `test`: `vitest` - Runs unit tests.

## Development Conventions

*   **Code Style:** The project uses `biome` for linting and formatting in both frontend and backend.
*   **Testing:** `vitest` is used for testing in both frontend and backend.
*   **Database:** SQLite is the recommended database. Migration files are located in `backend/migrations`.
*   **Architecture:**
    *   `backend/`: Contains the Node.js API server, database models, and Nginx configuration logic.
    *   `frontend/`: Contains the React-based user interface.
    *   `rootfs/`: Contains filesystem overlays for the Docker image (e.g., Nginx configs, scripts).
    *   `caddy/`: Separate directory for Caddy-related configuration (alternative to NPMplus web GUI).
*   **Contribution:** New features should ideally include tests. Changes to the Nginx configuration generation logic should be carefully tested.

## Key Directories
*   `backend/internal`: Core logic for Nginx configuration, certificates, and host management.
*   `backend/models`: Database models (Objection.js).
*   `backend/routes`: Express API routes.
*   `backend/templates`: Templates used for generating Nginx configuration files.
*   `frontend/src`: Source code for the React application.
