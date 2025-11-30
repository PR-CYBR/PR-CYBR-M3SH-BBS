[![Spec-Kit Validation](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/spec-kit.yml/badge.svg?branch=main)](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/spec-kit.yml)
[![CI](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/ci.yml/badge.svg)](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/ci.yml)
[![Dashboard](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/dashboard-pages.yml/badge.svg)](https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS/actions/workflows/dashboard-pages.yml)

# PR-CYBR Meshtastic BBS

A multi-channel Bulletin Board System (BBS) architecture for Meshtastic mesh networks, designed for Puerto Rico's emergency communication infrastructure.

## Overview

This repository implements two complementary BBS systems:

- **PR-MESH-BBS** - Public bulletin board on Meshtastic Channel-0 (LongFast default)
- **PR-CYBR-BBS** - Private operational BBS on Meshtastic Channels 1-6

Both systems share the same codebase and are designed to run on a Raspberry Pi 5 connected to a MorosX XTAK-LoRa-Mesh unit.

## Channel Mapping

| Channel | Name        | Purpose                                          |
|---------|-------------|--------------------------------------------------|
| 0       | PR-MESH-BBS | Public island-wide bulletin board (LongFast)     |
| 1       | OPS-SITREP  | Island/division situational reports              |
| 2       | S2-INTEL    | Threats, incidents, BOLOs, Amber Alerts          |
| 3       | S3-PLANS    | Planned operations, deployments, FTXs            |
| 4       | M3SH-OPS    | PR-CYBR-MAP updates, node status, sensor status  |
| 5       | LOG-RES     | Logistics and resources                          |
| 6       | MAILB0X     | Encrypted user messaging (Reticulum bridge)      |

## Quick Start

### Prerequisites

- Python 3.11+
- Meshtastic device (for transmission)

### Installation

```bash
# Clone the repository
git clone https://github.com/PR-CYBR/PR-CYBR-M3SH-BBS.git
cd PR-CYBR-M3SH-BBS

# Install dependencies
pip install -r requirements.txt
```

### Generate Bulletins

```bash
# Generate PR-MESH-BBS (public) bulletins
python scripts/pr_mesh_bbs_generate.py --verbose

# Generate PR-CYBR-BBS (private) channel payloads
python scripts/pr_cybr_bbs_generate.py --verbose

# Generate M3SH-OPS network status report
python scripts/m3sh_ops_report.py --human
```

### Validate Output

```bash
python scripts/validate_bbs_output.py --all --verbose
```

## Raspberry Pi Deployment

On the Raspberry Pi with a connected Meshtastic device:

```bash
# Set the serial port (if not auto-detected)
export MESH_SERIAL_PORT=/dev/ttyUSB0

# Transmit PR-MESH-BBS bulletins on Channel-0
python scripts/pr_mesh_bbs_tx.py --dry-run  # Test first
python scripts/pr_mesh_bbs_tx.py

# Transmit PR-CYBR-BBS on specific channel
python scripts/pr_cybr_bbs_tx.py --channel 1 --dry-run
python scripts/pr_cybr_bbs_tx.py --channel 1

# Transmit to all private channels
python scripts/pr_cybr_bbs_tx.py --all-channels
```

## MAILB0X (Encrypted Messaging)

Channel-6 provides encrypted point-to-point messaging with passphrase-based access.

### Add a Message

```bash
python scripts/mailbox_cli.py add \
  --to "recipient-node-id" \
  --from "sender-node-id" \
  --body "Your secret message here" \
  --passphrase "recipient-secret-passphrase"
```

### Read Messages

```bash
python scripts/mailbox_cli.py read \
  --for "recipient-node-id" \
  --passphrase "recipient-secret-passphrase"
```

### List Mailboxes

```bash
python scripts/mailbox_cli.py list
```

### Security Model

- Messages are encrypted at rest using **AES-256-GCM**
- Keys are derived from passphrases using **Argon2id** (or PBKDF2-SHA256 fallback)
- Passphrases are **never stored** - they must be provided at read time
- Each message uses a unique random salt and nonce

