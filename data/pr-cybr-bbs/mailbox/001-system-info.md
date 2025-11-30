---
id: mailbox-info-001
title: MAILB0X System Information
category: MAILBOX
tags:
  - mailbox
  - encryption
  - bridge
priority: normal
---

# MAILB0X System Information

## Overview

MAILB0X (Channel-6) provides encrypted point-to-point messaging for PR-CYBR network users.

## Features

- End-to-end encryption using AES-256-GCM
- Passphrase-based access (2FA-like security)
- Bridge-ready for Reticulum integration

## How to Use

1. **Sending Messages**: Use the mailbox CLI to compose and encrypt
2. **Receiving Messages**: Provide your passphrase to decrypt your mailbox
3. **Passphrase Security**: Never share your passphrase; it's not stored anywhere

## Message Format

Messages support:
- Plain text body
- Priority levels (normal/urgent)
- TTL for message expiration
- Routing via Meshtastic or Reticulum

## Support

For mailbox issues, contact network administrators via OPS-SITREP channel.
