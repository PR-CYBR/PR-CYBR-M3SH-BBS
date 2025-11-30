#!/usr/bin/env python3
"""
BBS Output Validator Script

Validates JSON output files against expected schemas.
Used in CI to ensure generated content is well-formed.

Usage:
    python scripts/validate_bbs_output.py [--pr-mesh-bbs] [--pr-cybr-bbs] [--all]
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


class ValidationError(Exception):
    """Raised when validation fails."""
    pass


def validate_iso8601(value: str, field_name: str) -> None:
    """Validate an ISO 8601 timestamp string."""
    try:
        # Handle Z suffix
        dt_str = value.replace("Z", "+00:00")
        datetime.fromisoformat(dt_str)
    except ValueError as e:
        raise ValidationError(f"{field_name}: Invalid ISO 8601 timestamp: {value}")


def validate_required_fields(obj: dict, required: list[str], context: str) -> None:
    """Validate that all required fields are present."""
    for field in required:
        if field not in obj:
            raise ValidationError(f"{context}: Missing required field: {field}")


def validate_type(value: Any, expected_type: type, field_name: str) -> None:
    """Validate that a value has the expected type."""
    if not isinstance(value, expected_type):
        raise ValidationError(
            f"{field_name}: Expected {expected_type.__name__}, got {type(value).__name__}"
        )


def validate_enum(value: str, allowed: list[str], field_name: str) -> None:
    """Validate that a value is in an allowed list."""
    if value.lower() not in [a.lower() for a in allowed]:
        raise ValidationError(f"{field_name}: '{value}' not in allowed values: {allowed}")


def validate_pr_mesh_bbs_bulletin(bulletin: dict, index: int) -> list[str]:
    """
    Validate a single PR-MESH-BBS bulletin.
    
    Returns list of warnings (non-fatal issues).
    """
    warnings = []
    context = f"bulletins[{index}]"
    
    # Required fields
    required = ["id", "category", "title", "body", "valid_from", "valid_until", "priority"]
    validate_required_fields(bulletin, required, context)
    
    # Type checks
    validate_type(bulletin["id"], str, f"{context}.id")
    validate_type(bulletin["category"], str, f"{context}.category")
    validate_type(bulletin["title"], str, f"{context}.title")
    validate_type(bulletin["body"], str, f"{context}.body")
    validate_type(bulletin["priority"], str, f"{context}.priority")
    
    # Validate category
    allowed_categories = ["ANNOUNCEMENT", "SITREP", "INFO"]
    try:
        validate_enum(bulletin["category"], allowed_categories, f"{context}.category")
    except ValidationError:
        warnings.append(f"{context}.category: '{bulletin['category']}' is non-standard")
    
    # Validate priority
    validate_enum(bulletin["priority"], ["low", "normal", "high"], f"{context}.priority")
    
    # Validate timestamps
    validate_iso8601(bulletin["valid_from"], f"{context}.valid_from")
    validate_iso8601(bulletin["valid_until"], f"{context}.valid_until")
    
    return warnings


def validate_pr_mesh_bbs(payload: dict) -> tuple[bool, list[str], list[str]]:
    """
    Validate a PR-MESH-BBS payload.
    
    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    errors = []
    warnings = []
    
    try:
        # Required top-level fields
        required = ["bbs", "generated_at", "schedule", "channel", "bulletins"]
        validate_required_fields(payload, required, "payload")
        
        # Validate bbs name
        if payload["bbs"] != "PR-MESH-BBS":
            warnings.append(f"bbs: Expected 'PR-MESH-BBS', got '{payload['bbs']}'")
        
        # Validate channel
        if payload["channel"] != 0:
            warnings.append(f"channel: Expected 0, got {payload['channel']}")
        
        # Validate generated_at
        validate_iso8601(payload["generated_at"], "generated_at")
        
        # Validate schedule
        validate_type(payload["schedule"], list, "schedule")
        
        # Validate bulletins
        validate_type(payload["bulletins"], list, "bulletins")
        
        for i, bulletin in enumerate(payload["bulletins"]):
            try:
                bulletin_warnings = validate_pr_mesh_bbs_bulletin(bulletin, i)
                warnings.extend(bulletin_warnings)
            except ValidationError as e:
                errors.append(str(e))
        
    except ValidationError as e:
        errors.append(str(e))
    
    return (len(errors) == 0, errors, warnings)


