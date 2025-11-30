# Specification

## Overview
This document contains the technical specifications for projects built using this Spec-Kit template.

## Template Specifications

### Directory Structure
```
/
├── .specify/
│   ├── constitution.md    # Project principles and governance
│   ├── spec.md           # This file - technical specifications
│   ├── plan.md           # Implementation planning
│   └── tasks/            # Individual task specifications
├── .github/
│   └── workflows/
│       └── spec-kit.yml  # Automation workflow
├── infra/                # Terraform infrastructure configuration
│   ├── main.tf           # Main Terraform configuration
│   ├── variables.tf      # Variable definitions
│   ├── variables.tfvars  # Variable values template
│   ├── providers.tf      # Provider configurations
│   └── outputs.tf        # Output definitions
└── README.md             # Project documentation
```

### Spec-Kit Commands

The following commands should be available for managing specifications:

#### /speckit.constitution
- **Purpose**: Review or update the project constitution
- **Usage**: Displays constitution principles and governance rules
- **Implementation**: Read and display `.specify/constitution.md`

#### /speckit.specify
- **Purpose**: Review or update technical specifications
- **Usage**: Displays current specifications
- **Implementation**: Read and display `.specify/spec.md`

#### /speckit.plan
- **Purpose**: Review or update the implementation plan
- **Usage**: Displays high-level project plan
- **Implementation**: Read and display `.specify/plan.md`

#### /speckit.tasks
- **Purpose**: List and manage individual tasks
- **Usage**: Displays all tasks from the tasks directory
- **Implementation**: List and display files in `.specify/tasks/`

### Workflow Requirements

The `.github/workflows/spec-kit.yml` workflow should:
1. Validate markdown syntax in specification files
2. Check for broken links in documentation
3. Ensure required files exist
4. Run on pull requests and pushes to main branch

### Branch-Specific Workflows

Each branch in the comprehensive branching scheme has dedicated workflows:

#### Specification and Planning Workflows
- `spec.yml`: Validates specification documents in the `spec` branch
- `plan.yml`: Validates planning documents in the `plan` branch
- `design.yml`: Validates design artifacts in the `design` branch

#### Development Workflows
- `impl.yml`: Runs implementation-specific validation in the `impl` branch
- `dev.yml`: Executes development tasks in the `dev` branch
- `test.yml`: Runs comprehensive test suites in the `test` branch

#### Deployment Workflows
- `stage.yml`: Deploys to staging environment from the `stage` branch
- `prod.yml`: Handles production deployment from the `prod` branch
- `pages.yml`: Builds and deploys documentation from the `pages` branch
- `gh-pages.yml`: Alternative GitHub Pages deployment from the `gh-pages` branch
- `codex.yml`: Validates knowledge base content in the `codex` branch

#### Automated Pull Request Workflows
- `auto-pr-spec-to-plan.yml`: Promotes specifications to planning
- `auto-pr-plan-to-impl.yml`: Promotes plans to implementation
- `auto-pr-design-to-impl.yml`: Integrates design into implementation
- `auto-pr-impl-to-dev.yml`: Integrates implementation into development
- `auto-pr-dev-to-main.yml`: Promotes development to stable baseline
- `auto-pr-main-to-stage.yml`: Promotes stable code to staging
- `auto-pr-main-to-test.yml`: Synchronizes testing with stable code
- `auto-pr-stage-to-prod.yml`: Promotes staging to production
- `auto-pr-prod-to-pages.yml`: Updates documentation from production
- `auto-pr-codex-to-pages.yml`: Publishes knowledge base to documentation

### Infrastructure as Code

All repositories derived from this template include a baseline Terraform configuration in the `infra/` directory. This provides:

#### PR-CYBR Agent Standardization
- Consistent variable schema across all PR-CYBR agents
- Standard variables: `agent_id`, `agent_role`, `environment`, `dockerhub_user`, `notion_page_id`
- Alignment with PR-CYBR `agent-variables.tf` specification

