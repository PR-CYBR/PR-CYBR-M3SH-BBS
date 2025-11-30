#!/usr/bin/env python3
"""
M3SH-OPS Report Script

Generates status summaries for Channel-4 (M3SH-OPS) from node telemetry data.
Reads from data/status/nodes.json and outputs to out/pr-cybr-bbs/channel-4.json.

Usage:
    python scripts/m3sh_ops_report.py [--status-file FILE] [--output OUTPUT]
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any


def load_node_status(status_file: Path) -> dict[str, Any]:
    """Load node status from JSON file."""
    if not status_file.exists():
        print(f"Error: Status file not found: {status_file}", file=sys.stderr)
        sys.exit(1)
    
    with open(status_file, "r") as f:
        return json.load(f)


def calculate_network_stats(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Calculate network-wide statistics from node data.
    
    Args:
        nodes: List of node dictionaries.
    
    Returns:
        Dictionary with network statistics.
    """
    if not nodes:
        return {
            "total_nodes": 0,
            "online_nodes": 0,
            "avg_battery": 0.0,
            "avg_rssi": 0.0,
            "avg_snr": 0.0
        }
    
    now = datetime.now(timezone.utc)
    online_threshold = timedelta(minutes=30)
    
    online_count = 0
    total_battery = 0.0
    total_rssi = 0.0
    total_snr = 0.0
    battery_count = 0
    rssi_count = 0
    snr_count = 0
    
    for node in nodes:
        # Check if online
        last_seen = node.get("last_seen")
        if last_seen:
            try:
                last_seen_dt = datetime.fromisoformat(
                    last_seen.replace("Z", "+00:00")
                )
                if now - last_seen_dt < online_threshold:
                    online_count += 1
            except ValueError:
                pass
        
        # Accumulate metrics
        if node.get("battery") is not None:
            total_battery += node["battery"]
            battery_count += 1
        
        if node.get("rssi") is not None:
            total_rssi += node["rssi"]
            rssi_count += 1
        
        if node.get("snr") is not None:
            total_snr += node["snr"]
            snr_count += 1
    
    return {
        "total_nodes": len(nodes),
        "online_nodes": online_count,
        "avg_battery": round(total_battery / battery_count, 2) if battery_count else 0.0,
        "avg_rssi": round(total_rssi / rssi_count, 1) if rssi_count else 0.0,
        "avg_snr": round(total_snr / snr_count, 1) if snr_count else 0.0
    }


def get_nodes_by_tag(nodes: list[dict[str, Any]], tag: str) -> list[dict[str, Any]]:
    """Filter nodes by tag."""
    return [n for n in nodes if tag in n.get("tags", [])]


def format_node_summary(node: dict[str, Any]) -> str:
    """Format a human-readable summary of a node."""
    name = node.get("name", "Unknown")
    node_id = node.get("node_id", "?")
    battery = node.get("battery", 0)
    rssi = node.get("rssi", 0)
    snr = node.get("snr", 0)
    tags = ", ".join(node.get("tags", []))
    
    return (
        f"{name} ({node_id})\n"
        f"  Battery: {battery * 100:.0f}%\n"
        f"  RSSI: {rssi} dBm, SNR: {snr} dB\n"
        f"  Tags: {tags or 'none'}"
    )


def generate_summary_item(
    stats: dict[str, Any],
    nodes: list[dict[str, Any]]
) -> dict[str, Any]:
    """Generate a summary item for the channel payload."""
    now = datetime.now(timezone.utc)
    
    # Build summary body
    lines = [
        "Network Status Summary",
        "=" * 22,
        f"Total Nodes: {stats['total_nodes']}",
        f"Online Nodes: {stats['online_nodes']}",
        f"Avg Battery: {stats['avg_battery'] * 100:.0f}%",
        f"Avg RSSI: {stats['avg_rssi']} dBm",
        f"Avg SNR: {stats['avg_snr']} dB",
        "",
        "Node Types:",
    ]
    
    # Count by tag
    tag_counts = {}
    for node in nodes:
        for tag in node.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    for tag, count in sorted(tag_counts.items()):
        lines.append(f"  {tag}: {count}")
    
    return {
        "id": "m3sh-ops-summary",
        "category": "NETWORK_STATUS",
        "title": "Network Status Summary",
        "body": "\n".join(lines),
        "tags": ["summary", "network"],
        "valid_from": now.isoformat(),
        "valid_until": (now + timedelta(hours=1)).isoformat()
    }


