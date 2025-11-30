#!/usr/bin/env python3
"""
PR-CYBR-BBS QR Code Generator

Generates QR codes for joining PR-CYBR-BBS Meshtastic channels.
QR codes encode channel configuration for easy mobile app scanning.

Usage:
    python scripts/generate_pr_cybr_qr_codes.py [--config CONFIG] [--output-dir DIR]
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

import yaml

try:
    import qrcode
    from qrcode.image.pure import PyPNGImage
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False


def load_config(config_path: Path) -> dict[str, Any]:
    """Load channel configuration from YAML file."""
    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def generate_meshtastic_url(
    channel_name: str,
    psk: str | None = None,
    modem_preset: str = "ShortFast"
) -> str:
    """
    Generate a Meshtastic channel URL for QR encoding.
    
    The URL format follows Meshtastic's channel sharing specification.
    
    Args:
        channel_name: Name of the channel.
        psk: Pre-shared key (optional).
        modem_preset: Modem preset (e.g., ShortFast, MediumSlow).
    
    Returns:
        Meshtastic channel URL string.
    """
    # Build channel configuration
    # This follows the Meshtastic protobuf channel settings format
    
    # For now, create a simple URL-based format
    # The actual Meshtastic app uses a more complex protobuf-encoded format
    
    # Placeholder format - in production, this should use proper protobuf encoding
    config = {
        "name": channel_name,
        "modem_preset": modem_preset
    }
    
    if psk:
        # PSK should be base64 encoded
        config["psk"] = psk
    
    # Encode as base64 JSON for now
    # Note: Real Meshtastic uses protobuf, this is a simplified version
    config_json = json.dumps(config)
    config_b64 = base64.urlsafe_b64encode(config_json.encode()).decode()
    
    # Meshtastic URL format
    return f"https://meshtastic.org/e/#{config_b64}"


def generate_qr_code(
    content: str,
    output_path: Path,
    box_size: int = 10,
    border: int = 4
) -> bool:
    """
    Generate a QR code and save to file.
    
    Args:
        content: Content to encode in QR code.
        output_path: Path to save the QR code image.
        box_size: Size of each box in pixels.
        border: Border size in modules.
    
    Returns:
        True if successful, False otherwise.
    """
    if not QRCODE_AVAILABLE:
        print("Error: qrcode package not installed", file=sys.stderr)
        print("Install with: pip install qrcode[pil]", file=sys.stderr)
        return False
    
    try:
        qr = qrcode.QRCode(
            version=None,  # Auto-determine
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=box_size,
            border=border
        )
        qr.add_data(content)
        qr.make(fit=True)
        
        # Try to use PIL first, fall back to pure Python PNG
        try:
            img = qr.make_image(fill_color="black", back_color="white")
        except Exception:
            img = qr.make_image(image_factory=PyPNGImage)
        
        # Ensure parent directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        img.save(str(output_path))
        return True
        
    except Exception as e:
        print(f"Error generating QR code: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    
    parser = argparse.ArgumentParser(
        description="Generate QR codes for PR-CYBR-BBS channels"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=repo_root / "config" / "pr_cybr_bbs_channels.yml",
        help="Path to channel configuration file"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory for QR codes (overrides config)"
    )
    parser.add_argument(
        "--format",
        choices=["png"],
        default="png",
        help="Output format (currently only PNG supported)"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    if not QRCODE_AVAILABLE:
        print("Error: qrcode package not available", file=sys.stderr)
        print("Install with: pip install qrcode[pil]", file=sys.stderr)
        return 1
    
    # Load configuration
    config = load_config(args.config)
    channels = config.get("channels", {})
    qr_config = config.get("qr", {})
    
    # Determine output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        output_dir = repo_root / qr_config.get("output_directory", "assets/qr/pr-cybr-bbs")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    box_size = qr_config.get("box_size", 10)
    border = qr_config.get("border", 4)
    
    print(f"PR-CYBR-BBS QR Code Generator")
    print(f"  Config: {args.config}")
    print(f"  Output: {output_dir}")
    print(f"  Channels: {len(channels)}")
    
    generated_count = 0
    
    for channel_num, channel_config in sorted(channels.items()):
        channel_name = channel_config.get("name", f"CHANNEL-{channel_num}")
        modem_preset = channel_config.get("modem_preset", "ShortFast")
        
        # Get PSK from environment variable if configured
        psk = None
        env_var = f"MESH_CH{channel_num}_PSK"
        if env_var in os.environ:
            psk = os.environ[env_var]
        
        if args.verbose:
            print(f"\nChannel {channel_num} ({channel_name}):")
            print(f"  Modem preset: {modem_preset}")
            print(f"  PSK: {'set from ' + env_var if psk else 'not set'}")
        
        # Generate Meshtastic URL
        url = generate_meshtastic_url(channel_name, psk, modem_preset)
        
        if args.verbose:
            print(f"  URL: {url[:60]}...")
        
        # Generate QR code
        filename = f"channel-{channel_num}-{channel_name}.png"
        output_path = output_dir / filename
        
        if generate_qr_code(url, output_path, box_size, border):
            print(f"  Generated: {output_path}")
            generated_count += 1
        else:
            print(f"  Failed: {output_path}", file=sys.stderr)
    
    print(f"\nGenerated {generated_count}/{len(channels)} QR code(s)")
    
    if generated_count < len(channels):
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
