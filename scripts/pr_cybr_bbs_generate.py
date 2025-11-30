#!/usr/bin/env python3
"""
PR-CYBR-BBS Generator Script

Generates JSON payloads for each private BBS channel (1-6).
Reads content from data/pr-cybr-bbs/<channel>/ directories.

Usage:
    python scripts/pr_cybr_bbs_generate.py [--config CONFIG] [--channel N]
"""

import argparse
import json
import re
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import yaml


def load_config(config_path: Path) -> dict[str, Any]:
    """Load BBS configuration from YAML file."""
    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def parse_markdown_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """
    Parse YAML frontmatter and body from Markdown content.
    
    Args:
        content: Full Markdown file content.
    
    Returns:
        Tuple of (frontmatter dict, body string).
    """
    pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
    match = re.match(pattern, content, re.DOTALL)
    
    if match:
        frontmatter = yaml.safe_load(match.group(1))
        body = match.group(2).strip()
        return frontmatter or {}, body
    
    return {}, content.strip()


def load_items_from_directory(
    directory: Path,
    default_category: str = "INFO"
) -> list[dict[str, Any]]:
    """
    Load items from Markdown files in a directory.
    
    Args:
        directory: Path to directory containing .md files.
        default_category: Default category if not specified.
    
    Returns:
        List of item dictionaries.
    """
    items = []
    
    if not directory.exists():
        return items
    
    for md_file in sorted(directory.glob("*.md")):
        try:
            content = md_file.read_text()
            frontmatter, body = parse_markdown_frontmatter(content)
            
            item_id = frontmatter.get("id", str(uuid.uuid4()))
            category = frontmatter.get("category", default_category).upper()
            
            now = datetime.now(timezone.utc)
            valid_from = frontmatter.get("valid_from", now.isoformat())
            valid_until = frontmatter.get(
                "valid_until",
                (now + timedelta(hours=24)).isoformat()
            )
            
            if isinstance(valid_from, datetime):
                valid_from = valid_from.isoformat()
            if isinstance(valid_until, datetime):
                valid_until = valid_until.isoformat()
            
            # Get tags from frontmatter
            tags = frontmatter.get("tags", [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",")]
            
            item = {
                "id": item_id,
                "category": category,
                "title": frontmatter.get("title", md_file.stem),
                "body": body,
                "tags": tags,
                "valid_from": valid_from,
                "valid_until": valid_until
            }
            
            items.append(item)
            
        except Exception as e:
            print(f"Warning: Failed to parse {md_file}: {e}", file=sys.stderr)
    
    return items


def load_node_status(status_file: Path) -> list[dict[str, Any]]:
    """
    Load node status data and convert to items format.
    
    Args:
        status_file: Path to nodes.json file.
    
    Returns:
        List of status items.
    """
    if not status_file.exists():
        return []
    
    try:
        with open(status_file, "r") as f:
            status_data = json.load(f)
        
        items = []
        nodes = status_data.get("nodes", [])
        
        for node in nodes:
            item = {
                "id": f"node-{node.get('node_id', 'unknown')}",
                "category": "NODE_STATUS",
                "title": f"Node: {node.get('name', 'Unknown')}",
                "body": json.dumps(node, indent=2),
                "tags": node.get("tags", []),
                "valid_from": node.get("last_seen", datetime.now(timezone.utc).isoformat()),
                "valid_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            }
            items.append(item)
        
        return items
        
    except Exception as e:
        print(f"Warning: Failed to load node status: {e}", file=sys.stderr)
        return []


def generate_channel_payload(
    channel_num: int,
    channel_config: dict[str, Any],
    items: list[dict[str, Any]],
    schedule: list[str]
) -> dict[str, Any]:
    """
    Generate the JSON payload for a single channel.
    
    Args:
        channel_num: Channel number (1-6).
        channel_config: Channel configuration.
        items: List of items for this channel.
        schedule: Broadcast schedule.
    
    Returns:
        Channel payload dictionary.
    """
    return {
        "bbs": "PR-CYBR-BBS",
        "channel": channel_num,
        "name": channel_config.get("name", f"CHANNEL-{channel_num}"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schedule": schedule,
        "items": items
    }


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Generate PR-CYBR-BBS JSON payloads for private channels"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root / "config" / "pr_cybr_bbs_channels.yml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--channel",
        type=int,
        choices=[1, 2, 3, 4, 5, 6],
        default=None,
        help="Generate for specific channel only (1-6)"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (overrides config)"
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
    schedule = config.get("schedule", ["09:00", "12:00", "18:00"])
    channels = config.get("channels", {})
    
    # Determine output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        output_dir = repo_root / config.get("output", {}).get("directory", "out/pr-cybr-bbs")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine which channels to process
    if args.channel:
        channel_nums = [args.channel]
    else:
        channel_nums = sorted(channels.keys())
    
    print(f"PR-CYBR-BBS Generator")
    print(f"  Config: {args.config}")
    print(f"  Output: {output_dir}")
    print(f"  Channels: {channel_nums}")
    
    total_items = 0
    
    for channel_num in channel_nums:
        if channel_num not in channels:
            print(f"Warning: Channel {channel_num} not in config", file=sys.stderr)
            continue
        
        channel_config = channels[channel_num]
        channel_name = channel_config.get("name", f"CHANNEL-{channel_num}")
        source_path = repo_root / channel_config.get("source_path", f"data/pr-cybr-bbs/channel-{channel_num}")
        
        if args.verbose:
            print(f"\nChannel {channel_num} ({channel_name}):")
            print(f"  Source: {source_path}")
        
        # Load items from directory
        items = load_items_from_directory(source_path)
        
        # For M3SH-OPS (channel 4), also load node status
        if channel_num == 4:
            status_file = channel_config.get("status_file")
            if status_file:
                status_path = repo_root / status_file
                status_items = load_node_status(status_path)
                items.extend(status_items)
                if args.verbose:
                    print(f"  Status file: {status_path} ({len(status_items)} nodes)")
        
        if args.verbose:
            print(f"  Items: {len(items)}")
        
        # Generate payload
        payload = generate_channel_payload(channel_num, channel_config, items, schedule)
        
        # Write output
        output_file = channel_config.get("output_file", f"channel-{channel_num}.json")
        output_path = output_dir / output_file
        
        with open(output_path, "w") as f:
            json.dump(payload, f, indent=2)
        
        total_items += len(items)
        print(f"  Channel {channel_num}: {len(items)} item(s) -> {output_path}")
    
    print(f"\nTotal: {total_items} item(s) across {len(channel_nums)} channel(s)")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
