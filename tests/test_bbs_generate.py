"""
Tests for the BBS JSON generation.

Tests that generated JSON matches expected schemas.
"""

import json
import pytest
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timezone

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestPRMeshBBSGenerate:
    """Tests for PR-MESH-BBS JSON generation."""
    
    def test_parse_markdown_frontmatter(self):
        """Test YAML frontmatter parsing."""
        from pr_mesh_bbs_generate import parse_markdown_frontmatter
        
        content = """---
id: test-123
title: Test Bulletin
category: ANNOUNCEMENT
priority: high
---

This is the body content.
"""
        frontmatter, body = parse_markdown_frontmatter(content)
        
        assert frontmatter["id"] == "test-123"
        assert frontmatter["title"] == "Test Bulletin"
        assert frontmatter["category"] == "ANNOUNCEMENT"
        assert frontmatter["priority"] == "high"
        assert "body content" in body
    
    def test_parse_markdown_no_frontmatter(self):
        """Test parsing without frontmatter."""
        from pr_mesh_bbs_generate import parse_markdown_frontmatter
        
        content = "Just plain text content."
        frontmatter, body = parse_markdown_frontmatter(content)
        
        assert frontmatter == {}
        assert body == "Just plain text content."
    
    def test_generate_bbs_payload_structure(self):
        """Test BBS payload has required fields."""
        from pr_mesh_bbs_generate import generate_bbs_payload
        
        bulletins = [
            {
                "id": "test-1",
                "category": "INFO",
                "title": "Test",
                "body": "Body",
                "valid_from": "2024-01-01T00:00:00Z",
                "valid_until": "2024-12-31T23:59:59Z",
                "priority": "normal"
            }
        ]
        config = {
            "bbs": {"name": "PR-MESH-BBS", "channel": 0},
            "schedule": ["09:00", "18:00"]
        }
        
        payload = generate_bbs_payload(bulletins, config)
        
        assert payload["bbs"] == "PR-MESH-BBS"
        assert payload["channel"] == 0
        assert "generated_at" in payload
        assert payload["schedule"] == ["09:00", "18:00"]
        assert len(payload["bulletins"]) == 1


class TestPRCYBRBBSGenerate:
    """Tests for PR-CYBR-BBS JSON generation."""
    
    def test_generate_channel_payload_structure(self):
        """Test channel payload has required fields."""
        from pr_cybr_bbs_generate import generate_channel_payload
        
        items = [
            {
                "id": "item-1",
                "category": "OPS",
                "title": "Test Item",
                "body": "Body",
                "tags": ["test"],
                "valid_from": "2024-01-01T00:00:00Z",
                "valid_until": "2024-12-31T23:59:59Z"
            }
        ]
        channel_config = {"name": "OPS-SITREP"}
        schedule = ["09:00", "12:00", "18:00"]
        
        payload = generate_channel_payload(1, channel_config, items, schedule)
        
        assert payload["bbs"] == "PR-CYBR-BBS"
        assert payload["channel"] == 1
        assert payload["name"] == "OPS-SITREP"
        assert "generated_at" in payload
        assert payload["schedule"] == schedule
        assert len(payload["items"]) == 1


class TestM3SHOpsReport:
    """Tests for M3SH-OPS report generation."""
    
    def test_calculate_network_stats(self):
        """Test network statistics calculation."""
        from m3sh_ops_report import calculate_network_stats
        
        nodes = [
            {"battery": 0.8, "rssi": -90, "snr": 8.0, "last_seen": datetime.now(timezone.utc).isoformat()},
            {"battery": 0.6, "rssi": -95, "snr": 6.0, "last_seen": datetime.now(timezone.utc).isoformat()},
        ]
        
        stats = calculate_network_stats(nodes)
        
        assert stats["total_nodes"] == 2
        assert stats["online_nodes"] == 2
        assert stats["avg_battery"] == 0.7
        assert stats["avg_rssi"] == -92.5
        assert stats["avg_snr"] == 7.0
    
    def test_calculate_network_stats_empty(self):
        """Test stats with no nodes."""
        from m3sh_ops_report import calculate_network_stats
        
        stats = calculate_network_stats([])
        
        assert stats["total_nodes"] == 0
        assert stats["online_nodes"] == 0


class TestValidateBBSOutput:
    """Tests for JSON validation."""
    
    def test_validate_pr_mesh_bbs_valid(self):
        """Test validation of valid PR-MESH-BBS payload."""
        from validate_bbs_output import validate_pr_mesh_bbs
        
        payload = {
            "bbs": "PR-MESH-BBS",
            "generated_at": "2024-01-15T12:00:00Z",
            "schedule": ["09:00", "18:00"],
            "channel": 0,
            "bulletins": [
                {
                    "id": "test-1",
                    "category": "ANNOUNCEMENT",
                    "title": "Test",
                    "body": "Body",
                    "valid_from": "2024-01-01T00:00:00Z",
                    "valid_until": "2024-12-31T23:59:59Z",
                    "priority": "normal"
                }
            ]
        }
        
        is_valid, errors, warnings = validate_pr_mesh_bbs(payload)
        
        assert is_valid
        assert len(errors) == 0
    
    def test_validate_pr_mesh_bbs_missing_field(self):
        """Test validation catches missing required field."""
        from validate_bbs_output import validate_pr_mesh_bbs
        
        payload = {
            "bbs": "PR-MESH-BBS",
            "generated_at": "2024-01-15T12:00:00Z",
            # Missing "schedule", "channel", "bulletins"
        }
        
        is_valid, errors, warnings = validate_pr_mesh_bbs(payload)
        
        assert not is_valid
        assert len(errors) > 0
    
    def test_validate_pr_cybr_bbs_valid(self):
        """Test validation of valid PR-CYBR-BBS payload."""
        from validate_bbs_output import validate_pr_cybr_bbs
        
        payload = {
            "bbs": "PR-CYBR-BBS",
            "channel": 1,
            "name": "OPS-SITREP",
            "generated_at": "2024-01-15T12:00:00Z",
            "schedule": ["09:00", "12:00", "18:00"],
            "items": [
                {
                    "id": "item-1",
                    "category": "OPS",
                    "title": "Test",
                    "body": "Body",
                    "valid_from": "2024-01-01T00:00:00Z",
                    "valid_until": "2024-12-31T23:59:59Z"
                }
            ]
        }
        
        is_valid, errors, warnings = validate_pr_cybr_bbs(payload)
        
        assert is_valid
        assert len(errors) == 0
