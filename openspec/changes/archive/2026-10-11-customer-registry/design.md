## Context

Veja proposal.md (Why). Estado atual relevante:

- `pdv_API/app/models/sale.py`: `Sale` guarda `customer_name`, `customer_phone` (String 30) e `delivery_address` (String 500) como texto livre; não existe entidade de cliente.
- `pdv_API/app/routers/sales.py` → `PATCH /sales/{id}/order-details` chama `SaleService.update_order_details` com `payload.model_dump(exclude_none=True)`; o service só aceita uma lista fixa de campos (`updatable_fields`) e exige venda OPEN.
- `pdv_API/main.py` usa `Base.metadata.create_all` (cria tabelas novas, mas **não** adiciona colunas a `sales`). Não há Alembic; alterações em tabelas existentes vão em `pdv_API/migrations/*.sql` (ex.: `add_pending_status.sql`).
- Permissões: `get_current_user` e `require_admin` (403 "Acesso restrito ao ADMIN") em `app/core/security.py`. `routers/products.py` é o padrão de CRUD (POST/GET/PATCH, mensagens em português).
- Frontend: `pages/products` é o padrão de página CRUD (signals + `app-data-table` + modal `.glass-overlay`/`.modal-card`); `core/services/product.service.ts` é o padrão de service; o sidebar usa o array `navItems` em `shared/components/sidebar/sidebar.component.ts`.
- Checkout: `pages/sales/sale-checkout-modal` com etapas TYPE → DETAILS → PAYMENT; etapa 1 tem `customerName` (obrigatório) e `notes`; etapa 2 tem `deliveryTime`, `customerPhone` (máscara ngx-mask `(00) 00000-0000`) e `deliveryAddress` (texto livre, só Entrega).

## Goals / Non-Goals

**Goals:**
- Entidades `Customer` e `CustomerAddress` com API REST e busca rápida, no contrato definido para as changes seguintes (nomes de tabela/colunas e rota `/customers`).
- Vínculo opcional `Sale.customer_id` sem quebrar vendas existentes nem o fluxo de nome livre.
- Endereço estruturado com `neighborhood` obrigatório, pronto para receber `delivery_zone_id` em `delivery-zones-and-fee`.

**Non-Goals:**
- Zonas de entrega, taxa de entrega e `delivery_zone_id` (change `delivery-zones-and-fee`).
- Histórico de compras por cliente, fidelidade, CPF/e-mail, aniversário.
- Deduplicação/mesclagem de clientes e unicidade de telefone.
- Paginação no servidor da lista de clientes (usa `limit` + paginação client-side do `app-data-table`).
- Exibir cliente vinculado no histórico de vendas (o snapshot `customer_name` já é exibido).

## Decisions

### 1. Modelo de dados: `customers` + `customer_addresses` (1:N)
**Decisão**: Novo arquivo `app/models/customer.py` com:
- `Customer`: `id`, `name` String(255) not null (index), `phone` String(20) nullable (index, só dígitos), `notes` String(500) nullable, `is_active` Boolean default true, `created_at` timestamptz `server_default=now()`; relação `addresses` (cascade `all, delete-orphan`, ordenada por `is_default desc, id`).
- `CustomerAddress`: `id`, `customer_id` FK `customers.id` ON DELETE CASCADE (index), `street` String(255) not null, `number` String(20), `complement` String(100), `neighborhood` String(100) not null, `reference` String(255), `is_default` Boolean default false.
- `Sale.customer_id`: `Integer` FK `customers.id` ON DELETE SET NULL, nullable, index; relação `customer` sem `back_populates` obrigatório (evitar carregar vendas no cliente).

**Rationale**: Um cliente tem vários endereços (casa, trabalho); campos estruturados permitem formatar o snapshot e, depois, associar bairro → zona. `ON DELETE SET NULL` é defensivo — clientes nunca são excluídos fisicamente.
**Alternativa**: endereço único em colunas de `customers`. Rejeitada: não comporta múltiplos endereços e complicaria a futura FK de zona.

### 2. Telefone normalizado em dígitos e não único
**Decisão**: Validador Pydantic (`field_validator`) em `CustomerCreate`/`CustomerUpdate` remove não-dígitos e exige 10 ou 11 dígitos (erro "Telefone inválido"); string vazia vira `null`. Sem constraint de unicidade.
**Rationale**: Busca por telefone fica trivial (`LIKE %digitos%`) e independente de máscara; o frontend reaplica a máscara na exibição. Famílias compartilham telefone, então unicidade geraria atrito no balcão.
**Alternativa**: telefone único (409). Rejeitada pelo cenário de telefone compartilhado; risco de duplicatas mitigado pela busca antes do cadastro rápido.