## QR Code Generation

Generate QR codes for joining PR-CYBR-BBS channels:

```bash
python scripts/generate_pr_cybr_qr_codes.py --verbose
```

QR codes are saved to `assets/qr/pr-cybr-bbs/`.

To include channel PSKs, set environment variables before running:

```bash
export MESH_CH1_PSK="base64-encoded-psk"
python scripts/generate_pr_cybr_qr_codes.py
```

## Directory Structure

```
config/
├── hardware.yml              # Serial port, baud rate, device settings
├── pr_mesh_bbs.yml           # Public BBS schedule and sources
└── pr_cybr_bbs_channels.yml  # Private channel definitions

dashboard/
├── index.html                # Dashboard main page (multi-view navigation)
├── app.js                    # Dashboard JavaScript logic
├── styles.css                # Dashboard styling
├── config.js                 # Dashboard configuration
├── state.json                # Auto-updated BBS state data
└── js/                       # JavaScript modules
    ├── meshtasticDeviceClient.js  # Web Serial/Bluetooth device client
    ├── mapView.js             # Leaflet map visualization
    ├── messagesView.js        # Messages/BBS feed UI
    ├── deviceSettingsView.js  # Device settings UI
    └── dashboardHealth.js     # Health/freshness indicators

data/
├── pr-mesh-bbs/              # Public bulletin content
│   ├── announcements/
│   └── sitreps/
├── pr-cybr-bbs/              # Private channel content
│   ├── ops-sitrep/
│   ├── s2-intel/
│   ├── s3-plans/
│   ├── m3sh-ops/
│   ├── log-res/
│   └── mailbox/
├── status/
│   └── nodes.json            # Node telemetry data
├── mailboxes/                # Encrypted user mailboxes
└── qr_manifest.json          # QR code manifest for dashboard

out/
├── pr-mesh-bbs/              # Generated JSON outputs
└── pr-cybr-bbs/

assets/qr/pr-cybr-bbs/        # Channel join QR codes

scripts/
├── meshtastic_client.py      # Meshtastic device interface
├── pr_mesh_bbs_generate.py   # Public BBS generator
├── pr_mesh_bbs_tx.py         # Public BBS transmitter
├── pr_cybr_bbs_generate.py   # Private BBS generator
├── pr_cybr_bbs_tx.py         # Private BBS transmitter
├── m3sh_ops_report.py        # Network status reporter
├── mailbox_crypto.py         # Encryption primitives
├── mailbox_ops.py            # Mailbox file operations
├── mailbox_cli.py            # Mailbox command-line interface
├── generate_pr_cybr_qr_codes.py  # QR code generator
├── export_dashboard_state.py # Dashboard state exporter
└── validate_bbs_output.py    # JSON schema validator

tests/                        # Unit tests
```

## Running the Dashboard Locally

The dashboard is a static site that can be served with any HTTP server:

```bash
# Using Python
cd dashboard
python -m http.server 8000

# Using Node.js (npx)
npx serve dashboard

# Using PHP
cd dashboard
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

**Note:** Device connection features (Web Serial/Bluetooth) require a secure context (HTTPS or localhost).

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-mesh-bbs-generate.yml` | Schedule (09:00, 18:00 AST) + Manual | Generate public bulletins |
| `pr-cybr-bbs-qrs.yml` | Schedule (daily) + Push + Manual | Generate channel QR codes |
| `ci.yml` | Push/PR | Run tests and validation |
| `dashboard-pages.yml` | Push to main + Manual | Deploy web dashboard |

## Web Dashboard

This project includes an interactive multi-view web dashboard deployed via GitHub Pages.

### Dashboard URL

Once GitHub Pages is enabled, the dashboard will be available at:

**https://pr-cybr.github.io/PR-CYBR-M3SH-BBS/**

### Dashboard Views

The dashboard is organized into multiple views accessible via the navigation tabs:

