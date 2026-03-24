# 🛒 Sistema PDV

> Sistema de Ponto de Venda com controle de estoque e geração de relatórios.

---

## 📋 Sobre o Projeto

O **Sistema PDV** é uma aplicação web completa para gerenciamento de ponto de venda, desenvolvida para facilitar o controle de vendas, estoque e geração de relatórios gerenciais. A solução oferece uma interface moderna e intuitiva para operações do dia a dia no varejo.

### ✨ Funcionalidades

- 🧾 **Ponto de Venda** — Registro rápido de vendas e emissão de comprovantes
- 📦 **Controle de Estoque** — Gestão de produtos, entradas e saídas
- 📊 **Relatórios** — Geração de relatórios de vendas, estoque e desempenho
- 👥 **Gestão de Clientes e Fornecedores**
- 🔐 **Controle de Acesso** — Perfis de usuário com permissões

---

## 🛠️ Tecnologias

| Camada      | Tecnologia         |
|-------------|--------------------|
| Backend     | Python + FastAPI   |
| Frontend    | Angular            |
| Banco de Dados | PostgreSQL      |

---

## 🚀 Instalação e Uso

### Pré-requisitos

- [Python 3.11+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 15+](https://www.postgresql.org/)

---

### 🔧 Backend (FastAPI)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/sistema-pdv.git
cd sistema-pdv/backend

# Crie e ative o ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Instale as dependências
pip install -r requirements.txt

# Configure as variáveis de ambiente
cp .env .env
# Edite o arquivo .env com as configurações do banco de dados

# Execute as migrações
alembic upgrade head

# Inicie o servidor
uvicorn main:app --reload
```

A API estará disponível em: `http://localhost:8000`  
Documentação Swagger: `http://localhost:8000/docs`

---

### 🌐 Frontend (Angular)

```bash
cd ../frontend

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
ng serve
```

A aplicação estará disponível em: `http://localhost:4200`

---

### 🗄️ Banco de Dados (PostgreSQL)

```sql
-- Crie o banco de dados
CREATE DATABASE sistema_pdv;
```

Configure a string de conexão no arquivo `.env` do backend:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/sistema_pdv
```

---

## 📁 Estrutura do Projeto

```
sistema-pdv/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   ├── alembic/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── assets/
│   │   └── environments/
│   └── package.json
└── README.md
```

---
