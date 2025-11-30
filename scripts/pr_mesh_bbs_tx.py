#!/usr/bin/env python3
"""
PR-MESH-BBS Transmission Script

Transmits generated BBS bulletins over Meshtastic Channel-0 (LongFast).
Designed to run on a Raspberry Pi connected to a Meshtastic device.

Usage:
    python scripts/pr_mesh_bbs_tx.py [--input INPUT] [--dry-run]
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml

# Handle both package and standalone execution
try:
    from . import meshtastic_client
except ImportError:
    import meshtastic_client


def load_config(config_path: Path) -> dict[str, Any]:
    """Load BBS configuration from YAML file."""
    if not config_path.exists():
        return {"bbs": {"channel": 0}}
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def load_bulletins(input_path: Path) -> dict[str, Any]:
    """Load bulletins JSON from file."""
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(input_path, "r") as f:
        return json.load(f)


def format_bulletin_for_tx(bulletin: dict[str, Any]) -> str:
    """
    Format a bulletin for transmission.
    
    Creates a compact text representation suitable for Meshtastic.
    
    Args:
        bulletin: Bulletin dictionary.
    
    Returns:
        Formatted text string.
    """
    priority_marker = ""
    if bulletin.get("priority") == "high":
        priority_marker = "!"
    elif bulletin.get("priority") == "low":
        priority_marker = "-"
    
    category = bulletin.get("category", "INFO")[:3]
    title = bulletin.get("title", "")
    body = bulletin.get("body", "")
    
    # Truncate body if too long
    max_body_len = 150
    if len(body) > max_body_len:
        body = body[:max_body_len - 3] + "..."
    
    return f"[{priority_marker}{category}] {title}\n{body}"


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Transmit PR-MESH-BBS bulletins over Meshtastic"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=repo_root / "out" / "pr-mesh-bbs" / "bulletins.json",
        help="Path to bulletins JSON file"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root / "config" / "pr_mesh_bbs.yml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be sent without actually transmitting"
    )
    parser.add_argument(
        "--send-full-json",
        action="store_true",
        help="Send the full JSON payload instead of formatted text"
    )
    parser.add_argument(
        "--hop-limit",
        type=int,
        default=None,
        help="Override hop limit for transmission"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    channel = config.get("bbs", {}).get("channel", 0)
    
    # Load bulletins
    payload = load_bulletins(args.input)
    bulletins = payload.get("bulletins", [])
    
    print(f"PR-MESH-BBS Transmission")
    print(f"  Input: {args.input}")
    print(f"  Channel: {channel}")
    print(f"  Bulletins: {len(bulletins)}")
    print(f"  Generated: {payload.get('generated_at', 'unknown')}")
    
    if not bulletins:
        print("No bulletins to transmit.")
        return 0
    
    if args.dry_run:
        print("\n=== DRY RUN - No actual transmission ===\n")
        
        if args.send_full_json:
            print("Would send full JSON payload:")
            print(json.dumps(payload, indent=2)[:500] + "...")
        else:
            for i, bulletin in enumerate(bulletins, 1):
                formatted = format_bulletin_for_tx(bulletin)
                print(f"--- Bulletin {i} ---")
                print(formatted)
                print()
        
        return 0
    
    # Connect to Meshtastic
    client = meshtastic_client.create_client()
    
    if not client.connect():
        print("Error: Failed to connect to Meshtastic device", file=sys.stderr)
        return 1
    
    try:
        node_info = client.get_node_info()
        if node_info and args.verbose:
            print(f"  Connected to: {node_info.get('name', 'unknown')}")
            print(f"  Node ID: {node_info.get('node_id', 'unknown')}")
        
        if args.send_full_json:
            # Send full JSON payload
            print("\nSending full JSON payload...")
            if client.send_json(payload, channel_index=channel, hop_limit=args.hop_limit):
                print("Payload sent successfully.")
            else:
                print("Error: Failed to send payload", file=sys.stderr)
                return 1
        else:
            # Send individual bulletins as formatted text
            print(f"\nSending {len(bulletins)} bulletin(s)...")
            
            for i, bulletin in enumerate(bulletins, 1):
                formatted = format_bulletin_for_tx(bulletin)
                
                if args.verbose:
                    print(f"\n--- Bulletin {i} ---")
                    print(formatted)
                
                if client.send_text(formatted, channel_index=channel, hop_limit=args.hop_limit):
                    print(f"Bulletin {i}/{len(bulletins)} sent.")
                else:
                    print(f"Error: Failed to send bulletin {i}", file=sys.stderr)
            
            print("\nTransmission complete.")
    
    finally:
        client.disconnect()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
