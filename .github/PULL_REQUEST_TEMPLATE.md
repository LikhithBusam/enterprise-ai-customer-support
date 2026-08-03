## Description

<!-- What does this PR change, and why? -->

## Related issue

Closes #

## Which track does this touch?

- [ ] Research (`experiments/`, `memory/`, `scripts/`)
- [ ] Production backend (`src/`)
- [ ] Support Console dashboard (`dashboard/`)
- [ ] Documentation only

## Screenshots

<!-- If this touches the dashboard UI, include before/after screenshots. -->

## Testing performed

- [ ] `uv run pytest` (backend/research)
- [ ] `uv run ruff check .` (backend/research)
- [ ] `npx tsc -b` (dashboard)
- [ ] `npm run lint` (dashboard)
- [ ] `npm run build` (dashboard)
- [ ] Manual testing (describe below)

<!-- Describe what you tested and how. For research-track changes, note which baseline(s) and
     failure-rate tier(s) you re-ran to confirm the result. -->

## Checklist

- [ ] I have read [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] This PR is scoped to one concern (not mixing research-track and production-track changes)
- [ ] I have not edited the frozen `experiments/memory_augmented.py` baseline
- [ ] The Critic still only reads `success`/`data`/`error` off tool results, never `failure_type`
- [ ] I have not introduced cross-client memory sharing without explicit sign-off
- [ ] Tests pass locally
- [ ] Documentation updated if this changes behavior described in README/ARCHITECTURE/DEPLOYMENT
