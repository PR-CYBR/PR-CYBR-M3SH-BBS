# Task: PR-MESH-BBS Public Bulletin Board

## Objective

Implement the public PR-MESH-BBS system that broadcasts island-wide bulletins on Meshtastic Channel-0 (LongFast default).

## Requirements

- [ ] Create `data/pr-mesh-bbs/announcements/` directory with sample content
- [ ] Create `data/pr-mesh-bbs/sitreps/` directory with sample content
- [ ] Implement `scripts/pr_mesh_bbs_generate.py` to convert Markdown to JSON
- [ ] Implement `scripts/pr_mesh_bbs_tx.py` to transmit JSON via Meshtastic
- [ ] Create `config/pr_mesh_bbs.yml` with schedule and source configuration
- [ ] Validate JSON output matches the defined schema

## Implementation Notes

### Data Sources

Bulletin content is authored as Markdown files:
- `data/pr-mesh-bbs/announcements/*.md` – General announcements
- `data/pr-mesh-bbs/sitreps/*.md` – Situational reports

### JSON Output

The generator produces `out/pr-mesh-bbs/bulletins.json` with this structure:

```json
{
  "bbs": "PR-MESH-BBS",
  "generated_at": "<ISO8601 UTC>",
  "schedule": ["09:00", "18:00"],
  "channel": 0,
  "bulletins": [...]
}
```

### Transmission

The TX script reads the JSON and broadcasts via Meshtastic:
- Uses `meshtastic_client.py` for serial connection
- Targets Channel-0 (LongFast)
- Configurable hop limit (default: 3)

### Schedule

- 09:00 local time (AST/Atlantic Standard Time)
- 18:00 local time (AST/Atlantic Standard Time)

## Acceptance Criteria

- [ ] Generator script runs without errors
- [ ] JSON output validates against schema
- [ ] TX script connects to Meshtastic radio (when hardware available)
- [ ] Sample content demonstrates proper format
- [ ] Configuration is externalized (no hard-coded values)

## Status

**In Progress**
