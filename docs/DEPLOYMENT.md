# Azure deployment plan (not deployed)

For a hackathon, use one small Azure Linux VM with Docker Compose or two systemd services on the VM: Next.js web/API and a Node reminder worker. Put Caddy or another reverse proxy in front for HTTPS. Mount a persistent local disk directory for the SQLite database and WAL files. Both services must use the same absolute `DATABASE_PATH` and secrets from VM configuration, not Git. Limit the public surface to HTTPS and SSH; use an invite code and conservative rate limits. Set up a health check, process restart policy, and encrypted backup of a SQLite snapshot. A static asset cache at the reverse proxy is enough for the pilot; do not provision Redis prematurely.

Readiness: test user registration, import timeout behavior, grade edge cases, push permission/delivery, database restart persistence, and a backup/restore exercise. Rehearse with synthetic data. The repo intentionally contains no live Azure resource IDs, credentials, deployment scripts, or paid-service configuration.

Growth path: keep the browser API and domain boundaries stable; add measured cache and a job queue when scale justifies them. SQLite remains appropriate for a single writer host, but multi-host deployment would require a supported shared database and durable queue, plus explicit migration planning. Google OAuth, SMS and recurring polling should be scoped and approved separately. Estimate Azure VM, backup, domain and model costs before deploying.

- [Azure virtual machines documentation](https://learn.microsoft.com/en-us/azure/virtual-machines/)
- [SQLite WAL documentation](https://www.sqlite.org/wal.html)
