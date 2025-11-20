from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Toric Scope API")

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
