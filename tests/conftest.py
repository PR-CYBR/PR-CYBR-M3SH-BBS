"""
Pytest configuration for the PR-CYBR Meshtastic BBS test suite.

This file automatically adds the scripts directory to the Python path
so that test modules can import scripts without sys.path manipulation.
"""

import sys
from pathlib import Path

# Add scripts directory to path for imports
scripts_dir = Path(__file__).parent.parent / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))
