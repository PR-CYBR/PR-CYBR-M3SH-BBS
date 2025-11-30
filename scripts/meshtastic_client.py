#!/usr/bin/env python3
"""
Meshtastic Client Helper Module

Provides a unified interface for connecting to Meshtastic devices
and transmitting JSON payloads over specified channels.

Configuration is read from config/hardware.yml and environment variables.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

import yaml


def load_hardware_config() -> dict[str, Any]:
    """Load hardware configuration from YAML file."""
    config_path = Path(__file__).parent.parent / "config" / "hardware.yml"
    
    if not config_path.exists():
        return {
            "serial": {"port": None, "baud": 115200, "timeout": 10},
            "runtime": {"default_hop_limit": 3, "max_message_size": 228}
        }
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def get_serial_port() -> str | None:
    """Get the serial port from environment or config."""
    # Environment variable takes precedence
    port = os.environ.get("MESH_SERIAL_PORT")
    if port:
        return port
    
    config = load_hardware_config()
    return config.get("serial", {}).get("port")


def get_baud_rate() -> int:
    """Get the baud rate from environment or config."""
    baud = os.environ.get("MESH_BAUD")
    if baud:
        return int(baud)
    
    config = load_hardware_config()
    return config.get("serial", {}).get("baud", 115200)


def get_default_hop_limit() -> int:
    """Get the default hop limit from config."""
    config = load_hardware_config()
    return config.get("runtime", {}).get("default_hop_limit", 3)


def get_max_message_size() -> int:
    """Get the maximum message size from config."""
    config = load_hardware_config()
    return config.get("runtime", {}).get("max_message_size", 228)


class MeshtasticClient:
    """
    Client for interacting with Meshtastic devices.
    
    This class wraps the Meshtastic Python API and provides
    a simplified interface for BBS operations.
    """
    
    def __init__(self, serial_port: str | None = None, baud_rate: int | None = None):
        """
        Initialize the Meshtastic client.
        
        Args:
            serial_port: Serial port path. If None, uses config/env.
            baud_rate: Baud rate. If None, uses config/env.
        """
        self.serial_port = serial_port or get_serial_port()
        self.baud_rate = baud_rate or get_baud_rate()
        self.interface = None
        self._connected = False
    
    def connect(self) -> bool:
        """
        Connect to the Meshtastic device.
        
        Returns:
            True if connection successful, False otherwise.
        """
        try:
            # Import here to allow module to load without meshtastic installed
            import meshtastic.serial_interface
            
            if self.serial_port:
                self.interface = meshtastic.serial_interface.SerialInterface(
                    devPath=self.serial_port
                )
            else:
                # Auto-detect if no port specified
                self.interface = meshtastic.serial_interface.SerialInterface()
            
            self._connected = True
            return True
            
        except ImportError:
            print("Error: meshtastic package not installed", file=sys.stderr)
            print("Install with: pip install meshtastic", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Error connecting to Meshtastic device: {e}", file=sys.stderr)
            return False
    
    def disconnect(self) -> None:
        """Disconnect from the Meshtastic device."""
        if self.interface:
            try:
                self.interface.close()
            except Exception:
                pass
            self.interface = None
            self._connected = False
    
    @property
    def is_connected(self) -> bool:
        """Check if currently connected."""
        return self._connected and self.interface is not None
    
    def send_text(
        self,
        message: str,
        channel_index: int = 0,
        hop_limit: int | None = None
    ) -> bool:
        """
        Send a text message on a specified channel.
        
        Args:
            message: Text message to send.
            channel_index: Channel index (0-7).
            hop_limit: Hop limit for the message.
        
        Returns:
            True if sent successfully, False otherwise.
        """
        if not self.is_connected:
            print("Error: Not connected to Meshtastic device", file=sys.stderr)
            return False
        
        if hop_limit is None:
            hop_limit = get_default_hop_limit()
        
        try:
            self.interface.sendText(
                text=message,
                channelIndex=channel_index,
                hopLimit=hop_limit
            )
            return True
        except Exception as e:
            print(f"Error sending message: {e}", file=sys.stderr)
            return False
    
    def send_json(
        self,
        json_obj: dict[str, Any],
        channel_index: int = 0,
        hop_limit: int | None = None
    ) -> bool:
        """
        Send a JSON payload on a specified channel.
        
        The JSON is serialized to a compact string before transmission.
        If the payload exceeds the maximum message size, it will be
        truncated with a warning.
        
        Args:
            json_obj: Dictionary to serialize and send.
            channel_index: Channel index (0-7).
            hop_limit: Hop limit for the message.
        
        Returns:
            True if sent successfully, False otherwise.
        """
        try:
            # Serialize to compact JSON
            message = json.dumps(json_obj, separators=(",", ":"))
            
            max_size = get_max_message_size()
            if len(message) > max_size:
                print(
                    f"Warning: Message size ({len(message)}) exceeds max ({max_size})",
                    file=sys.stderr
                )
                # Truncate with indicator
                message = message[:max_size - 3] + "..."
            
            return self.send_text(message, channel_index, hop_limit)
            
        except json.JSONEncodeError as e:
            print(f"Error serializing JSON: {e}", file=sys.stderr)
            return False
    
    def get_node_info(self) -> dict[str, Any] | None:
        """
        Get information about the connected node.
        
        Returns:
            Dictionary with node info, or None on error.
        """
        if not self.is_connected:
            return None
        
        try:
            node = self.interface.getMyNodeInfo()
            return {
                "node_id": node.get("user", {}).get("id", ""),
                "name": node.get("user", {}).get("longName", ""),
                "short_name": node.get("user", {}).get("shortName", ""),
                "hardware": node.get("user", {}).get("hwModel", ""),
            }
        except Exception:
            return None
    
    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
        return False


def create_client(
    serial_port: str | None = None,
    baud_rate: int | None = None
) -> MeshtasticClient:
    """
    Factory function to create a MeshtasticClient.
    
    Args:
        serial_port: Optional serial port override.
        baud_rate: Optional baud rate override.
    
    Returns:
        Configured MeshtasticClient instance.
    """
    return MeshtasticClient(serial_port, baud_rate)


# For testing/verification when run directly
if __name__ == "__main__":
    print("Meshtastic Client Configuration:")
    print(f"  Serial Port: {get_serial_port() or 'auto-detect'}")
    print(f"  Baud Rate: {get_baud_rate()}")
    print(f"  Default Hop Limit: {get_default_hop_limit()}")
    print(f"  Max Message Size: {get_max_message_size()}")
    
    print("\nTo test connection, use:")
    print("  client = MeshtasticClient()")
    print("  client.connect()")
