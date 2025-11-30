"""
Tests for the mailbox crypto module.

Tests encryption/decryption round-trip, key derivation, and error handling.
"""

import pytest

import mailbox_crypto


class TestKeyDerivation:
    """Tests for key derivation function."""
    
    def test_derive_key_produces_correct_length(self):
        """Key should be 32 bytes (256 bits)."""
        salt = mailbox_crypto.generate_salt()
        key = mailbox_crypto.derive_key_from_passphrase("test-passphrase", salt)
        assert len(key) == 32
    
    def test_derive_key_deterministic(self):
        """Same passphrase and salt should produce same key."""
        salt = mailbox_crypto.generate_salt()
        key1 = mailbox_crypto.derive_key_from_passphrase("test-passphrase", salt)
        key2 = mailbox_crypto.derive_key_from_passphrase("test-passphrase", salt)
        assert key1 == key2
    
    def test_different_salt_produces_different_key(self):
        """Different salt should produce different key."""
        salt1 = mailbox_crypto.generate_salt()
        salt2 = mailbox_crypto.generate_salt()
        key1 = mailbox_crypto.derive_key_from_passphrase("test-passphrase", salt1)
        key2 = mailbox_crypto.derive_key_from_passphrase("test-passphrase", salt2)
        assert key1 != key2
    
    def test_empty_passphrase_raises(self):
        """Empty passphrase should raise ValueError."""
        salt = mailbox_crypto.generate_salt()
        with pytest.raises(ValueError, match="empty"):
            mailbox_crypto.derive_key_from_passphrase("", salt)
    
    def test_invalid_salt_raises(self):
        """Invalid salt size should raise ValueError."""
        with pytest.raises(ValueError, match="Salt must be"):
            mailbox_crypto.derive_key_from_passphrase("test", b"short")


class TestEncryption:
    """Tests for message encryption."""
    
    def test_encrypt_returns_components(self):
        """Encryption should return salt, nonce, and ciphertext."""
        result = mailbox_crypto.encrypt_message("passphrase", "Hello, World!")
        assert result.salt is not None
        assert result.nonce is not None
        assert result.ciphertext is not None
        assert len(result.salt) == mailbox_crypto.SALT_SIZE
        assert len(result.nonce) == mailbox_crypto.NONCE_SIZE
    
    def test_encrypt_produces_different_ciphertext(self):
        """Each encryption should produce different ciphertext (random nonce)."""
        msg = "Hello, World!"
        result1 = mailbox_crypto.encrypt_message("passphrase", msg)
        result2 = mailbox_crypto.encrypt_message("passphrase", msg)
        assert result1.ciphertext != result2.ciphertext
    
    def test_empty_plaintext_raises(self):
        """Empty plaintext should raise ValueError."""
        with pytest.raises(ValueError, match="empty"):
            mailbox_crypto.encrypt_message("passphrase", "")


class TestDecryption:
    """Tests for message decryption."""
    
    def test_decrypt_round_trip(self):
        """Decryption should recover original plaintext."""
        original = "Hello, World! This is a test message."
        passphrase = "my-secret-passphrase"
        
        encrypted = mailbox_crypto.encrypt_message(passphrase, original)
        decrypted = mailbox_crypto.decrypt_message(
            passphrase,
            encrypted.salt,
            encrypted.nonce,
            encrypted.ciphertext
        )
        
        assert decrypted == original
    
    def test_wrong_passphrase_fails(self):
        """Wrong passphrase should fail to decrypt."""
        encrypted = mailbox_crypto.encrypt_message("correct-password", "secret")
        
        with pytest.raises(ValueError, match="Decryption failed"):
            mailbox_crypto.decrypt_message(
                "wrong-password",
                encrypted.salt,
                encrypted.nonce,
                encrypted.ciphertext
            )
    
    def test_tampered_ciphertext_fails(self):
        """Tampered ciphertext should fail authentication."""
        encrypted = mailbox_crypto.encrypt_message("passphrase", "secret")
        
        # Tamper with ciphertext
        tampered = bytes([encrypted.ciphertext[0] ^ 0xFF]) + encrypted.ciphertext[1:]
        
        with pytest.raises(ValueError, match="Decryption failed"):
            mailbox_crypto.decrypt_message(
                "passphrase",
                encrypted.salt,
                encrypted.nonce,
                tampered
            )


class TestBase64Functions:
    """Tests for base64 convenience functions."""
    
    def test_base64_round_trip(self):
        """Base64 functions should support round-trip."""
        original = "Test message with unicode: ñ 日本語"
        passphrase = "test-pass"
        
        encrypted = mailbox_crypto.encrypt_to_base64(passphrase, original)
        
        assert "salt" in encrypted
        assert "iv" in encrypted
        assert "enc_body" in encrypted
        
        decrypted = mailbox_crypto.decrypt_from_base64(
            passphrase,
            encrypted["salt"],
            encrypted["iv"],
            encrypted["enc_body"]
        )
        
        assert decrypted == original
    
    def test_base64_output_is_ascii(self):
        """Base64 encoded values should be ASCII strings."""
        encrypted = mailbox_crypto.encrypt_to_base64("pass", "message")
        
        assert encrypted["salt"].isascii()
        assert encrypted["iv"].isascii()
        assert encrypted["enc_body"].isascii()


class TestUtilityFunctions:
    """Tests for utility functions."""
    
    def test_get_kdf_name(self):
        """KDF name should be returned."""
        name = mailbox_crypto.get_kdf_name()
        assert name in ["argon2id", "pbkdf2-sha256"]
    
    def test_get_cipher_name(self):
        """Cipher name should be aes-256-gcm."""
        name = mailbox_crypto.get_cipher_name()
        assert name == "aes-256-gcm"
    
    def test_generate_salt_unique(self):
        """Each salt generation should be unique."""
        salts = [mailbox_crypto.generate_salt() for _ in range(10)]
        unique_salts = set(salts)
        assert len(unique_salts) == 10
    
    def test_generate_nonce_unique(self):
        """Each nonce generation should be unique."""
        nonces = [mailbox_crypto.generate_nonce() for _ in range(10)]
        unique_nonces = set(nonces)
        assert len(unique_nonces) == 10
