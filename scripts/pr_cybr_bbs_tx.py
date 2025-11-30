#!/usr/bin/env python3
"""
PR-CYBR-BBS Transmission Script

Transmits generated BBS payloads over Meshtastic Channels 1-6.
Designed to run on a Raspberry Pi connected to a Meshtastic device.

Usage:
    python scripts/pr_cybr_bbs_tx.py --channel N [--dry-run]
    python scripts/pr_cybr_bbs_tx.py --all-channels [--dry-run]
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
        return {"channels": {}}
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def load_channel_payload(input_dir: Path, channel_num: int) -> dict[str, Any] | None:
    """Load channel payload from JSON file."""
    # Try configured filename first
    filenames = [
        f"channel-{channel_num}.json",
        f"channel_{channel_num}.json"
    ]
    
    for filename in filenames:
        path = input_dir / filename
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
    
    return None


def format_item_for_tx(item: dict[str, Any], channel_name: str) -> str:
    """
    Format an item for transmission.
    
    Creates a compact text representation suitable for Meshtastic.
    
    Args:
        item: Item dictionary.
        channel_name: Name of the channel.
    
    Returns:
        Formatted text string.
    """
    category = item.get("category", "INFO")[:3]
    title = item.get("title", "")
    body = item.get("body", "")
    
    # Truncate body if too long
    max_body_len = 120
    if len(body) > max_body_len:
        body = body[:max_body_len - 3] + "..."
    
    # Include tags if present
    tags = item.get("tags", [])
    tag_str = ""
    if tags:
        tag_str = " #" + " #".join(tags[:3])
    
    return f"[{channel_name}:{category}] {title}{tag_str}\n{body}"


def transmit_channel(
    client: meshtastic_client.MeshtasticClient,
    channel_num: int,
    channel_name: str,
    payload: dict[str, Any],
    send_full_json: bool = False,
    hop_limit: int | None = None,
    verbose: bool = False
) -> bool:
    """
    Transmit payload for a single channel.
    
    Args:
        client: Connected Meshtastic client.
        channel_num: Channel number.
        channel_name: Channel name.
        payload: Payload dictionary.
        send_full_json: Send full JSON instead of formatted text.
        hop_limit: Override hop limit.
        verbose: Verbose output.
    
    Returns:
        True if successful, False otherwise.
    """
    items = payload.get("items", [])
    
    if not items:
        print(f"  Channel {channel_num} ({channel_name}): No items to transmit")
        return True
    
    if send_full_json:
        print(f"  Channel {channel_num} ({channel_name}): Sending full JSON...")
        if client.send_json(payload, channel_index=channel_num, hop_limit=hop_limit):
            print(f"    Sent successfully")
            return True
        else:
            print(f"    Failed to send", file=sys.stderr)
            return False
    else:
        print(f"  Channel {channel_num} ({channel_name}): Sending {len(items)} item(s)...")
        
        success = True
        for i, item in enumerate(items, 1):
            formatted = format_item_for_tx(item, channel_name)
            
            if verbose:
                print(f"    --- Item {i} ---")
                print(f"    {formatted}")
            
            if client.send_text(formatted, channel_index=channel_num, hop_limit=hop_limit):
                print(f"    Item {i}/{len(items)} sent")
            else:
                print(f"    Item {i}/{len(items)} FAILED", file=sys.stderr)
                success = False
        
        return success


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Transmit PR-CYBR-BBS payloads over Meshtastic"
    )
    parser.add_argument(
        "--channel",
        type=int,
        choices=[1, 2, 3, 4, 5, 6],
        default=None,
        help="Transmit for specific channel only (1-6)"
    )
    parser.add_argument(
        "--all-channels",
        action="store_true",
        help="Transmit for all channels (1-6)"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root / "config" / "pr_cybr_bbs_channels.yml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=repo_root / "out" / "pr-cybr-bbs",
        help="Directory containing channel JSON files"
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
    
    # Validate arguments
    if not args.channel and not args.all_channels:
        print("Error: Must specify --channel N or --all-channels", file=sys.stderr)
        return 1
    
    # Load configuration
    config = load_config(args.config)
    channels = config.get("channels", {})
    
    # Determine which channels to process
    if args.all_channels:
        channel_nums = sorted(channels.keys())
    else:
        channel_nums = [args.channel]
    
    print(f"PR-CYBR-BBS Transmission")
    print(f"  Input: {args.input_dir}")
    print(f"  Channels: {channel_nums}")
    
    # Load payloads for all channels
    payloads = {}
    for channel_num in channel_nums:
        payload = load_channel_payload(args.input_dir, channel_num)
        if payload:
            payloads[channel_num] = payload
            if args.verbose:
                print(f"  Channel {channel_num}: {len(payload.get('items', []))} items")
        else:
            print(f"  Warning: No payload found for channel {channel_num}", file=sys.stderr)
    
    if not payloads:
        print("No payloads to transmit.")
        return 0
    
    if args.dry_run:
        print("\n=== DRY RUN - No actual transmission ===\n")
        
        for channel_num, payload in payloads.items():
            channel_config = channels.get(channel_num, {})
            channel_name = channel_config.get("name", f"CHANNEL-{channel_num}")
            items = payload.get("items", [])
            
            print(f"Channel {channel_num} ({channel_name}): {len(items)} item(s)")
            
            if args.send_full_json:
                print(f"  Would send full JSON payload ({len(json.dumps(payload))} bytes)")
            else:
                for i, item in enumerate(items[:3], 1):  # Show first 3 items
                    formatted = format_item_for_tx(item, channel_name)
                    print(f"  --- Item {i} ---")
                    print(f"  {formatted[:200]}...")
                if len(items) > 3:
                    print(f"  ... and {len(items) - 3} more item(s)")
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
        
        print("\nTransmitting...")
        success = True
        
        for channel_num, payload in payloads.items():
            channel_config = channels.get(channel_num, {})
            channel_name = channel_config.get("name", f"CHANNEL-{channel_num}")
            
            if not transmit_channel(
                client,
                channel_num,
                channel_name,
                payload,
                send_full_json=args.send_full_json,
                hop_limit=args.hop_limit,
                verbose=args.verbose
            ):
                success = False
        
        print("\nTransmission complete.")
        return 0 if success else 1
    
    finally:
        client.disconnect()


if __name__ == "__main__":
    sys.exit(main())
