# ATOMIX

ATOMIX is an interactive science platform built on the existing Three.js experience. It includes the original home page, a 118 element periodic table, molecular models, a quantum lab, courses, science articles, a glossary, and personal accounts with saved progress.

## Open the full project with Go Live

The repository is configured so VS Code can prepare the project for Live Server:

1. Open this repository folder in VS Code and install the **Live Server** extension if it is not already installed.
2. Use Node.js **22.13 or newer**. Dependencies are already installed in the project; if `node_modules` is missing, run `npm install` once.
3. Allow this workspace’s automatic tasks if VS Code asks. If this folder was already open before the setup was added, run **Developer: Reload Window** once so the tasks start. **Run ATOMIX API** starts the local API, and **Build app for Live Server** creates `dist/` and keeps it updated.
4. Wait for the tasks to start, open the root `index.html`, then click **Go Live**. Live Server opens the built `dist/index.html` entry point and serves the styles, scripts, and direct-link pages from `dist/`.

The local API listens on port `3000`; Live Server normally uses port `5500`. The SQLite database is created at `data/atomix.sqlite` the first time the API starts. If an ATOMIX API is already running, `npm run dev` reuses it instead of trying to start a second server.

## Other development commands

```bash
npm run dev       # API plus Vite development server
npm run build     # production frontend in dist/
npm test          # API and data tests
```

The Go Live workflow does not need a terminal after the workspace tasks are running. Use `npm run dev` when you prefer Vite’s development server and hot reload.

## Accounts and email

Authentication is handled by the local Node API. Passwords are hashed with scrypt; sessions use HttpOnly cookies and CSRF protection. The local database stays in `data/` and is excluded from Git.

Copy `.env.example` to `.env` to configure the API. For production, set `NODE_ENV=production`, a `SESSION_SECRET` with at least 32 random characters, `FRONTEND_ORIGIN`, and a persistent `DATABASE_PATH`. SMTP settings are optional in development; without SMTP, password reset shows a local development link. Configure SMTP to deliver reset emails.

## C++ and WebAssembly

The C++ core lives in `cpp/`. The browser uses compiled WebAssembly when `wasm/atomix-core.js` and `wasm/atomix-core.wasm` are present, and uses the JavaScript implementation otherwise. To build the WebAssembly artifacts, install and activate the Emscripten SDK and CMake, then run `npm run build:wasm` followed by `npm run build`.
