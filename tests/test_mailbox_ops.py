"""
Tests for the mailbox operations module.

Tests mailbox file operations including add, read, and delete.
"""

import json
import pytest
import sys
import tempfile
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import mailbox_ops


class TestMailboxOperations:
    """Tests for mailbox file operations."""
    
    def test_create_empty_mailbox(self):
        """Test creating an empty mailbox structure."""
        mailbox = mailbox_ops.create_empty_mailbox("passphrase")
        
        assert mailbox["version"] == 1
        assert mailbox["cipher"] == "aes-256-gcm"
        assert "kdf" in mailbox
        assert "salt" in mailbox
        assert mailbox["mail"] == []
    
    def test_get_mailbox_path(self):
        """Test mailbox path generation."""
        path = mailbox_ops.get_mailbox_path("test-user-123")
        
        assert path.name == "test-user-123.json"
        assert "mailboxes" in str(path)
    
    def test_get_mailbox_path_sanitization(self):
        """Test that special characters are sanitized."""
        path = mailbox_ops.get_mailbox_path("user/with:special<chars>")
        
        assert "/" not in path.name
        assert ":" not in path.name
        assert "<" not in path.name
        assert ">" not in path.name
    
    def test_append_and_decrypt_message(self):
        """Test adding and reading messages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_dir = Path(tmpdir)
            mailbox_path = mailbox_dir / "test_user.json"
            passphrase = "test-password-123"
            
            # Add a message
            msg_id = mailbox_ops.append_encrypted_message(
                mailbox_path,
                {
                    "body": "Hello, this is a secret message!",
                    "from": "sender_node"
                },
                passphrase
            )
            
            assert msg_id is not None
            assert mailbox_path.exists()
            
            # Decrypt and read
            messages = mailbox_ops.decrypt_mailbox(mailbox_path, passphrase)
            
            assert len(messages) == 1
            assert messages[0]["body"] == "Hello, this is a secret message!"
            assert messages[0]["from"] == "sender_node"
            assert messages[0]["id"] == msg_id
    
    def test_append_multiple_messages(self):
        """Test adding multiple messages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            passphrase = "test-password"
            
            # Add multiple messages
            for i in range(3):
                mailbox_ops.append_encrypted_message(
                    mailbox_path,
                    {"body": f"Message {i}", "from": f"sender_{i}"},
                    passphrase
                )
            
            messages = mailbox_ops.decrypt_mailbox(mailbox_path, passphrase)
            
            assert len(messages) == 3
            assert messages[0]["body"] == "Message 0"
            assert messages[1]["body"] == "Message 1"
            assert messages[2]["body"] == "Message 2"
    
    def test_wrong_passphrase_fails(self):
        """Test that wrong passphrase fails to decrypt."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            
            mailbox_ops.append_encrypted_message(
                mailbox_path,
                {"body": "Secret", "from": "sender"},
                "correct-password"
            )
            
            with pytest.raises(ValueError):
                mailbox_ops.decrypt_mailbox(mailbox_path, "wrong-password")
    
    def test_get_mailbox_info(self):
        """Test getting mailbox info without decrypting."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            
            # Add messages
            for i in range(5):
                mailbox_ops.append_encrypted_message(
                    mailbox_path,
                    {"body": f"Message {i}", "from": "sender"},
                    "password"
                )
            
            info = mailbox_ops.get_mailbox_info(mailbox_path)
            
            assert info["version"] == 1
            assert info["message_count"] == 5
            assert info["cipher"] == "aes-256-gcm"
    
    def test_get_mailbox_info_not_found(self):
        """Test mailbox info returns None for missing file."""
        info = mailbox_ops.get_mailbox_info(Path("/nonexistent/path.json"))
        assert info is None
    
    def test_list_mailboxes(self):
        """Test listing mailboxes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_dir = Path(tmpdir)
            
            # Create some mailboxes
            for user in ["alice", "bob", "charlie"]:
                mailbox_ops.append_encrypted_message(
                    mailbox_dir / f"{user}.json",
                    {"body": "Test", "from": "sender"},
                    "password"
                )
            
            recipients = mailbox_ops.list_mailboxes(mailbox_dir)
            
            assert len(recipients) == 3
            assert "alice" in recipients
            assert "bob" in recipients
            assert "charlie" in recipients
    
    def test_delete_message(self):
        """Test deleting a message."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            passphrase = "password"
            
            # Add messages
            msg_ids = []
            for i in range(3):
                msg_id = mailbox_ops.append_encrypted_message(
                    mailbox_path,
                    {"body": f"Message {i}", "from": "sender"},
                    passphrase
                )
                msg_ids.append(msg_id)
            
            # Delete middle message
            deleted = mailbox_ops.delete_message(mailbox_path, msg_ids[1], passphrase)
            assert deleted
            
            # Check remaining messages
            messages = mailbox_ops.decrypt_mailbox(mailbox_path, passphrase)
            assert len(messages) == 2
            assert messages[0]["body"] == "Message 0"
            assert messages[1]["body"] == "Message 2"
    
    def test_delete_message_not_found(self):
        """Test deleting non-existent message."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            passphrase = "password"
            
            mailbox_ops.append_encrypted_message(
                mailbox_path,
                {"body": "Test", "from": "sender"},
                passphrase
            )
            
            deleted = mailbox_ops.delete_message(mailbox_path, "nonexistent-id", passphrase)
            assert not deleted
    
    def test_message_metadata(self):
        """Test that metadata is preserved."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mailbox_path = Path(tmpdir) / "test_user.json"
            passphrase = "password"
            
            mailbox_ops.append_encrypted_message(
                mailbox_path,
                {
                    "body": "Test",
                    "from": "sender",
                    "metadata": {"priority": "urgent", "ttl": 3600}
                },
                passphrase
            )
            
            messages = mailbox_ops.decrypt_mailbox(mailbox_path, passphrase)
            
            assert messages[0]["metadata"]["priority"] == "urgent"
            assert messages[0]["metadata"]["ttl"] == 3600
