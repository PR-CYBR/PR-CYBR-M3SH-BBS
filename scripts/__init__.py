"""
PR-CYBR Meshtastic BBS Scripts

This package contains the Python scripts for the PR-MESH-BBS and PR-CYBR-BBS systems.

Modules:
    meshtastic_client: Interface for Meshtastic device communication
    mailbox_crypto: Encryption/decryption for MAILB0X messages
    mailbox_ops: File operations for encrypted mailboxes
    pr_mesh_bbs_generate: Generator for public BBS content
    pr_mesh_bbs_tx: Transmission script for public BBS
    pr_cybr_bbs_generate: Generator for private BBS content
    pr_cybr_bbs_tx: Transmission script for private BBS
    m3sh_ops_report: Node status reporting for M3SH-OPS channel
    mailbox_cli: Command-line interface for MAILB0X
    generate_pr_cybr_qr_codes: QR code generator for channel join
    validate_bbs_output: JSON schema validator for BBS outputs
"""

__version__ = "0.1.0"
