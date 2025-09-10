# Contributing Guide

- Fork and branch from `main`. Keep changes focused and small.
- Use Conventional Commits, e.g. `feat(api): add x`, `fix(web): y`.
- Run tests locally: `npm -w api test`, `npm -w web test`.
- Lint and format before submitting: `npm run lint` at root.
- Document new endpoints/flags in `docs/*` and update Swagger annotations.
- Include testing notes and screenshots (UI) in PRs.
- Security-sensitive changes: add reasoning in PR and update `docs/security/*`.
