# Task: M3SH-OPS Node Status Tracking

## Objective

Implement node and sensor status tracking for Channel-4 (M3SH-OPS), providing visibility into the mesh network state.

## Requirements

- [ ] Define node status JSON schema
- [ ] Create sample `data/status/nodes.json` file
- [ ] Implement `scripts/m3sh_ops_report.py` to generate status summaries
- [ ] Integrate status data with Channel-4 output

## Implementation Notes

### Node Status Schema

`data/status/nodes.json`:
```json
{
  "generated_at": "<ISO8601 UTC>",
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

### Reporting Script

`scripts/m3sh_ops_report.py`:
- Reads `data/status/nodes.json`
- Generates summary for Channel-4
- Outputs to `out/pr-cybr-bbs/channel-4.json` or merges with existing
- Optional human-readable stdout output

### Node Identification

Nodes are identified by:
- Meshtastic node ID (hardware identifier)
- User-configured callsign/name

Automatic identity assignment is out of scope for this phase.

### Integration

The status report can be:
1. Standalone JSON output for Channel-4
2. Merged with other M3SH-OPS content
3. Included in the `items` array of the channel JSON

## Acceptance Criteria

- [ ] Sample nodes.json demonstrates complete schema
- [ ] Reporting script produces valid JSON
- [ ] Human-readable output aids debugging
- [ ] Integration with pr_cybr_bbs_generate.py works
- [ ] Node identification model is documented

## Status

**In Progress**
