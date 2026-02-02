from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import orders

app = FastAPI(title="Populer125 RocketGrowth Proxy - Backend")

# Simple CORS for local dev - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
app.include_router(orders.router, prefix="/api/orders")

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
