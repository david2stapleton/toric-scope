from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from pathlib import Path
from typing import Literal, Dict, List
import storage

app = FastAPI(title="Toric Scope API")

# Data directory for storing text files
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
TEXT_FILE = DATA_DIR / "mode_texts.json"

# Valid modes
Mode = Literal["polytopes", "multiplicities", "rings", "fans"]

class TextContent(BaseModel):
    content: str


class PolytopeData(BaseModel):
    name: str
    lattice_type: Literal["square", "hexagonal"]
    points: List[List[int]]

# Configure CORS to allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - basic health check"""
    return {"message": "Toric Scope API is running"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "toric-scope-api"}


# Example endpoint for future toric variety operations
@app.get("/api/varieties")
async def get_varieties():
    """Placeholder endpoint for toric varieties"""
    return {
        "varieties": [],
        "message": "Toric variety endpoints coming soon"
    }


# Helper functions for text storage
def load_texts() -> Dict[str, str]:
    """Load all mode texts from JSON file"""
    if TEXT_FILE.exists():
        try:
            with open(TEXT_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def save_texts(texts: Dict[str, str]) -> None:
    """Save all mode texts to JSON file"""
    with open(TEXT_FILE, 'w') as f:
        json.dump(texts, f, indent=2)


# Text storage endpoints
@app.get("/api/text/{mode}")
async def get_text(mode: Mode):
    """Get text content for a specific mode"""
    texts = load_texts()
    return {"content": texts.get(mode, "")}


@app.put("/api/text/{mode}")
async def update_text(mode: Mode, text_content: TextContent):
    """Update text content for a specific mode"""
    texts = load_texts()
    texts[mode] = text_content.content
    save_texts(texts)
    return {"status": "success", "mode": mode}


@app.get("/api/texts")
async def get_all_texts():
    """Get text content for all modes"""
    texts = load_texts()
    # Ensure all modes have a value (empty string if not set)
    return {
        "polytopes": texts.get("polytopes", ""),
        "multiplicities": texts.get("multiplicities", ""),
        "rings": texts.get("rings", ""),
        "fans": texts.get("fans", "")
    }


# Polytope storage endpoints
@app.post("/api/polytopes")
async def save_polytope(polytope: PolytopeData):
    """Save a polytope"""
    try:
        result = storage.save_polytope(
            name=polytope.name,
            lattice_type=polytope.lattice_type,
            points=polytope.points
        )
        return {"status": "success", "polytope": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/polytopes")
async def list_polytopes():
    """List all saved polytopes"""
    try:
        polytopes = storage.list_polytopes()
        return {"polytopes": polytopes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/polytopes/{name}")
async def get_polytope(name: str):
    """Get a specific polytope by name"""
    try:
        polytope = storage.load_polytope(name)
        if polytope is None:
            raise HTTPException(status_code=404, detail=f"Polytope '{name}' not found")
        return polytope
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/polytopes/{name}")
async def delete_polytope(name: str):
    """Delete a polytope by name"""
    try:
        success = storage.delete_polytope(name)
        if not success:
            raise HTTPException(status_code=404, detail=f"Polytope '{name}' not found")
        return {"status": "success", "message": f"Polytope '{name}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
