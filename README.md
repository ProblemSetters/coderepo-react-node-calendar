# Calendar

<Center Aligned>
A HackerRank sample repo 

<Image>


**Built With**

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 | Product views, forms, dialogs, workspace state, and user interactions. |
| Frontend build | Vite 8 | Development server, API proxy, hot reload, and production bundling. |
| Runtime and packages | Bun | Root workspace installation, scripts, frontend development, and backend execution. |
| Backend | Express 5 | Versioned HTTP API, middleware, routing, and server lifecycle. |
| Database | MongoDB with Mongoose | Application documents, queries, indexes, and persistence. |
| Validation | Zod | API request parsing and validation. |
| Authentication | JSON Web Tokens and bcrypt | Workspace login, profile context, protected routes, and password verification. |
| Styling and assets | CSS and local Roboto font files | Responsive product styling without an external component library or CDN. |


**Getting Started**



## Project structure

```text
.
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            Workspace login, session, profile switch, and logout
│   │   │   ├── availability/    Conflict detection and suggested meeting times
│   │   │   ├── calendars/       Calendar CRUD, visibility, colors, and display-only behavior
│   │   │   ├── events/          Event CRUD, search, recurrence, and invitation responses
│   │   │   ├── insights/        Daily scheduled-time aggregation
│   │   │   └── people/          Profile listing and coworker search
│   │   ├── scripts/             Deterministic MongoDB seed entrypoint and data
│   │   ├── shared/              Configuration, authentication, errors, and utilities
│   │   ├── app.js               Express application and API composition
│   │   └── index.js             Backend server lifecycle
│   ├── .env.example             Backend environment contract
│   └── package.json             Backend scripts and pinned dependencies
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            Workspace sign-in
│   │   │   ├── calendar/        Calendar shell, navigation, views, and management
│   │   │   ├── events/          Editing, preview, recurrence, search, and responses
│   │   │   ├── insights/        Daily time summary and detailed drawer
│   │   │   ├── people/          People picker, availability comparison, and suggestions
│   │   │   └── profiles/        Workspace profile selection and avatars
│   │   ├── shared/              API client, reusable controls, and shared utilities
│   │   ├── App.jsx              Product orchestration and feature state
│   │   ├── main.jsx             React entrypoint
│   │   └── styles.css           Responsive application styling
│   ├── public/                  Local static assets
│   ├── .env.example             Frontend environment contract
│   ├── package.json             Frontend scripts and pinned dependencies
│   └── vite.config.js           Port, proxy, and build configuration
├── docs/
│   └── HackerRank-Code-Repo-Guidelines.md  Product and acceptance requirements
├── skills/code-repo-validate/
│   ├── SKILL.md                           Validation workflow
│   ├── SKILL-MANUAL.md                    Adoption and usage guide
│   └── references/                        Static, runtime, and report instructions
├── .vscode/launch.json          Backend debugger configuration
├── .gitattributes               HackerRank archive exclusions
├── hackerrank.yml               HackerRank install, run, protection, and IDE configuration
├── setup.sh                     Environment creation, MongoDB readiness, and seed reset
├── package.json                 Root Bun workspace and application commands
└── bun.lock                     Pinned JavaScript dependency graph
```

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running, please follow these simple steps.

### Prerequisites

Here’s what you need to run Cal.diy.

- Node.js (Version: >=18.x)
- PostgreSQL (Version: >=13.x)
- Yarn _(recommended)_

> If you want to enable any of the available integrations, you may want to obtain additional credentials for each one. More details on this can be found below under the [integrations section](#integrations).

## Development

### Setup

1. Clone the repo (or fork https://github.com/calcom/cal.diy/fork)

   ```sh
   git clone https://github.com/calcom/cal.diy.git
   ```

   > If you are on Windows, run the following command in Git Bash with admin privileges:
   > `git clone -c core.symlinks=true https://github.com/calcom/cal.diy.git`

2. Go to the project folder

   ```sh
   cd cal.diy
   ```

3. Install packages with yarn

   ```sh
   yarn
   ```

### Prerequisites

- Bun
- MongoDB Community Server

`bun start` checks MongoDB and attempts to start a local instance when needed. If startup reports that MongoDB is unreachable, start the installed service manually:

| Platform | Command |
|---|---|
| macOS with Homebrew | `brew services start mongodb-community` |
| Linux with systemd | `sudo systemctl start mongod` |
| Windows service | Run `net start MongoDB` from Command Prompt as Administrator. |

To verify the local connection manually:

```bash
mongosh "mongodb://127.0.0.1:27017" --eval "db.runCommand({ ping: 1 })"
```

### Install and start

From the repository root:

```bash
bun install
bun start
```

After startup:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API health: `http://localhost:8000/api/v1/health`

HackerRank uses `bun install && bash setup.sh --seed` for installation and `bun start` for the complete application run flow.

### Command reference

| Command | Purpose |
|---|---|
| `bun install` | Installs the pinned root, frontend, and backend workspaces from `bun.lock`. |
| `bun start` | Creates missing environment files, verifies MongoDB, resets seed data, and starts frontend and backend together. |
| `bun run seed` | Clears the application collections and restores the deterministic seed baseline without starting the servers. |
| `bun run dev:backend` | Starts only the Express API on port `8000` with Bun watch mode. Use it when working only on backend behavior. |
| `bun run dev:frontend` | Starts only Vite on port `3000`. Use it when the backend is already running separately. |

## Demo workspace

Use the seeded Alex Morgan account:

```text
Email: alex.morgan@calendar.com
Password: password123
```

After login, choose any seeded profile to open that person's calendar.

## Create and validate a Code Repo application

This repository includes an internal authoring guideline and a read-only validation skill for maintainers creating complete Code Repo applications.

### While creating an application

Use the [HackerRank Code Repo Guidelines](docs/HackerRank-Code-Repo-Guidelines.md) as the acceptance contract. It explains product completeness, stack preservation, dependency restrictions, repository structure, HackerRank runtime behavior, README requirements, and evidence needed for completion.

Write the new application's README as its product contract. Document features that are implemented across frontend, API, and persistence, and describe the actual stack and commands used by that repository.

### After implementation is complete

Open the repository in Codex or Claude Code and use this prompt:

```text
Read and follow skills/code-repo-validate/SKILL.md to validate this complete Code Repo application against docs/HackerRank-Code-Repo-Guidelines.md. Run the in-scope static, install, build, start, API, and MongoDB checks, then write the report outside the repository.
```

The validator first applies the required README gate, then checks repository structure, stack and dependency consistency, declared commands, frontend-to-backend feature coverage, live API behavior, persistence, seed reset, and archive contents. It never creates missing documentation or repairs the repository during the audit.

See the [validation manual](skills/code-repo-validate/SKILL-MANUAL.md) for adoption, invocation, verdict meanings, and the rerun workflow.
