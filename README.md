# Testing — Dummy Node.js App for PipelineForge E2E Testing

A simple Express REST API used to validate the full PipelineForge CI/CD pipeline:
**Build → Unit Tests → SAST (ESLint + SonarQube) → Docker Build → Container Scan (Trivy) → DAST (OWASP ZAP) → Push → Deploy → Slack Notify**

## App endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — returns `{ status: "ok" }` |
| GET | `/items` | List all items |
| GET | `/items/:id` | Get one item by ID |
| POST | `/items` | Create item `{ name, price }` |
| DELETE | `/items/:id` | Delete item by ID |

## Run locally

```bash
npm install
npm start           # http://localhost:3000
npm test            # Jest unit tests + coverage
npm run lint        # ESLint security rules
```

## Run with Docker

```bash
docker build -t testing-app .
docker run -p 3000:3000 testing-app
curl http://localhost:3000/health
```

## Pipeline (Jenkinsfile)

See `Jenkinsfile` at repo root. Jenkins credentials required:

| Credential ID | Type | Value |
|---|---|---|
| `DOCKER_PASSWORD` | Secret text | Docker Hub password |
| `SONAR_TOKEN` | Secret text | SonarCloud token |
| `SLACK_WEBHOOK` | Secret text | Slack incoming webhook URL |

## SAST

- **ESLint** (`npm run lint`) — catches `eval`, unsafe regex, object injection, timing attacks
- **SonarQube/SonarCloud** — full static analysis, security hotspots, coverage gate

Config: `sonar-project.properties`, `.eslintrc.json`

## DAST

- **OWASP ZAP** full scan against the live running Docker container
- Report published as HTML artifact in Jenkins
- Config: `zap.conf`
