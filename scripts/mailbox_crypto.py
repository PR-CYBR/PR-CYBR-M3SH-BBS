#!/usr/bin/env python3
"""
Mailbox Cryptography Module

Provides encryption and decryption functions for the MAILB0X system.
Uses AES-256-GCM for authenticated encryption with Argon2id for key derivation.

Security Notes:
- Passphrases and derived keys are NEVER stored persistently
- Each message uses a unique random nonce
- Authentication tags are verified during decryption
"""

import base64
import os
import secrets
from typing import NamedTuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Try to use argon2-cffi, fall back to cryptography's PBKDF2 if unavailable
try:
    from argon2.low_level import Type, hash_secret_raw
    ARGON2_AVAILABLE = True
except ImportError:
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    ARGON2_AVAILABLE = False


# Constants for key derivation
SALT_SIZE = 16  # 128 bits
KEY_SIZE = 32   # 256 bits for AES-256
NONCE_SIZE = 12 # 96 bits for AES-GCM

# Argon2id parameters (OWASP recommendations)
ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST = 65536  # 64 MiB
ARGON2_PARALLELISM = 4

# PBKDF2 parameters (fallback)
PBKDF2_ITERATIONS = 600000


class EncryptedPayload(NamedTuple):
    """Container for encrypted message components."""
    salt: bytes
    nonce: bytes
    ciphertext: bytes


def generate_salt() -> bytes:
    """Generate a cryptographically secure random salt."""
    return secrets.token_bytes(SALT_SIZE)


def generate_nonce() -> bytes:
    """Generate a cryptographically secure random nonce."""
    return secrets.token_bytes(NONCE_SIZE)


def derive_key_from_passphrase(passphrase: str, salt: bytes) -> bytes:
    """
    Derive a 256-bit encryption key from a passphrase using Argon2id.
    
    Falls back to PBKDF2-SHA256 if argon2-cffi is not available.
    
    Args:
        passphrase: User-provided passphrase.
        salt: Random salt bytes.
    
    Returns:
        32-byte derived key.
    
    Raises:
        ValueError: If passphrase is empty or salt is invalid.
    """
    if not passphrase:
        raise ValueError("Passphrase cannot be empty")
    
    if len(salt) != SALT_SIZE:
        raise ValueError(f"Salt must be {SALT_SIZE} bytes")
    
    passphrase_bytes = passphrase.encode("utf-8")
    
    if ARGON2_AVAILABLE:
        # Use Argon2id (preferred)
        return hash_secret_raw(
            secret=passphrase_bytes,
            salt=salt,
            time_cost=ARGON2_TIME_COST,
            memory_cost=ARGON2_MEMORY_COST,
            parallelism=ARGON2_PARALLELISM,
            hash_len=KEY_SIZE,
            type=Type.ID
        )
    else:
        # Fallback to PBKDF2-SHA256
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=KEY_SIZE,
            salt=salt,
            iterations=PBKDF2_ITERATIONS,
        )
        return kdf.derive(passphrase_bytes)


def encrypt_message(passphrase: str, plaintext: str) -> EncryptedPayload:
    """
    Encrypt a plaintext message using AES-256-GCM.
    
    Generates a new random salt and nonce for each message.
    
    Args:
        passphrase: User-provided passphrase for key derivation.
        plaintext: Message to encrypt.
    
    Returns:
        EncryptedPayload containing salt, nonce, and ciphertext.
    
    Raises:
        ValueError: If passphrase or plaintext is empty.
    """
    if not plaintext:
        raise ValueError("Plaintext cannot be empty")
    
    # Generate random salt and nonce
    salt = generate_salt()
    nonce = generate_nonce()
    
    # Derive key from passphrase
    key = derive_key_from_passphrase(passphrase, salt)
    
    # Encrypt using AES-GCM
    aesgcm = AESGCM(key)
    plaintext_bytes = plaintext.encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)
    
    return EncryptedPayload(salt=salt, nonce=nonce, ciphertext=ciphertext)


def decrypt_message(
    passphrase: str,
    salt: bytes,
    nonce: bytes,
    ciphertext: bytes
) -> str:
    """
    Decrypt a message using AES-256-GCM.
    
    Args:
        passphrase: User-provided passphrase for key derivation.
        salt: Salt used during encryption.
        nonce: Nonce/IV used during encryption.
        ciphertext: Encrypted message with authentication tag.
    
    Returns:
        Decrypted plaintext string.
    
    Raises:
        ValueError: If decryption fails (wrong passphrase or tampered data).
    """
    if not passphrase:
        raise ValueError("Passphrase cannot be empty")
    
    # Derive key from passphrase
    key = derive_key_from_passphrase(passphrase, salt)
    
    # Decrypt using AES-GCM
    aesgcm = AESGCM(key)
    
    try:
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError(
            "Decryption failed: incorrect passphrase or corrupted data"
        ) from e


def encrypt_to_base64(passphrase: str, plaintext: str) -> dict[str, str]:
    """
    Encrypt a message and return base64-encoded components.
    
    Convenient for JSON serialization.
    
    Args:
        passphrase: User-provided passphrase.
        plaintext: Message to encrypt.
    
    Returns:
        Dictionary with base64-encoded salt, iv (nonce), and enc_body.
    """
    encrypted = encrypt_message(passphrase, plaintext)
    
    return {
        "salt": base64.b64encode(encrypted.salt).decode("ascii"),
        "iv": base64.b64encode(encrypted.nonce).decode("ascii"),
        "enc_body": base64.b64encode(encrypted.ciphertext).decode("ascii"),
    }


def decrypt_from_base64(
    passphrase: str,
    salt_b64: str,
    iv_b64: str,
    enc_body_b64: str
) -> str:
    """
    Decrypt a message from base64-encoded components.
    
    Convenient for JSON deserialization.
    
    Args:
        passphrase: User-provided passphrase.
        salt_b64: Base64-encoded salt.
        iv_b64: Base64-encoded nonce/IV.
        enc_body_b64: Base64-encoded ciphertext.
    
    Returns:
        Decrypted plaintext string.
    """
    salt = base64.b64decode(salt_b64)
    nonce = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(enc_body_b64)
    
    return decrypt_message(passphrase, salt, nonce, ciphertext)


def get_kdf_name() -> str:
    """Return the name of the KDF in use."""
    return "argon2id" if ARGON2_AVAILABLE else "pbkdf2-sha256"


def get_cipher_name() -> str:
    """Return the name of the cipher in use."""
    return "aes-256-gcm"


# For testing when run directly
if __name__ == "__main__":
    print("Mailbox Crypto Module")
    print(f"  KDF: {get_kdf_name()}")
    print(f"  Cipher: {get_cipher_name()}")
    print(f"  Argon2 Available: {ARGON2_AVAILABLE}")
    
    # Quick self-test
    print("\nRunning self-test...")
    test_passphrase = "test-passphrase-123"
    test_message = "Hello, this is a test message!"
    
    encrypted = encrypt_to_base64(test_passphrase, test_message)
    print(f"  Encrypted: salt={encrypted['salt'][:16]}...")
    
    decrypted = decrypt_from_base64(
        test_passphrase,
        encrypted["salt"],
        encrypted["iv"],
        encrypted["enc_body"]
    )
    
    assert decrypted == test_message, "Decryption failed!"
    print(f"  Decrypted: {decrypted}")
    print("  Self-test passed!")
