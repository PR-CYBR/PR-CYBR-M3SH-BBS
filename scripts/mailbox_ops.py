#!/usr/bin/env python3
"""
Mailbox Operations Module

Provides file-based operations for the encrypted MAILB0X system.
Handles loading, saving, and managing encrypted mailbox files.

Mailbox files are stored in data/mailboxes/<recipient_id>.json
Each message body is encrypted with the recipient's passphrase.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Handle both package and standalone execution
try:
    from . import mailbox_crypto
except ImportError:
    import mailbox_crypto


# Default mailbox directory
DEFAULT_MAILBOX_DIR = Path(__file__).parent.parent / "data" / "mailboxes"


def get_mailbox_path(recipient_id: str, mailbox_dir: Path | None = None) -> Path:
    """
    Get the file path for a recipient's mailbox.
    
    Args:
        recipient_id: Recipient identifier (node ID or user ID).
        mailbox_dir: Optional override for mailbox directory.
    
    Returns:
        Path to the mailbox JSON file.
    """
    if mailbox_dir is None:
        mailbox_dir = DEFAULT_MAILBOX_DIR
    
    # Sanitize recipient_id for filename
    safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in recipient_id)
    return mailbox_dir / f"{safe_id}.json"


def create_empty_mailbox(passphrase: str) -> dict[str, Any]:
    """
    Create a new empty mailbox structure.
    
    Args:
        passphrase: Passphrase to use for this mailbox.
    
    Returns:
        Dictionary with mailbox structure.
    """
    # Generate a mailbox-level salt for future use
    salt = mailbox_crypto.generate_salt()
    
    return {
        "version": 1,
        "cipher": mailbox_crypto.get_cipher_name(),
        "kdf": mailbox_crypto.get_kdf_name(),
        "salt": mailbox_crypto.base64.b64encode(salt).decode("ascii"),
        "mail": []
    }


def load_mailbox(mailbox_path: Path) -> dict[str, Any]:
    """
    Load a mailbox from file.
    
    Args:
        mailbox_path: Path to the mailbox JSON file.
    
    Returns:
        Mailbox dictionary.
    
    Raises:
        FileNotFoundError: If mailbox file doesn't exist.
        json.JSONDecodeError: If mailbox file is invalid JSON.
    """
    with open(mailbox_path, "r") as f:
        return json.load(f)


def save_mailbox(mailbox_path: Path, mailbox: dict[str, Any]) -> None:
    """
    Save a mailbox to file.
    
    Args:
        mailbox_path: Path to save the mailbox.
        mailbox: Mailbox dictionary to save.
    """
    # Ensure directory exists
    mailbox_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(mailbox_path, "w") as f:
        json.dump(mailbox, f, indent=2)


def append_encrypted_message(
    mailbox_path: Path,
    message_dict: dict[str, Any],
    passphrase: str
) -> str:
    """
    Append an encrypted message to a mailbox.
    
    If the mailbox doesn't exist, it will be created.
    The message body is encrypted using the provided passphrase.
    
    Args:
        mailbox_path: Path to the mailbox file.
        message_dict: Message to add. Must contain:
            - body: The message body (will be encrypted)
            - from: Sender identifier
            Optionally:
            - metadata: Additional metadata dict
        passphrase: Passphrase for encryption.
    
    Returns:
        The message ID assigned to the new message.
    
    Raises:
        ValueError: If message_dict is missing required fields.
    """
    if "body" not in message_dict:
        raise ValueError("Message must contain 'body' field")
    if "from" not in message_dict:
        raise ValueError("Message must contain 'from' field")
    
    # Load or create mailbox
    if mailbox_path.exists():
        mailbox = load_mailbox(mailbox_path)
    else:
        mailbox = create_empty_mailbox(passphrase)
    
    # Generate message ID
    message_id = str(uuid.uuid4())
    
    # Encrypt the body
    encrypted = mailbox_crypto.encrypt_to_base64(passphrase, message_dict["body"])
    
    # Create mail record
    mail_record = {
        "id": message_id,
        "enc_body": encrypted["enc_body"],
        "iv": encrypted["iv"],
        "salt": encrypted["salt"],  # Per-message salt
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "from": message_dict["from"],
        "metadata": message_dict.get("metadata", {})
    }
    
    # Append to mail list
    mailbox["mail"].append(mail_record)
    
    # Save mailbox
    save_mailbox(mailbox_path, mailbox)
    
    return message_id


def decrypt_mailbox(
    mailbox_path: Path,
    passphrase: str
) -> list[dict[str, Any]]:
    """
    Decrypt all messages in a mailbox.
    
    Args:
        mailbox_path: Path to the mailbox file.
        passphrase: Passphrase for decryption.
    
    Returns:
        List of decrypted message dictionaries.
        Each message includes all original fields with 'body' decrypted.
    
    Raises:
        FileNotFoundError: If mailbox doesn't exist.
        ValueError: If decryption fails.
    """
    mailbox = load_mailbox(mailbox_path)
    
    decrypted_messages = []
    
    for mail_record in mailbox.get("mail", []):
        try:
            # Decrypt the body
            plaintext = mailbox_crypto.decrypt_from_base64(
                passphrase,
                mail_record["salt"],
                mail_record["iv"],
                mail_record["enc_body"]
            )
            
            # Create decrypted message
            decrypted = {
                "id": mail_record["id"],
                "body": plaintext,
                "sent_at": mail_record["sent_at"],
                "from": mail_record["from"],
                "metadata": mail_record.get("metadata", {})
            }
            
            decrypted_messages.append(decrypted)
            
        except ValueError as e:
            # Re-raise with message ID for debugging
            raise ValueError(
                f"Failed to decrypt message {mail_record.get('id', 'unknown')}: {e}"
            ) from e
    
    return decrypted_messages


def get_mailbox_info(mailbox_path: Path) -> dict[str, Any] | None:
    """
    Get metadata about a mailbox without decrypting.
    
    Args:
        mailbox_path: Path to the mailbox file.
    
    Returns:
        Dictionary with mailbox info, or None if not found.
    """
    if not mailbox_path.exists():
        return None
    
    mailbox = load_mailbox(mailbox_path)
    
    return {
        "version": mailbox.get("version"),
        "cipher": mailbox.get("cipher"),
        "kdf": mailbox.get("kdf"),
        "message_count": len(mailbox.get("mail", [])),
        "path": str(mailbox_path)
    }


def list_mailboxes(mailbox_dir: Path | None = None) -> list[str]:
    """
    List all recipient IDs that have mailboxes.
    
    Args:
        mailbox_dir: Optional override for mailbox directory.
    
    Returns:
        List of recipient IDs.
    """
    if mailbox_dir is None:
        mailbox_dir = DEFAULT_MAILBOX_DIR
    
    if not mailbox_dir.exists():
        return []
    
    recipients = []
    for file in mailbox_dir.glob("*.json"):
        # Remove .json extension to get recipient ID
        recipients.append(file.stem)
    
    return sorted(recipients)


def delete_message(
    mailbox_path: Path,
    message_id: str,
    passphrase: str
) -> bool:
    """
    Delete a message from a mailbox.
    
    Requires passphrase to verify access before deletion.
    
    Args:
        mailbox_path: Path to the mailbox file.
        message_id: ID of the message to delete.
        passphrase: Passphrase to verify access.
    
    Returns:
        True if message was deleted, False if not found.
    
    Raises:
        FileNotFoundError: If mailbox doesn't exist.
        ValueError: If passphrase is incorrect.
    """
    mailbox = load_mailbox(mailbox_path)
    
    # Find and verify we can decrypt at least one message
    # (confirms passphrase is correct)
    mail_list = mailbox.get("mail", [])
    
    if mail_list:
        # Try to decrypt first message to verify passphrase
        first = mail_list[0]
        try:
            mailbox_crypto.decrypt_from_base64(
                passphrase,
                first["salt"],
                first["iv"],
                first["enc_body"]
            )
        except ValueError:
            raise ValueError("Incorrect passphrase")
    
    # Find and remove the message
    original_count = len(mail_list)
    mailbox["mail"] = [m for m in mail_list if m.get("id") != message_id]
    
    if len(mailbox["mail"]) < original_count:
        save_mailbox(mailbox_path, mailbox)
        return True
    
    return False


# For testing when run directly
if __name__ == "__main__":
    import tempfile
    
    print("Mailbox Operations Module")
    print(f"  Default mailbox dir: {DEFAULT_MAILBOX_DIR}")
    
    # Quick self-test
    print("\nRunning self-test...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        test_dir = Path(tmpdir)
        test_path = test_dir / "test_user.json"
        test_passphrase = "test-password-123"
        
        # Add a message
        msg_id = append_encrypted_message(
            test_path,
            {
                "body": "Hello, this is a test message!",
                "from": "sender_node",
                "metadata": {"priority": "normal"}
            },
            test_passphrase
        )
        print(f"  Added message: {msg_id}")
        
        # Get mailbox info
        info = get_mailbox_info(test_path)
        print(f"  Mailbox info: {info}")
        
        # Decrypt messages
        messages = decrypt_mailbox(test_path, test_passphrase)
        print(f"  Decrypted {len(messages)} message(s)")
        print(f"  Message body: {messages[0]['body']}")
        
        print("  Self-test passed!")