def generate_node_items(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate individual items for each node."""
    now = datetime.now(timezone.utc)
    items = []
    
    for node in nodes:
        node_id = node.get("node_id", "unknown")
        name = node.get("name", "Unknown")
        
        item = {
            "id": f"node-{node_id}",
            "category": "NODE_STATUS",
            "title": f"Node: {name}",
            "body": format_node_summary(node),
            "tags": node.get("tags", []),
            "valid_from": node.get("last_seen", now.isoformat()),
            "valid_until": (now + timedelta(hours=1)).isoformat()
        }
        items.append(item)
    
    return items


def generate_channel_payload(
    nodes: list[dict[str, Any]],
    include_nodes: bool = True
) -> dict[str, Any]:
    """
    Generate the complete M3SH-OPS channel payload.
    
    Args:
        nodes: List of node dictionaries.
        include_nodes: Whether to include individual node items.
    
    Returns:
        Channel payload dictionary.
    """
    now = datetime.now(timezone.utc)
    stats = calculate_network_stats(nodes)
    
    items = [generate_summary_item(stats, nodes)]
    
    if include_nodes:
        items.extend(generate_node_items(nodes))
    
    return {
        "bbs": "PR-CYBR-BBS",
        "channel": 4,
        "name": "M3SH-OPS",
        "generated_at": now.isoformat(),
        "schedule": ["09:00", "12:00", "18:00"],
        "network_stats": stats,
        "items": items
    }


def print_human_summary(nodes: list[dict[str, Any]], stats: dict[str, Any]) -> None:
    """Print a human-readable summary to stdout."""
    print("\n" + "=" * 50)
    print("M3SH-OPS Network Status Report")
    print("=" * 50)
    print(f"Generated: {datetime.now(timezone.utc).isoformat()}")
    print()
    print("Network Statistics:")
    print(f"  Total Nodes: {stats['total_nodes']}")
    print(f"  Online Nodes: {stats['online_nodes']}")
    print(f"  Avg Battery: {stats['avg_battery'] * 100:.0f}%")
    print(f"  Avg RSSI: {stats['avg_rssi']} dBm")
    print(f"  Avg SNR: {stats['avg_snr']} dB")
    print()
    
    if nodes:
        print("Nodes:")
        for node in nodes:
            print(f"\n  {format_node_summary(node).replace(chr(10), chr(10) + '  ')}")
    
    print("\n" + "=" * 50)


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Generate M3SH-OPS network status report"
    )
    parser.add_argument(
        "--status-file",
        type=Path,
        default=repo_root / "data" / "status" / "nodes.json",
        help="Path to nodes.json status file"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "out" / "pr-cybr-bbs" / "channel-4.json",
        help="Output JSON file path"
    )
    parser.add_argument(
        "--no-individual-nodes",
        action="store_true",
        help="Exclude individual node items from output"
    )
    parser.add_argument(
        "--human",
        action="store_true",
        help="Print human-readable summary to stdout"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Load node status
    status_data = load_node_status(args.status_file)
    nodes = status_data.get("nodes", [])
    
    if args.verbose:
        print(f"Loaded {len(nodes)} node(s) from {args.status_file}")
    
    # Calculate statistics
    stats = calculate_network_stats(nodes)
    
    # Print human summary if requested
    if args.human:
        print_human_summary(nodes, stats)
    
    # Generate payload
    payload = generate_channel_payload(
        nodes,
        include_nodes=not args.no_individual_nodes
    )
    
    # Ensure output directory exists
    args.output.parent.mkdir(parents=True, exist_ok=True)
    
    # Write output
    with open(args.output, "w") as f:
        json.dump(payload, f, indent=2)
    
    print(f"Generated M3SH-OPS report: {len(payload['items'])} item(s) -> {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
