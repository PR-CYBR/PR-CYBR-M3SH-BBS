# Task: GitHub Actions Workflows for BBS

## Objective

Create GitHub Actions workflows to automate BBS content generation, QR code creation, and CI validation.

## Requirements

- [ ] Create `.github/workflows/pr-mesh-bbs-generate.yml` for scheduled generation
- [ ] Create `.github/workflows/pr-cybr-bbs-qrs.yml` for QR code generation
- [ ] Create `.github/workflows/ci.yml` for continuous integration
- [ ] Create `requirements.txt` with Python dependencies
- [ ] Implement `scripts/validate_bbs_output.py` for JSON validation
- [ ] Implement `scripts/generate_pr_cybr_qr_codes.py` for QR creation

## Implementation Notes

### PR-MESH-BBS Generation Workflow

File: `.github/workflows/pr-mesh-bbs-generate.yml`

Triggers:
- `workflow_dispatch` (manual)
- `schedule`: cron for ~09:00 and ~18:00 Puerto Rico time (AST = UTC-4)
  - 09:00 AST = 13:00 UTC → `0 13 * * *`
  - 18:00 AST = 22:00 UTC → `0 22 * * *`

Steps:
1. Checkout repository
2. Setup Python 3.11
3. Install dependencies from `requirements.txt`
4. Run `python scripts/pr_mesh_bbs_generate.py`
5. Run `python scripts/validate_bbs_output.py`
6. Upload artifact `pr-mesh-bbs-bulletins`

### PR-CYBR-BBS QR Code Workflow

File: `.github/workflows/pr-cybr-bbs-qrs.yml`

Triggers:
- `workflow_dispatch` only (intentionally manual for stable QR codes)

Steps:
1. Checkout repository
2. Setup Python 3.11
3. Install dependencies
4. Run `python scripts/generate_pr_cybr_qr_codes.py`
5. Commit changes to `assets/qr/pr-cybr-bbs/`
   - Message: `chore(qr): regenerate PR-CYBR-BBS QR codes`

### CI Workflow

File: `.github/workflows/ci.yml`

Triggers:
- `push` to main, impl, dev, pr-mesh-bbs, pr-cybr-bbs
- `pull_request` targeting these branches

Steps:
1. Checkout repository
2. Setup Python 3.11
3. Install dependencies
4. Run linting (if configured)
5. Run unit tests in `tests/`
6. Validate JSON schemas in `out/`

### Dependencies

`requirements.txt`:
```
cryptography>=41.0.0
qrcode[pil]>=7.4.0
meshtastic>=2.0.0
argon2-cffi>=23.1.0
pyyaml>=6.0.0
pytest>=7.4.0
```

## Acceptance Criteria

- [ ] Scheduled workflow runs at correct times
- [ ] Manual triggers work for all workflows
- [ ] QR codes are committed with proper message
- [ ] CI catches invalid JSON and failing tests
- [ ] Secrets are not exposed in logs
- [ ] Workflows use ubuntu-latest and Python 3.11

## Status

**In Progress**
