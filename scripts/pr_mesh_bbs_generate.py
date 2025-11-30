#!/usr/bin/env python3
"""
PR-MESH-BBS Generator Script

Generates JSON bulletin payloads from Markdown content files.
Reads content from data/pr-mesh-bbs/ and outputs to out/pr-mesh-bbs/bulletins.json

Usage:
    python scripts/pr_mesh_bbs_generate.py [--config CONFIG] [--output OUTPUT]
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
    # Match YAML frontmatter between --- delimiters
    pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
    match = re.match(pattern, content, re.DOTALL)
    
    if match:
        frontmatter = yaml.safe_load(match.group(1))
        body = match.group(2).strip()
        return frontmatter or {}, body
    
    # No frontmatter, entire content is body
    return {}, content.strip()


def load_bulletins_from_directory(
    directory: Path,
    default_category: str = "INFO",
    default_priority: str = "normal"
) -> list[dict[str, Any]]:
    """
    Load bulletins from Markdown files in a directory.
    
    Args:
        directory: Path to directory containing .md files.
        default_category: Default category if not specified in frontmatter.
        default_priority: Default priority if not specified in frontmatter.
    
    Returns:
        List of bulletin dictionaries.
    """
    bulletins = []
    
    if not directory.exists():
        return bulletins
    
    for md_file in sorted(directory.glob("*.md")):
        try:
            content = md_file.read_text()
            frontmatter, body = parse_markdown_frontmatter(content)
            
            # Generate ID if not in frontmatter
            bulletin_id = frontmatter.get("id", str(uuid.uuid4()))
            
            # Get category and priority
            category = frontmatter.get("category", default_category).upper()
            priority = frontmatter.get("priority", default_priority).lower()
            
            # Parse validity dates
            now = datetime.now(timezone.utc)
            valid_from = frontmatter.get("valid_from", now.isoformat())
            valid_until = frontmatter.get(
                "valid_until",
                (now + timedelta(hours=24)).isoformat()
            )
            
            # Convert datetime objects to strings if needed
            if isinstance(valid_from, datetime):
                valid_from = valid_from.isoformat()
            if isinstance(valid_until, datetime):
                valid_until = valid_until.isoformat()
            
            bulletin = {
                "id": bulletin_id,
                "category": category,
                "title": frontmatter.get("title", md_file.stem),
                "body": body,
                "valid_from": valid_from,
                "valid_until": valid_until,
                "priority": priority,
                "source_file": md_file.name
            }
            
            bulletins.append(bulletin)
            
        except Exception as e:
            print(f"Warning: Failed to parse {md_file}: {e}", file=sys.stderr)
    
    return bulletins


def filter_valid_bulletins(bulletins: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Filter bulletins to only include those currently valid.
    
    Args:
        bulletins: List of bulletin dictionaries.
    
    Returns:
        Filtered list of valid bulletins.
    """
    now = datetime.now(timezone.utc)
    valid = []
    
    for bulletin in bulletins:
        try:
            valid_from = datetime.fromisoformat(
                bulletin["valid_from"].replace("Z", "+00:00")
            )
            valid_until = datetime.fromisoformat(
                bulletin["valid_until"].replace("Z", "+00:00")
            )
            
            if valid_from <= now <= valid_until:
                valid.append(bulletin)
                
        except (ValueError, KeyError) as e:
            # Include bulletins with invalid dates
            print(
                f"Warning: Bulletin {bulletin.get('id')} has invalid dates: {e}",
                file=sys.stderr
            )
            valid.append(bulletin)
    
    return valid


def generate_bbs_payload(
    bulletins: list[dict[str, Any]],
    config: dict[str, Any]
) -> dict[str, Any]:
    """
    Generate the complete BBS JSON payload.
    
    Args:
        bulletins: List of bulletin dictionaries.
        config: BBS configuration.
    
    Returns:
        Complete BBS payload dictionary.
    """
    bbs_config = config.get("bbs", {})
    schedule = config.get("schedule", ["09:00", "18:00"])
    
    # Remove source_file from bulletins before output
    clean_bulletins = []
    for b in bulletins:
        clean = {k: v for k, v in b.items() if k != "source_file"}
        clean_bulletins.append(clean)
    
    return {
        "bbs": bbs_config.get("name", "PR-MESH-BBS"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schedule": schedule,
        "channel": bbs_config.get("channel", 0),
        "bulletins": clean_bulletins
    }


def main():
    """Main entry point."""
    # Determine script directory for relative paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Generate PR-MESH-BBS JSON bulletins from Markdown content"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root / "config" / "pr_mesh_bbs.yml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSON file path (overrides config)"
    )
    parser.add_argument(
        "--include-expired",
        action="store_true",
        help="Include expired bulletins in output"
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
    
    if args.verbose:
        print(f"Loaded config from: {args.config}")
    
    # Collect bulletins from all sources
    all_bulletins = []
    sources = config.get("sources", {})
    
    for source_name, source_config in sources.items():
        source_path = repo_root / source_config.get("path", f"data/pr-mesh-bbs/{source_name}")
        default_category = source_config.get("category", "INFO")
        default_priority = source_config.get("default_priority", "normal")
        
        if args.verbose:
            print(f"Loading bulletins from: {source_path}")
        
        bulletins = load_bulletins_from_directory(
            source_path,
            default_category,
            default_priority
        )
        
        if args.verbose:
            print(f"  Found {len(bulletins)} bulletin(s)")
        
        all_bulletins.extend(bulletins)
    
    # Filter to valid bulletins
    if not args.include_expired:
        all_bulletins = filter_valid_bulletins(all_bulletins)
        if args.verbose:
            print(f"After filtering: {len(all_bulletins)} valid bulletin(s)")
    
    # Sort by priority (high first) then by valid_from
    priority_order = {"high": 0, "normal": 1, "low": 2}
    all_bulletins.sort(
        key=lambda b: (priority_order.get(b["priority"], 1), b["valid_from"])
    )
    
    # Generate payload
    payload = generate_bbs_payload(all_bulletins, config)
    
    # Determine output path
    if args.output:
        output_path = args.output
    else:
        output_config = config.get("output", {})
        output_dir = repo_root / output_config.get("directory", "out/pr-mesh-bbs")
        output_filename = output_config.get("filename", "bulletins.json")
        output_path = output_dir / output_filename
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write output
    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)
    
    print(f"Generated {len(payload['bulletins'])} bulletin(s) -> {output_path}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