#### Terraform Configuration Structure
- **main.tf**: Core infrastructure configuration with commented backend block
- **variables.tf**: Variable definitions with validation rules
- **variables.tfvars**: Template with placeholder values (safe to commit)
- **providers.tf**: Provider configurations (Terraform Cloud, GitHub) ready for initialization
- **outputs.tf**: Standardized outputs for agent identification and connection info

#### Security and Best Practices
- Sensitive values injected via environment variables (`TF_VAR_*`)
- No secrets or environment-specific data in version control
- Backend configuration commented out by default for safe initialization
- Validation rules ensure data consistency

#### Initialization Workflow
```bash
cd infra
terraform init -backend=false
terraform fmt
terraform validate
terraform plan -input=false -var-file=variables.tfvars
```

See `.specify/tasks/infra-bootstrap.md` for detailed initialization instructions.

### Extensibility

This template is designed to be extended with:
- Technology-specific tooling (linters, build systems, test frameworks)
- Additional automation workflows
- Custom task management integrations
- Project-specific specifications
- Infrastructure resources in `infra/main.tf` based on agent requirements

## Non-Functional Requirements

### Maintainability
- All specification files use Markdown format
- Clear, hierarchical organization
- Version controlled alongside code

### Portability
- No technology-specific dependencies in the template
- Cross-platform compatibility
- Standard file formats

### Usability
- Clear documentation in README
- Self-explanatory directory structure
- Minimal learning curve for new users

---

## PR‑CYBR Meshtastic BBS System

This section specifies the architecture for a Meshtastic‑based multi‑channel Bulletin Board System (BBS) comprising two logical systems:

- **PR‑MESH‑BBS** – Public BBS on Meshtastic Channel‑0 (LongFast default)
- **PR‑CYBR‑BBS** – Private BBS on Meshtastic Channels 1–6 with specialized functions

### System Overview

Both BBS systems share the same codebase and directory structure but are configured differently via branch‑specific configuration files. The runtime target is a Raspberry Pi 5 with a MorosX XTAK‑LoRa‑Mesh unit connected via serial.

### Channel Mapping

| Channel | Name         | Purpose                                                |
|---------|--------------|--------------------------------------------------------|
| 0       | PR‑MESH‑BBS  | Public island‑wide bulletin board (LongFast)           |
| 1       | OPS‑SITREP   | Island/division situational reports                    |
| 2       | S2‑INTEL     | Threats, incidents, BOLOs, Amber Alerts                |
| 3       | S3‑PLANS     | Planned operations, deployments, FTXs                  |
| 4       | M3SH‑OPS     | PR‑CYBR‑MAP updates, node status, sensor status        |
| 5       | LOG‑RES      | Logistics and resources                                |
| 6       | MAILB0X      | Encrypted user messaging (bridge toward Reticulum)     |

### PR‑MESH‑BBS (Public, Channel‑0)

**Schedule**: Broadcast at 09:00 and 18:00 local time daily.

**Data Flow**:
1. Content authored as Markdown files under `data/pr-mesh-bbs/`
2. Generator script (`scripts/pr_mesh_bbs_generate.py`) converts to JSON
3. JSON output stored in `out/pr-mesh-bbs/bulletins.json`
4. Transmission script (`scripts/pr_mesh_bbs_tx.py`) sends via Meshtastic on Channel‑0

**JSON Schema** (bulletins):
```json
{
  "bbs": "PR-MESH-BBS",
  "generated_at": "<ISO8601 UTC>",
  "schedule": ["09:00", "18:00"],
  "channel": 0,
  "bulletins": [
    {
      "id": "<uuid>",
      "category": "ANNOUNCEMENT|SITREP|INFO",
      "title": "...",
      "body": "...",
      "valid_from": "...",
      "valid_until": "...",
      "priority": "low|normal|high"
    }
  ]
}
```

### PR‑CYBR‑BBS (Private, Channels 1–6)

**Schedule**: Dispatch/check cycle at 09:00, 12:00, and 18:00 local time daily.

**Data Sources** (per channel):
- `data/pr-cybr-bbs/ops-sitrep/` → Channel 1
- `data/pr-cybr-bbs/s2-intel/` → Channel 2
- `data/pr-cybr-bbs/s3-plans/` → Channel 3
- `data/pr-cybr-bbs/m3sh-ops/` → Channel 4
- `data/pr-cybr-bbs/log-res/` → Channel 5
- `data/pr-cybr-bbs/mailbox/` → Channel 6

