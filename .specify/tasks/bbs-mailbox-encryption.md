# Task: MAILB0X Encrypted Messaging System

## Objective

Implement an encrypted mailbox system for Channel-6 (MAILB0X) where messages are encrypted at rest and require a passphrase to decrypt.

## Requirements

- [ ] Implement `scripts/mailbox_crypto.py` with encryption functions
- [ ] Implement `scripts/mailbox_ops.py` for mailbox file operations
- [ ] Implement `scripts/mailbox_cli.py` for command-line access
- [ ] Create `data/mailboxes/` directory for encrypted mailbox storage
- [ ] Write unit tests for crypto round-trip

## Implementation Notes

### Crypto Module (`mailbox_crypto.py`)

Functions to implement:
- `derive_key_from_passphrase(passphrase: str, salt: bytes) -> bytes`
  - Uses Argon2id KDF
  - Returns 256-bit key
- `encrypt_message(passphrase: str, plaintext: str) -> tuple[bytes, bytes, bytes]`
  - Generates random salt and nonce
  - Returns (salt, iv, ciphertext)
- `decrypt_message(passphrase: str, salt: bytes, iv: bytes, ciphertext: bytes) -> str`
  - Derives key and decrypts
  - Returns plaintext

### Ops Module (`mailbox_ops.py`)

Functions to implement:
- `append_encrypted_message(mailbox_path, message_dict, passphrase)`
  - Loads or creates mailbox file
  - Encrypts message body
  - Appends to mail list and saves
- `decrypt_mailbox(mailbox_path, passphrase) -> list[dict]`
  - Loads mailbox file
  - Decrypts all messages
  - Returns list of plaintext messages

### CLI (`mailbox_cli.py`)

Commands:
```bash
# Add a message
python scripts/mailbox_cli.py add --to <id> --from <id> --body "..." --passphrase "<pw>"

# Read messages
python scripts/mailbox_cli.py read --for <id> --passphrase "<pw>"
```

### Mailbox File Schema

```json
{
  "version": 1,
  "cipher": "aes-256-gcm",
  "kdf": "argon2id",
  "salt": "<base64>",
  "mail": [
    {
      "id": "<uuid>",
      "enc_body": "<base64-ciphertext>",
      "iv": "<base64-nonce>",
      "sent_at": "<ISO8601>",
      "from": "<sender_id>",
      "metadata": {}
    }
  ]
}
```

### Security Requirements

- Never store passphrases or derived keys persistently
- Use random salt for each mailbox
- Use random nonce for each message
- Use `cryptography` library for all crypto operations

## Acceptance Criteria

- [ ] Crypto functions pass encrypt/decrypt round-trip tests
- [ ] Mailbox operations correctly manage JSON files
- [ ] CLI successfully adds and reads messages
- [ ] No passphrases stored in files or logs
- [ ] Auth tags are properly validated (AES-GCM)

## Status

**In Progress**