### 3. Busca simples com ILIKE
**Decisão**: `GET /customers?q=&active_only=true&limit=50` filtra `Customer.name.ilike(f"%{q}%")` OR (se `q` tiver ≥ 2 dígitos) `Customer.phone.like(f"%{digits}%")`; ordena por `name`; `limit` máx. 200; carrega endereços com `selectinload`.
**Rationale**: Volume de clientes de um estabelecimento local é pequeno; ILIKE em PostgreSQL é suficiente. Sem extensões (pg_trgm/unaccent).
**Alternativa**: busca acento-insensível com `unaccent`. Adiada: exige extensão no banco (Vercel Postgres).

### 4. Permissões: operador cria/edita, apenas ADMIN desativa
**Decisão**: Todos os endpoints usam `get_current_user`, exceto `DELETE /customers/{id}` (`require_admin`). `PATCH /customers/{id}` aceita `is_active`, mas se o campo estiver em `payload.model_fields_set` e o usuário não for ADMIN → 403 "Acesso restrito ao ADMIN". Endereços (criar/editar/remover) liberados a todos os autenticados.
**Rationale**: O operador cadastra clientes durante o atendimento (inclusive pelo checkout); desativar é ação administrativa que afeta a busca de todos. Remover endereço é corriqueiro (cliente mudou-se) e não afeta vendas, pois o endereço da venda é snapshot.
**Alternativa**: CRUD inteiro restrito a ADMIN (como produtos). Rejeitada: inviabiliza o cadastro rápido no checkout.

### 5. Exclusão lógica de cliente, física de endereço
**Decisão**: `DELETE /customers/{id}` → `is_active = false` (retorna `CustomerOut`). Reativação via `PATCH` com `is_active: true` (ADMIN). `DELETE /customers/{id}/addresses/{address_id}` remove fisicamente (204).
**Rationale**: Preserva `sales.customer_id`. Endereços não são referenciados por vendas (snapshot), então podem ser apagados. Atenção: `delivery-zones-and-fee` não referencia endereços a partir de vendas (usa `Sale.delivery_zone_id`), mantendo isso válido.

### 6. Regra de endereço padrão no service
**Decisão**: Lógica em um helper do router/serviço (`app/services/customer_service.py`): ao criar/editar com `is_default: true`, zera os demais; o primeiro endereço do cliente vira padrão; ao remover o padrão, promove o endereço de menor `id` restante. Sem índice parcial único no banco.
**Rationale**: Regra simples, testável e sem depender de constraint parcial no PostgreSQL.

### 7. Schemas (em `app/schemas/schemas.py`, seção `# ─── Customers`)
**Decisão**: `CustomerAddressCreate` (street, number?, complement?, neighborhood, reference?, is_default=false), `CustomerAddressUpdate` (todos opcionais), `CustomerAddressOut`; `CustomerCreate` (name, phone?, notes?, addresses: list[CustomerAddressCreate] = []), `CustomerUpdate` (name?, phone?, notes?, is_active?), `CustomerOut` (id, name, phone, notes, is_active, created_at, addresses). `UpdateOrderDetailsRequest` ganha `customer_id: Optional[int] = None`; `SaleOut` ganha `customer_id: Optional[int] = None`.

### 8. `customer_id` em `PATCH /sales/{id}/order-details` respeitando null explícito
**Decisão**: O router mantém `model_dump(exclude_none=True)` para os campos existentes (sem mudar comportamento atual) e acrescenta `customer_id` ao `data` quando `"customer_id" in payload.model_fields_set` (mesmo se `None`). `SaleService.update_order_details` inclui `customer_id` nos `updatable_fields` e, se não-nulo, valida: inexistente → 404 "Cliente não encontrado"; inativo → 400 "Cliente inativo".
**Rationale**: Permite desvincular (nome editado após seleção) sem alterar a semântica dos demais campos, que hoje ignoram `null`.
**Alternativa**: trocar para `exclude_unset=True` para todos os campos. Rejeitada nesta change: muda o comportamento de limpeza de `order_type`/campos de entrega, fora do escopo.

### 9. Snapshot preenchido pelo frontend
**Decisão**: O backend não copia dados do cliente para a venda. O checkout continua enviando `customer_name`, `customer_phone` e `delivery_address` (texto). O endereço é formatado no frontend por um utilitário `formatAddress(addr)` em `core/models/customer.model.ts`: `"{street}, {number} - {complement} - {neighborhood} (Ref: {reference})"`, omitindo partes vazias, truncado a 500 caracteres.
**Rationale**: Mantém o operador livre para ajustar o texto (ex.: telefone alternativo) e não altera `finalize_sale`. Futuras changes (comanda, quadro de pedidos) leem apenas o snapshot.
**Alternativa**: backend preencher snapshot a partir de `customer_id`/`address_id`. Rejeitada: acoplaria a venda ao endereço e impediria edição livre.

