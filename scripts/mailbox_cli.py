#!/usr/bin/env python3
"""
MAILB0X Command-Line Interface

Provides CLI access to the encrypted mailbox system for Channel-6.
Used by the BBS agent/bot for managing user mailboxes.

Usage:
    python scripts/mailbox_cli.py add --to <id> --from <id> --body "..." --passphrase "<pw>"
    python scripts/mailbox_cli.py read --for <id> --passphrase "<pw>"
    python scripts/mailbox_cli.py list
    python scripts/mailbox_cli.py info --for <id>
"""

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Handle both package and standalone execution
try:
    from . import mailbox_ops
except ImportError:
    import mailbox_ops


def cmd_add(args: argparse.Namespace) -> int:
    """Add a new encrypted message to a mailbox."""
    mailbox_dir = Path(args.mailbox_dir)
    mailbox_path = mailbox_ops.get_mailbox_path(args.to, mailbox_dir)
    
    message = {
        "body": args.body,
        "from": getattr(args, "from"),  # 'from' is a reserved keyword
        "metadata": {
            "priority": args.priority,
            "ttl": args.ttl,
            "tags": ["mailbox"],
            "via": ["meshtastic"]
        }
    }
    
    try:
        msg_id = mailbox_ops.append_encrypted_message(
            mailbox_path,
            message,
            args.passphrase
        )
        print(f"Message added successfully.")
        print(f"  ID: {msg_id}")
        print(f"  To: {args.to}")
        print(f"  Mailbox: {mailbox_path}")
        return 0
        
    except Exception as e:
        print(f"Error adding message: {e}", file=sys.stderr)
        return 1


def cmd_read(args: argparse.Namespace) -> int:
    """Read and decrypt all messages in a mailbox."""
    mailbox_dir = Path(args.mailbox_dir)
    recipient_id = getattr(args, "for")  # 'for' is a reserved keyword
    mailbox_path = mailbox_ops.get_mailbox_path(recipient_id, mailbox_dir)
    
    if not mailbox_path.exists():
        print(f"No mailbox found for: {recipient_id}")
        return 0
    
    try:
        messages = mailbox_ops.decrypt_mailbox(mailbox_path, args.passphrase)
        
        if not messages:
            print(f"Mailbox for {recipient_id} is empty.")
            return 0
        
        print(f"Mailbox for {recipient_id}: {len(messages)} message(s)")
        print("=" * 50)
        
        for i, msg in enumerate(messages, 1):
            print(f"\n--- Message {i} ---")
            print(f"ID: {msg['id']}")
            print(f"From: {msg['from']}")
            print(f"Sent: {msg['sent_at']}")
            
            metadata = msg.get('metadata', {})
            if metadata:
                print(f"Priority: {metadata.get('priority', 'normal')}")
            
            print(f"\n{msg['body']}")
            print()
        
        return 0
        
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error reading mailbox: {e}", file=sys.stderr)
        return 1


def cmd_list(args: argparse.Namespace) -> int:
    """List all mailboxes."""
    mailbox_dir = Path(args.mailbox_dir)
    
    recipients = mailbox_ops.list_mailboxes(mailbox_dir)
    
    if not recipients:
        print("No mailboxes found.")
        return 0
    
    print(f"Mailboxes ({len(recipients)}):")
    
    for recipient in recipients:
        mailbox_path = mailbox_ops.get_mailbox_path(recipient, mailbox_dir)
        info = mailbox_ops.get_mailbox_info(mailbox_path)
        
        if info:
            count = info.get('message_count', 0)
            print(f"  {recipient}: {count} message(s)")
        else:
            print(f"  {recipient}: (unable to read)")
    
    return 0


def cmd_info(args: argparse.Namespace) -> int:
    """Get information about a mailbox without decrypting."""
    mailbox_dir = Path(args.mailbox_dir)
    recipient_id = getattr(args, "for")
    mailbox_path = mailbox_ops.get_mailbox_path(recipient_id, mailbox_dir)
    
    info = mailbox_ops.get_mailbox_info(mailbox_path)
    
    if not info:
        print(f"No mailbox found for: {recipient_id}")
        return 0
    
    print(f"Mailbox Information for: {recipient_id}")
    print(f"  Path: {info['path']}")
    print(f"  Version: {info['version']}")
    print(f"  Cipher: {info['cipher']}")
    print(f"  KDF: {info['kdf']}")
    print(f"  Messages: {info['message_count']}")
    
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    """Delete a message from a mailbox."""
    mailbox_dir = Path(args.mailbox_dir)
    recipient_id = getattr(args, "for")
    mailbox_path = mailbox_ops.get_mailbox_path(recipient_id, mailbox_dir)
    
    if not mailbox_path.exists():
        print(f"No mailbox found for: {recipient_id}")
        return 1
    
    try:
        deleted = mailbox_ops.delete_message(
            mailbox_path,
            args.message_id,
            args.passphrase
        )
        
        if deleted:
            print(f"Message {args.message_id} deleted successfully.")
            return 0
        else:
            print(f"Message {args.message_id} not found.")
            return 1
            
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    default_mailbox_dir = repo_root / "data" / "mailboxes"
    
    parser = argparse.ArgumentParser(
        description="MAILB0X CLI - Encrypted mailbox management"
    )
    parser.add_argument(
        "--mailbox-dir",
        type=str,
        default=str(default_mailbox_dir),
        help="Directory containing mailbox files"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new message to a mailbox")
    add_parser.add_argument("--to", required=True, help="Recipient ID")
    add_parser.add_argument("--from", required=True, dest="from", help="Sender ID")
    add_parser.add_argument("--body", required=True, help="Message body")
    add_parser.add_argument("--passphrase", required=True, help="Encryption passphrase")
    add_parser.add_argument(
        "--priority",
        choices=["normal", "urgent"],
        default="normal",
        help="Message priority"
    )
    add_parser.add_argument(
        "--ttl",
        type=int,
        default=3600,
        help="Time to live in seconds"
    )
    
    # Read command
    read_parser = subparsers.add_parser("read", help="Read messages from a mailbox")
    read_parser.add_argument("--for", required=True, dest="for", help="Recipient ID")
    read_parser.add_argument("--passphrase", required=True, help="Decryption passphrase")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List all mailboxes")
    
    # Info command
    info_parser = subparsers.add_parser(
        "info",
        help="Get mailbox information without decrypting"
    )
    info_parser.add_argument("--for", required=True, dest="for", help="Recipient ID")
    
    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete a message from a mailbox")
    delete_parser.add_argument("--for", required=True, dest="for", help="Recipient ID")
    delete_parser.add_argument("--message-id", required=True, help="Message ID to delete")
    delete_parser.add_argument("--passphrase", required=True, help="Passphrase to verify access")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Dispatch to command handler
    commands = {
        "add": cmd_add,
        "read": cmd_read,
        "list": cmd_list,
        "info": cmd_info,
        "delete": cmd_delete
    }
    
    handler = commands.get(args.command)
    if handler:
        return handler(args)
    else:
        print(f"Unknown command: {args.command}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