| View | Description |
|------|-------------|
| **Dashboard** | Overview with System Health, workflow status, bulletins, and node status |
| **Messages & BBS** | Chat-style message browser with search, filtering, and compose functionality |
| **Devices & Channels** | Device connection (Web Serial/Bluetooth) and channel import/export |
| **Device Settings** | Meshtastic device configuration UI with profile management |
| **Map** | Leaflet-based map visualization of mesh nodes over Puerto Rico |

### Dashboard Features

- **System Health Card**: Data freshness indicators for telemetry, bulletins, and QR codes
- **Workflow Status**: Monitor GitHub Actions workflows with one-click links
- **Public Bulletins**: View current PR-MESH-BBS public bulletins with stale warnings
- **Private Channels**: Browse summaries from all 6 PR-CYBR-BBS private channels
- **QR Codes**: Display QR codes for joining each private channel
- **Node Status**: Real-time node telemetry with freshness badges (Fresh/Stale/Offline)
- **Map View**: Interactive map with node markers, filtering, and legends
- **Messages View**: Unified message browser across all channels with search and compose
- **Device Connection**: Connect via Web Serial or Web Bluetooth (modern browsers)
- **Device Settings**: Configure device profiles with import/export support
- **Auto-refresh**: Dashboard data refreshes automatically every 5 minutes

### Browser Requirements for Device Connection

Device connection features (Web Serial API, Web Bluetooth API) require:
- **Chrome**, **Edge**, or **Opera** on desktop
- HTTPS or localhost origin
- User gesture to initiate connection

Older browsers can still use all other dashboard features.

### Enabling GitHub Pages

1. Go to **Settings** → **Pages** in the repository
2. Under **Build and deployment**, select **GitHub Actions** as the source
3. The dashboard workflow will automatically deploy on pushes to `main`

### Security

The dashboard is read-only and safe for public viewing:
- No API tokens or secrets are embedded in the frontend
- Workflow triggering requires authentication via GitHub UI or CLI
- All data is fetched from public GitHub APIs or static JSON files

## Configuration

### Hardware (`config/hardware.yml`)

```yaml
serial:
  port: null  # Auto-detect, or set to /dev/ttyUSB0
  baud: 115200
  timeout: 10

runtime:
  default_hop_limit: 3
  max_message_size: 228
```

Override with environment variables:

```bash
export MESH_SERIAL_PORT=/dev/ttyACM0
export MESH_BAUD=115200
```

### Schedules

- **PR-MESH-BBS**: Broadcasts at 09:00 and 18:00 AST (Atlantic Standard Time, UTC-4)
- **PR-CYBR-BBS**: Dispatch cycle at 09:00, 12:00, and 18:00 AST

## Writing Bulletins

Bulletins are authored as Markdown files with YAML frontmatter:

```markdown
---
id: unique-bulletin-id
title: Bulletin Title
category: ANNOUNCEMENT
priority: high
valid_from: 2024-01-01T00:00:00Z
valid_until: 2024-12-31T23:59:59Z
---

# Bulletin Title

Your bulletin content goes here...
```

Place files in the appropriate `data/` directory:

- `data/pr-mesh-bbs/announcements/` for public announcements
- `data/pr-mesh-bbs/sitreps/` for situational reports
- `data/pr-cybr-bbs/<channel>/` for private channel content

## Testing

```bash
# Run all tests
pytest tests/ -v

# Test specific modules
pytest tests/test_mailbox_crypto.py -v
pytest tests/test_bbs_generate.py -v
```

## Branching Strategy

- `main` - Stable baseline
- `pr-mesh-bbs` - Configuration tuned for public BBS deployment
- `pr-cybr-bbs` - Configuration tuned for private BBS deployment

See [BRANCHING.md](BRANCHING.md) for the complete branching model.

## Spec-Kit Integration

This repository follows the Spec-Kit specification-driven development workflow:

- `.specify/constitution.md` - Project principles and BBS-specific rules
- `.specify/spec.md` - Technical specifications
- `.specify/plan.md` - Implementation roadmap
- `.specify/tasks/` - Individual task specifications

## License

This project is released under the [MIT License](LICENSE).
