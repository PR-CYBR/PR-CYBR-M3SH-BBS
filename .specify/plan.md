# Implementation Plan

## Overview
This plan outlines how to use and extend this Spec-Kit template for your project.

## Phase 1: Template Adoption
**Status**: ✅ Complete

- [x] Initialize `.specify` directory structure
- [x] Create `constitution.md` with project principles
- [x] Create `spec.md` with technical specifications
- [x] Create this `plan.md` file
- [x] Create `tasks/` directory for task management
- [x] Set up GitHub workflow for automation
- [x] Document usage in README

## Phase 2: Project Initialization
**Status**: ⏳ Pending (User Action Required)

When starting a new project with this template:

- [ ] Clone or fork this repository
- [ ] Review and customize `constitution.md` for your team's principles
- [ ] Update `spec.md` with your project's technical requirements
- [ ] Modify this `plan.md` to reflect your implementation roadmap
- [ ] Add initial tasks to the `tasks/` directory
- [ ] Update README with project-specific information

## Phase 3: Technology Stack Integration
**Status**: ⏳ Pending (User Action Required)

Add your chosen technology stack:

- [ ] Add programming language(s) and runtime
- [ ] Configure build system and dependency management
- [ ] Set up testing framework
- [ ] Add linting and code quality tools
- [ ] Configure CI/CD pipelines
- [ ] Update `.gitignore` for your stack
- [ ] Extend `spec-kit.yml` workflow with stack-specific checks

## Phase 4: Development Workflow
**Status**: ✅ Complete (Branching Strategy) / ⏳ Pending (Other Items)

Establish development practices:

- [x] Define branching strategy (see [BRANCHING.md](../BRANCHING.md))
  - Specification branches: `spec` for requirements and technical specifications
  - Planning branches: `plan` for implementation planning and task breakdown
  - Design branches: `design` for UI/UX artifacts and design systems
  - Implementation branches: `impl` for active development work
  - Development branches: `dev` for feature integration
  - Main branch: `main` as stable baseline
  - Test branches: `test` for continuous integration
  - Staging branches: `stage` for pre-production validation
  - Production branches: `prod` for deployed code
  - Documentation branches: `pages` and `gh-pages` for static sites
  - Knowledge branches: `codex` for code examples and tutorials
- [ ] Set up code review process
- [ ] Configure issue templates
- [ ] Create pull request templates
- [ ] Document development setup
- [ ] Establish testing requirements
- [ ] Define deployment procedures

## Using Spec-Kit Commands

### Viewing Specifications
```bash
# Constitution
cat .specify/constitution.md

# Specifications
cat .specify/spec.md

# Plan
cat .specify/plan.md

# Tasks
ls -la .specify/tasks/
cat .specify/tasks/<task-name>.md
```

### Creating Tasks
Create new task files in `.specify/tasks/` following this template:

```markdown
# Task: [Task Name]

## Objective
[What needs to be accomplished]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Implementation Notes
[Technical details and considerations]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Status
[Not Started | In Progress | Complete]
```

## Maintenance and Evolution

### Regular Reviews
- Review constitution quarterly for relevance
- Update specifications as requirements change
- Keep plan synchronized with actual progress
- Archive completed tasks

### Continuous Improvement
- Gather feedback from team members
- Refine processes based on experience
- Update automation workflows
- Share learnings and best practices

## Success Metrics

- All team members understand the constitution
- Specifications remain current and accurate
- Plan reflects actual project state
- Tasks are granular and actionable
- Workflows provide value through automation

---

## PR‑CYBR Meshtastic BBS Implementation Plan

This section outlines the phased implementation of the PR‑MESH‑BBS and PR‑CYBR‑BBS systems.

### Phase 1: Data Schemas, Configuration, and Directory Layout
**Status**: ⏳ In Progress

- [ ] Create `config/` directory with YAML configuration files
  - `config/hardware.yml` – Serial port, baud rate, device settings
  - `config/pr_mesh_bbs.yml` – Public BBS schedule and sources
  - `config/pr_cybr_bbs_channels.yml` – Channel 1–6 definitions
- [ ] Create `data/` directory structure
  - `data/pr-mesh-bbs/announcements/` and `data/pr-mesh-bbs/sitreps/`
  - `data/pr-cybr-bbs/<channel-name>/` for each of 6 channels
  - `data/status/nodes.json` – Node status data
  - `data/mailboxes/` – Encrypted mailbox storage
- [ ] Create `out/` directory structure
  - `out/pr-mesh-bbs/` and `out/pr-cybr-bbs/`
