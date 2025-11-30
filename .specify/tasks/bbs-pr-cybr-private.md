# Task: PR-CYBR-BBS Private Multi-Channel System

## Objective

Implement the private PR-CYBR-BBS system using Meshtastic Channels 1–6 for specialized operational functions.

## Requirements

- [ ] Create `data/pr-cybr-bbs/` directory structure for all 6 channels
- [ ] Create `config/pr_cybr_bbs_channels.yml` with channel definitions
- [ ] Implement `scripts/pr_cybr_bbs_generate.py` to generate per-channel JSON
- [ ] Implement `scripts/pr_cybr_bbs_tx.py` with CLI for channel selection
- [ ] Create sample content for each channel

## Implementation Notes

### Channel Mapping

| Channel | Directory           | Function                              |
|---------|---------------------|---------------------------------------|
| 1       | `ops-sitrep/`       | Island/division SITREPs               |
| 2       | `s2-intel/`         | Threats, incidents, BOLOs             |
| 3       | `s3-plans/`         | Planned operations, FTXs              |
| 4       | `m3sh-ops/`         | Node status, sensor data              |
| 5       | `log-res/`          | Logistics and resources               |
| 6       | `mailbox/`          | Encrypted user messaging              |

### Generator Script

`scripts/pr_cybr_bbs_generate.py`:
- Reads content from each channel's directory
- Outputs `out/pr-cybr-bbs/channel-<N>.json` for each channel
- Uses channel configuration from `config/pr_cybr_bbs_channels.yml`

### TX Script

`scripts/pr_cybr_bbs_tx.py`:
- CLI flags: `--channel N`, `--all-channels`, `--dry-run`
- Reuses `meshtastic_client.py` helper
- Safe for cron/systemd scheduling

### Schedule

Dispatch/check cycle:
- 09:00 local time
- 12:00 local time
- 18:00 local time

## Acceptance Criteria

- [ ] All 6 channel directories exist with sample content
- [ ] Generator produces valid JSON for each channel
- [ ] TX script supports all CLI options
- [ ] Channel configuration is complete and correct
- [ ] JSON schemas match specification

## Status

**In Progress**
