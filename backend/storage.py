"""
Storage layer for polytopes.
This module handles saving/loading polytopes to/from JSON files.
Can be easily swapped for database storage later.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

# Storage directory
STORAGE_DIR = Path(__file__).parent / "data" / "polytopes"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _get_polytope_path(name: str) -> Path:
    """Get the file path for a polytope by name."""
    # Sanitize name for filesystem
    safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')
    return STORAGE_DIR / f"{safe_name}.json"


def save_polytope(name: str, lattice_type: str, points: List[List[int]]) -> Dict:
    """
    Save a polytope to storage.

    Args:
        name: Display name for the polytope
        lattice_type: "square" or "hexagonal"
        points: List of [x, y] coordinate pairs

    Returns:
        Dict with saved polytope data
    """
    polytope_data = {
        "name": name,
        "lattice_type": lattice_type,
        "points": points,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    file_path = _get_polytope_path(name)
    with open(file_path, 'w') as f:
        json.dump(polytope_data, f, indent=2)

    return polytope_data


def load_polytope(name: str) -> Optional[Dict]:
    """
    Load a polytope from storage.

    Args:
        name: Name of the polytope to load

    Returns:
        Dict with polytope data, or None if not found
    """
    file_path = _get_polytope_path(name)

    if not file_path.exists():
        return None

    with open(file_path, 'r') as f:
        return json.load(f)


def list_polytopes() -> List[Dict]:
    """
    List all saved polytopes.

    Returns:
        List of polytope metadata (name, created_at, updated_at)
    """
    polytopes = []

    for file_path in STORAGE_DIR.glob("*.json"):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                polytopes.append({
                    "name": data["name"],
                    "lattice_type": data.get("lattice_type", "square"),
                    "point_count": len(data.get("points", [])),
                    "created_at": data.get("created_at"),
                    "updated_at": data.get("updated_at")
                })
        except (json.JSONDecodeError, KeyError):
            # Skip invalid files
            continue

    # Sort by name
    polytopes.sort(key=lambda x: x["name"])

    return polytopes


def delete_polytope(name: str) -> bool:
    """
    Delete a polytope from storage.

    Args:
        name: Name of the polytope to delete

    Returns:
        True if deleted, False if not found
    """
    file_path = _get_polytope_path(name)

    if not file_path.exists():
        return False

    file_path.unlink()
    return True
