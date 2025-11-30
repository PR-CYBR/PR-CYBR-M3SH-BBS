#!/usr/bin/env python3
"""
Dashboard State Exporter Script

Reads BBS output files and generates a consolidated state.json file
for the dashboard to consume.

Usage:
    python scripts/export_dashboard_state.py [--output OUTPUT]
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def get_env_or_default(key: str, default: Any = None) -> Any:
    """Get environment variable or return default."""
    return os.environ.get(key, default)


def load_json_file(filepath: Path) -> dict | None:
    """Load a JSON file and return its contents, or None on error."""
    try:
        if filepath.exists():
            with open(filepath, "r") as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to load {filepath}: {e}", file=sys.stderr)
    return None


def count_items_in_json(data: dict | None, key: str = "bulletins") -> int:
    """Count items in a JSON structure."""
    if data is None:
        return 0
    items = data.get(key, [])
    if isinstance(items, list):
        return len(items)
    return 0


def export_dashboard_state(
    repo_root: Path,
    output_path: Path,
    workflow_type: str | None = None
) -> dict:
    """
    Generate the dashboard state file.
    
    Args:
        repo_root: Path to the repository root.
        output_path: Path where state.json should be written.
        workflow_type: Optional type of workflow that triggered this ('mesh', 'cybr', 'both').
    
    Returns:
        The generated state dictionary.
    """
    # Get GitHub Actions environment variables if available
    run_id = get_env_or_default("GITHUB_RUN_ID")
    workflow = get_env_or_default("GITHUB_WORKFLOW")
    run_started = get_env_or_default("GITHUB_RUN_STARTED_AT")
    
    # Current timestamp
    now = datetime.now(timezone.utc).isoformat()
    
    # Load existing state if present
    existing_state = load_json_file(output_path) or {}
    
    # Initialize new state structure
    state = {
        "generated_at": now,
        "mesh_public": existing_state.get("mesh_public", {
            "last_run": None,
            "last_status": None,
            "last_run_id": None,
            "bulletin_count": 0
        }),
        "cybr_private": existing_state.get("cybr_private", {
            "last_run": None,
            "last_status": None,
            "channel_counts": {
                "1": 0,
                "2": 0,
                "3": 0,
                "4": 0,
                "5": 0,
                "6": 0
            }
        })
    }
    
    # Check and update PR-MESH-BBS data
    mesh_bulletins_path = repo_root / "out" / "pr-mesh-bbs" / "bulletins.json"
    mesh_data = load_json_file(mesh_bulletins_path)
    
    if mesh_data:
        bulletin_count = count_items_in_json(mesh_data, "bulletins")
        
        # Update mesh_public section if this is a mesh workflow or we have new data
        if workflow_type in (None, "mesh", "both") or bulletin_count > 0:
            state["mesh_public"] = {
                "last_run": run_started or now,
                "last_status": "success",
                "last_run_id": int(run_id) if run_id else None,
                "bulletin_count": bulletin_count,
                "generated_at": mesh_data.get("generated_at")
            }
    
    # Check and update PR-CYBR-BBS data
    channel_counts = {}
    cybr_output_dir = repo_root / "out" / "pr-cybr-bbs"
    
    for channel_num in range(1, 7):
        channel_path = cybr_output_dir / f"channel-{channel_num}.json"
        channel_data = load_json_file(channel_path)
        
        if channel_data:
            item_count = count_items_in_json(channel_data, "items")
            channel_counts[str(channel_num)] = item_count
        else:
            # Keep existing count if file doesn't exist
            existing_counts = state["cybr_private"].get("channel_counts", {})
            channel_counts[str(channel_num)] = existing_counts.get(str(channel_num), 0)
    
    # Update cybr_private section if we found any data
    if any(count > 0 for count in channel_counts.values()) or workflow_type in (None, "cybr", "both"):
        state["cybr_private"] = {
            "last_run": run_started or now,
            "last_status": "success",
            "channel_counts": channel_counts
        }
        if run_id:
            state["cybr_private"]["last_run_id"] = int(run_id)
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write the state file
    with open(output_path, "w") as f:
        json.dump(state, f, indent=2)
    
    return state


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Export dashboard state from BBS output files"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "dashboard" / "state.json",
        help="Output path for state.json"
    )
    parser.add_argument(
        "--workflow-type",
        choices=["mesh", "cybr", "both"],
        default=None,
        help="Type of workflow that triggered this run"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        print(f"Repository root: {repo_root}")
        print(f"Output path: {args.output}")
        if args.workflow_type:
            print(f"Workflow type: {args.workflow_type}")
    
    state = export_dashboard_state(
        repo_root=repo_root,
        output_path=args.output,
        workflow_type=args.workflow_type
    )
    
    if args.verbose:
        print("\nGenerated state:")
        print(json.dumps(state, indent=2))
    
    print(f"Dashboard state exported to: {args.output}")
    
    # Print summary
    mesh_count = state.get("mesh_public", {}).get("bulletin_count", 0)
    channel_counts = state.get("cybr_private", {}).get("channel_counts", {})
    total_private = sum(channel_counts.values())
    
    print(f"  PR-MESH-BBS bulletins: {mesh_count}")
    print(f"  PR-CYBR-BBS items: {total_private} (across {len(channel_counts)} channels)")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