- [ ] Create `assets/qr/pr-cybr-bbs/` for QR code assets
- [ ] Create sample data files demonstrating each format

### Phase 2: Generator and Transmission Scripts
**Status**: ⏳ Pending

- [ ] Implement `scripts/meshtastic_client.py`
  - Serial connection handling via config/env
  - `send_json(channel_index, json_obj, hop_limit)` function
- [ ] Implement `scripts/pr_mesh_bbs_generate.py`
  - Read markdown from `data/pr-mesh-bbs/`
  - Output JSON to `out/pr-mesh-bbs/bulletins.json`
- [ ] Implement `scripts/pr_mesh_bbs_tx.py`
  - Load JSON and transmit on Channel‑0
- [ ] Implement `scripts/pr_cybr_bbs_generate.py`
  - Process each channel's data directory
  - Output `out/pr-cybr-bbs/channel-<N>.json`
- [ ] Implement `scripts/pr_cybr_bbs_tx.py`
  - CLI with `--channel N`, `--all-channels`, `--dry-run`

### Phase 3: MAILB0X Encryption Layer
**Status**: ⏳ Pending

- [ ] Implement `scripts/mailbox_crypto.py`
  - `derive_key_from_passphrase(passphrase, salt)` using Argon2id
  - `encrypt_message(passphrase, plaintext)` → (salt, iv, ciphertext)
  - `decrypt_message(passphrase, salt, iv, ciphertext)` → plaintext
- [ ] Implement `scripts/mailbox_ops.py`
  - `append_encrypted_message(mailbox_path, message_dict, passphrase)`
  - `decrypt_mailbox(mailbox_path, passphrase)` → list of messages
- [ ] Implement `scripts/mailbox_cli.py`
  - `add` command for new messages
  - `read` command for decryption

### Phase 4: M3SH‑OPS Tracking Integration
**Status**: ⏳ Pending

- [ ] Implement `scripts/m3sh_ops_report.py`
  - Read `data/status/nodes.json`
  - Generate summary for Channel‑4
  - Optionally merge with `out/pr-cybr-bbs/channel-4.json`
- [ ] Create sample `data/status/nodes.json` with example entries
- [ ] Document node identification model (node ID + callsign)

### Phase 5: GitHub Actions and CI
**Status**: ⏳ Pending

- [ ] Create `.github/workflows/pr-mesh-bbs-generate.yml`
  - Scheduled runs at 09:00 and 18:00 AST (approximated in UTC)
  - Manual trigger via `workflow_dispatch`
  - Upload generated JSON as artifact
- [ ] Create `.github/workflows/pr-cybr-bbs-qrs.yml`
  - Manual trigger only (`workflow_dispatch`)
  - Generate QR codes and commit to `assets/qr/pr-cybr-bbs/`
- [ ] Create `.github/workflows/ci.yml`
  - Run on push to main, impl, dev, pr-*-bbs branches
  - Lint, test, and validate JSON schemas
- [ ] Implement `scripts/validate_bbs_output.py` for schema validation
- [ ] Implement `scripts/generate_pr_cybr_qr_codes.py` for QR generation

### Phase 6: Documentation and Examples
**Status**: ⏳ Pending

- [ ] Update `README.md` with:
  - Overview of PR‑MESH‑BBS and PR‑CYBR‑BBS
  - Channel mapping table
  - Local development instructions
  - Raspberry Pi deployment guide
  - MAILB0X usage instructions
  - QR code generation workflow
  - GitHub Actions documentation
- [ ] Create sample announcements and sitreps
- [ ] Document branch management for `pr-mesh-bbs` and `pr-cybr-bbs`

### Implementation Dependencies

```
Phase 1 ─┬─> Phase 2 ─┬─> Phase 5 ─> Phase 6
         │            │
         └─> Phase 3 ─┤
                      │
         └─> Phase 4 ─┘
```

### Technology Stack

- **Runtime**: Python 3.11+
- **Crypto**: `cryptography` library (AES-256-GCM, Argon2id)
- **QR Codes**: `qrcode` library
- **Meshtastic**: `meshtastic` Python API
- **CI/CD**: GitHub Actions with ubuntu-latest

### Success Criteria

- All generator scripts produce valid JSON matching defined schemas
- Crypto functions pass encrypt/decrypt round-trip tests
- Transmission scripts connect to Meshtastic radios via serial
- GitHub Actions workflows run successfully
- QR codes encode valid Meshtastic channel join URLs
- Documentation enables new contributors to understand and extend the system