**JSON Schema** (per channel):
```json
{
  "bbs": "PR-CYBR-BBS",
  "channel": 1,
  "name": "OPS-SITREP",
  "generated_at": "<ISO8601 UTC>",
  "schedule": ["09:00", "12:00", "18:00"],
  "items": [
    {
      "id": "<uuid>",
      "category": "...",
      "title": "...",
      "body": "...",
      "tags": ["ops", "region-x"],
      "valid_from": "...",
      "valid_until": "..."
    }
  ]
}
```

### M3SH‑OPS Tracking (Channel‑4)

Channel‑4 includes node and sensor status tracking.

**Node Status Schema** (`data/status/nodes.json`):
```json
{
  "generated_at": "...",
  "nodes": [
    {
      "node_id": "<meshtastic_node_id>",
      "name": "<callsign>",
      "last_seen": "<ISO8601 UTC>",
      "battery": 0.73,
      "rssi": -95,
      "snr": 7.5,
      "location": {
        "lat": 18.1234,
        "lon": -66.1234,
        "alt": 50
      },
      "tags": ["gateway", "sensor"]
    }
  ]
}
```

### MAILB0X Encryption Model (Channel‑6)

Messages are encrypted at rest using AES‑256‑GCM with keys derived via Argon2id from user passphrases.

**Mailbox File Schema** (`data/mailboxes/<recipient_id>.json`):
```json
{
  "version": 1,
  "cipher": "aes-256-gcm",
  "kdf": "argon2id",
  "salt": "<base64>",
  "mail": [
    {
      "id": "<uuid>",
      "enc_body": "<base64-ciphertext>",
      "iv": "<base64-iv-or-nonce>",
      "sent_at": "<ISO8601 UTC>",
      "from": "<sender_id>",
      "metadata": {}
    }
  ]
}
```

**Message Schema** (pre-encryption):
```json
{
  "version": 1,
  "from_node": "<meshtastic_node_id>",
  "to_node": "<meshtastic_or_reticulum_id>",
  "timestamp": "<ISO8601 UTC>",
  "body": "<plaintext>",
  "metadata": {
    "priority": "normal|urgent",
    "ttl": 3600,
    "tags": ["mailbox", "bridge"],
    "via": ["meshtastic", "reticulum"]
  }
}
```

**Access Model**: Users must provide a passphrase ("something they know") to decrypt their mailbox. Passphrases are never stored persistently.

### Reticulum Bridge Readiness

All JSON schemas are designed to facilitate future bridging to Reticulum mesh networks. The `via` metadata field tracks message routing across protocols.

### Hardware Configuration

Hardware specifics are externalized in `config/hardware.yml` and environment variables:
- `MESH_SERIAL_PORT` – Serial port path (e.g., `/dev/ttyUSB0`)
- `MESH_BAUD` – Baud rate (e.g., `115200`)

### Directory Structure

```
config/
├── hardware.yml
├── pr_mesh_bbs.yml
└── pr_cybr_bbs_channels.yml

data/
├── pr-mesh-bbs/
│   ├── announcements/
│   └── sitreps/
├── pr-cybr-bbs/
│   ├── ops-sitrep/
│   ├── s2-intel/
│   ├── s3-plans/
│   ├── m3sh-ops/
│   ├── log-res/
│   └── mailbox/
├── status/
│   └── nodes.json
└── mailboxes/

out/
├── pr-mesh-bbs/
└── pr-cybr-bbs/

assets/qr/pr-cybr-bbs/

scripts/
├── meshtastic_client.py
├── pr_mesh_bbs_generate.py
├── pr_mesh_bbs_tx.py
├── pr_cybr_bbs_generate.py
├── pr_cybr_bbs_tx.py
├── m3sh_ops_report.py
├── mailbox_crypto.py
├── mailbox_ops.py
├── mailbox_cli.py
├── generate_pr_cybr_qr_codes.py
└── validate_bbs_output.py

tests/
```