def validate_pr_cybr_bbs_item(item: dict, index: int) -> list[str]:
    """
    Validate a single PR-CYBR-BBS item.
    
    Returns list of warnings (non-fatal issues).
    """
    warnings = []
    context = f"items[{index}]"
    
    # Required fields
    required = ["id", "category", "title", "body", "valid_from", "valid_until"]
    validate_required_fields(item, required, context)
    
    # Type checks
    validate_type(item["id"], str, f"{context}.id")
    validate_type(item["category"], str, f"{context}.category")
    validate_type(item["title"], str, f"{context}.title")
    validate_type(item["body"], str, f"{context}.body")
    
    # Optional tags
    if "tags" in item:
        validate_type(item["tags"], list, f"{context}.tags")
    
    # Validate timestamps
    validate_iso8601(item["valid_from"], f"{context}.valid_from")
    validate_iso8601(item["valid_until"], f"{context}.valid_until")
    
    return warnings


def validate_pr_cybr_bbs(payload: dict) -> tuple[bool, list[str], list[str]]:
    """
    Validate a PR-CYBR-BBS channel payload.
    
    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    errors = []
    warnings = []
    
    try:
        # Required top-level fields
        required = ["bbs", "channel", "name", "generated_at", "schedule", "items"]
        validate_required_fields(payload, required, "payload")
        
        # Validate bbs name
        if payload["bbs"] != "PR-CYBR-BBS":
            warnings.append(f"bbs: Expected 'PR-CYBR-BBS', got '{payload['bbs']}'")
        
        # Validate channel
        channel = payload["channel"]
        if not isinstance(channel, int) or channel < 1 or channel > 6:
            errors.append(f"channel: Must be 1-6, got {channel}")
        
        # Validate generated_at
        validate_iso8601(payload["generated_at"], "generated_at")
        
        # Validate schedule
        validate_type(payload["schedule"], list, "schedule")
        
        # Validate items
        validate_type(payload["items"], list, "items")
        
        for i, item in enumerate(payload["items"]):
            try:
                item_warnings = validate_pr_cybr_bbs_item(item, i)
                warnings.extend(item_warnings)
            except ValidationError as e:
                errors.append(str(e))
        
    except ValidationError as e:
        errors.append(str(e))
    
    return (len(errors) == 0, errors, warnings)


def validate_file(file_path: Path, validator_func) -> tuple[bool, list[str], list[str]]:
    """
    Validate a JSON file.
    
    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    try:
        with open(file_path, "r") as f:
            payload = json.load(f)
        return validator_func(payload)
    except json.JSONDecodeError as e:
        return (False, [f"Invalid JSON: {e}"], [])
    except FileNotFoundError:
        return (False, [f"File not found: {file_path}"], [])


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Validate BBS JSON output files"
    )
    parser.add_argument(
        "--pr-mesh-bbs",
        action="store_true",
        help="Validate PR-MESH-BBS output"
    )
    parser.add_argument(
        "--pr-cybr-bbs",
        action="store_true",
        help="Validate PR-CYBR-BBS output"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Validate all outputs"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # If no specific validation requested, validate all
    if not args.pr_mesh_bbs and not args.pr_cybr_bbs:
        args.all = True
    
    total_errors = 0
    total_warnings = 0
    
    # Validate PR-MESH-BBS
    if args.all or args.pr_mesh_bbs:
        pr_mesh_path = repo_root / "out" / "pr-mesh-bbs" / "bulletins.json"
        
        if pr_mesh_path.exists():
            print(f"Validating: {pr_mesh_path}")
            is_valid, errors, warnings = validate_file(pr_mesh_path, validate_pr_mesh_bbs)
            
            for err in errors:
                print(f"  ERROR: {err}")
            for warn in warnings:
                print(f"  WARNING: {warn}")
            
            if is_valid and not warnings:
                print("  OK")
            
            total_errors += len(errors)
            total_warnings += len(warnings)
        else:
            if args.verbose:
                print(f"Skipping (not found): {pr_mesh_path}")
    
    # Validate PR-CYBR-BBS
    if args.all or args.pr_cybr_bbs:
        pr_cybr_dir = repo_root / "out" / "pr-cybr-bbs"
        
        if pr_cybr_dir.exists():
            for channel_file in sorted(pr_cybr_dir.glob("channel-*.json")):
                print(f"Validating: {channel_file}")
                is_valid, errors, warnings = validate_file(
                    channel_file, validate_pr_cybr_bbs
                )
                
                for err in errors:
                    print(f"  ERROR: {err}")
                for warn in warnings:
                    print(f"  WARNING: {warn}")
                
                if is_valid and not warnings:
                    print("  OK")
                
                total_errors += len(errors)
                total_warnings += len(warnings)
        else:
            if args.verbose:
                print(f"Skipping (not found): {pr_cybr_dir}")
    
    # Summary
    print()
    print(f"Validation complete: {total_errors} error(s), {total_warnings} warning(s)")
    
    if total_errors > 0:
        return 1
    
    if args.strict and total_warnings > 0:
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