### 10. Frontend
**Decisão**:
- `core/models/customer.model.ts` (`Customer`, `CustomerAddress`, `CustomerCreate`, `CustomerUpdate`, `CustomerAddressCreate`, `formatAddress`, `formatPhone`) exportado no barrel `core/models/index.ts`; `Sale` e `UpdateOrderDetailsRequest` ganham `customer_id?: number | null`.
- `core/services/customer.service.ts`: `search(q, activeOnly=true, limit=10)`, `list(activeOnly)`, `getById`, `create`, `update`, `deactivate`, `addAddress`, `updateAddress`, `removeAddress`.
- `pages/customers` (rota `customers`, sem `adminGuard`), seguindo `pages/products`: `app-data-table` com colunas Nome, Telefone, Bairro (endereço padrão), Ativo, ações; filtro local + checkbox "Mostrar inativos"; modal com dados do cliente e sub-lista editável de endereços (adicionar/editar/remover/definir padrão); botão desativar/reativar com `@if (authService.isAdmin())`.
- Sidebar: item `{ icon: '☺', label: 'Clientes', route: '/customers' }` após "Histórico de Vendas".
- Checkout etapa 1: signals `customerQuery`, `customerResults`, `selectedCustomer`, `showQuickCreate`; busca com debounce de 300 ms (Subject + `debounceTime` + `switchMap`), mínimo 2 caracteres, `limit=8`; dropdown abaixo do input com "Nome — telefone" e a opção final "+ Cadastrar \"{texto}\"" que abre mini-formulário (nome, telefone com máscara) → `create` → seleciona. Chip "Cliente vinculado ✕" quando há seleção. Editar o input após selecionar zera `selectedCustomer`. Se a venda já tiver `customer_id` ao abrir o modal, carrega `getById` para restaurar a seleção.
- Checkout etapa 2 (Entrega com cliente): lista de endereços como cards de rádio (padrão pré-selecionado), opções "Novo endereço" (mini-form estruturado → `addAddress` → seleciona e atualiza `selectedCustomer`) e "Outro endereço (não salvar)" (input livre atual). `customerPhone` pré-preenchido com `formatPhone(customer.phone)` se vazio. Sem cliente: input livre como hoje.
- Todos os payloads de `updateOrderDetails` (Balcão e Retirada/Entrega) enviam `customer_id: selectedCustomer()?.id ?? null`.

## Risks / Trade-offs

- [Risco] Deploy do backend antes do SQL → `sales.customer_id` inexistente quebra todas as queries de `Sale` (SQLAlchemy seleciona a coluna). → Mitigação: executar `add_customers.sql` antes do deploy (documentado em tasks e no cabeçalho do script); script idempotente (`IF NOT EXISTS`).
- [Risco] Clientes duplicados (mesmo cliente cadastrado duas vezes no checkout). → Mitigação: busca obrigatoriamente exibida antes da opção de cadastro rápido, busca por telefone; mesclagem fica para o futuro.
- [Risco] Busca sensível a acentos ("Joao" não encontra "João"). → Aceito no MVP; possível evolução com `unaccent`.
- [Trade-off] Snapshot textual montado no frontend pode divergir do cadastro — intencional (histórico fiel ao pedido).
- [Trade-off] `exclude_none` mantido nos demais campos de order-details: o comportamento existente de não limpar campos com `null` permanece (fora do escopo).
- [Risco] Requisições de busca em excesso durante digitação. → Debounce de 300 ms + `switchMap` cancelando requisições anteriores + `limit`.

## Migration Plan

1. Criar `pdv_API/migrations/add_customers.sql` (executável dentro de transação):
   - `CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(20), notes VARCHAR(500), is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT now());` + `CREATE INDEX IF NOT EXISTS ix_customers_name` / `ix_customers_phone`.
   - `CREATE TABLE IF NOT EXISTS customer_addresses (id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, street VARCHAR(255) NOT NULL, number VARCHAR(20), complement VARCHAR(100), neighborhood VARCHAR(100) NOT NULL, reference VARCHAR(255), is_default BOOLEAN NOT NULL DEFAULT FALSE);` + `ix_customer_addresses_customer_id`.
   - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;` + `CREATE INDEX IF NOT EXISTS ix_sales_customer_id ON sales(customer_id);`
2. Executar o script no PostgreSQL (local e produção) **antes** do deploy do backend.
3. Deploy do backend (`create_all` não recria nada, tabelas já existem).
4. Deploy do frontend.

**Rollback**: o frontend/backend anteriores ignoram as novas tabelas e a coluna nullable. Para remover: `ALTER TABLE sales DROP COLUMN IF EXISTS customer_id; DROP TABLE IF EXISTS customer_addresses; DROP TABLE IF EXISTS customers;` (perde o cadastro).
