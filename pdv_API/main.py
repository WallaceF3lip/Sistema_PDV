from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.routers import auth, users, products, stock, sales, cash_registers

# Cria tabelas se não existirem (em produção, prefira Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PDV API",
    description="Sistema de Ponto de Venda — MVP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(products.router)
app.include_router(stock.router)
app.include_router(sales.router)
app.include_router(cash_registers.router)


@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "service": "PDV API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
