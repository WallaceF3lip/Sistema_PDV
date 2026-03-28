# PDV API — Sistema de Ponto de Venda

MVP construído com **FastAPI + SQLAlchemy + PostgreSQL**.

---

## 🚀 Rodando com Docker

```bash
# 1. Copie o arquivo de ambiente
cp .env.example .env

# 2. Suba os containers
docker-compose up --build

# 3. Acesse a documentação interativa
http://localhost:8000/docs
```

---

## 🗂️ Estrutura

```
pdv/
├── app/
│   ├── core/          # config, database, security (JWT)
│   ├── models/        # SQLAlchemy ORM
│   ├── schemas/       # Pydantic I/O
│   ├── services/      # Regras de negócio (StockService, SaleService)
│   ├── routers/       # Endpoints FastAPI
│   └── main.py
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 🔑 Endpoints principais

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/token` | — | Login (retorna JWT) |
| GET | `/auth/me` | ✅ | Dados do usuário atual |
| POST | `/users/` | ADMIN | Criar usuário |
| POST | `/products/` | ADMIN | Criar produto |
| GET | `/products/sku/{sku}` | ✅ | Buscar por SKU (bipar) |
| POST | `/stock/product/{id}/in` | ADMIN | Entrada de estoque |
| POST | `/stock/product/{id}/adjust` | ADMIN | Ajuste manual |
| GET | `/stock/movements` | ADMIN | Auditoria de movimentos |
| POST | `/sales/` | ✅ | Abrir venda |
| POST | `/sales/{id}/items` | ✅ | Adicionar item (bipar SKU) |
| DELETE | `/sales/{id}/items/{item_id}` | ✅ | Remover item |
| POST | `/sales/{id}/finalize` | ✅ | Finalizar + baixar estoque |
| POST | `/sales/{id}/cancel` | ✅ | Cancelar (com estorno) |

---

## 🔒 Regras de Negócio

- **Estoque nunca negativo** — validado com `SELECT FOR UPDATE` contra concorrência
- **Baixa de estoque apenas no fechamento** — dentro de transação atômica
- **Todo movimento gera `stock_movement`** — auditoria completa
- **Preço copiado no momento da venda** — histórico protegido
- **Pagamentos devem somar exatamente o total** — sem diferença de centavos
- **Operador não altera produtos nem estoque** — apenas ADMIN

---

## 🛠️ Rodando sem Docker

```bash
# Instale as dependências
pip install -r requirements.txt

# Configure o banco
cp .env.example .env
# Edite .env com sua DATABASE_URL

# Suba a API
uvicorn app.main:app --reload
```
