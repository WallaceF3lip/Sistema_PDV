## 1. Banco de dados — Migração SQL

- [x] 1.1 Criar `pdv_API/migrations/add_customers.sql` com cabeçalho explicando "executar antes do deploy do backend", contendo `CREATE TABLE IF NOT EXISTS customers` e `customer_addresses` (colunas, FKs e índices conforme design.md › Migration Plan)
- [x] 1.2 No mesmo script, adicionar `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL` e `CREATE INDEX IF NOT EXISTS ix_sales_customer_id`
- [x] 1.3 Executar o script em um banco local e confirmar com `\d sales` e `\d customer_addresses` que colunas/FKs existem; reexecutar para confirmar idempotência

## 2. Backend — Modelos

- [x] 2.1 Criar `pdv_API/app/models/customer.py` com `Customer` e `CustomerAddress` (campos, FK `ondelete="CASCADE"`, relação `addresses` com cascade `all, delete-orphan` ordenada por `is_default desc, id`)
- [x] 2.2 Adicionar `customer_id` (FK `customers.id`, `ondelete="SET NULL"`, nullable, index) e relação `customer` em `Sale` (`pdv_API/app/models/sale.py`)
- [x] 2.3 Registrar `Customer` e `CustomerAddress` em `pdv_API/app/models/__init__.py` (import e `__all__`)

## 3. Backend — Schemas

- [x] 3.1 Em `pdv_API/app/schemas/schemas.py`, criar seção `# ─── Customers` com `CustomerAddressCreate`, `CustomerAddressUpdate`, `CustomerAddressOut`, `CustomerCreate`, `CustomerUpdate`, `CustomerOut` (`from_attributes`)
- [x] 3.2 Implementar `field_validator` de telefone (remove não-dígitos, vazio → `None`, exige 10–11 dígitos, erro "Telefone inválido") em `CustomerCreate` e `CustomerUpdate`
- [x] 3.3 Adicionar `customer_id: Optional[int] = None` em `UpdateOrderDetailsRequest` e em `SaleOut`

## 4. Backend — Service e Router de clientes

- [x] 4.1 Criar `pdv_API/app/services/customer_service.py` com: `search(db, q, active_only, limit)` (ILIKE nome OR telefone por dígitos, ordenado por nome, `selectinload(addresses)`), `get_or_404`, `create` (com endereços iniciais), `update`, `deactivate`
- [x] 4.2 Implementar no service as regras de endereço padrão: primeiro endereço vira padrão; `is_default: true` zera os demais; remover o padrão promove o de menor `id`; endereço de outro cliente → 404 "Endereço não encontrado"
- [x] 4.3 Criar `pdv_API/app/routers/customers.py` (prefix `/customers`): `GET /` (q, active_only=true, limit=50 máx. 200), `GET /{id}`, `POST /` (201), `PATCH /{id}`, `DELETE /{id}` com `require_admin` (exclusão lógica)
- [x] 4.4 No `PATCH /customers/{id}`, retornar 403 "Acesso restrito ao ADMIN" quando `is_active` estiver em `payload.model_fields_set` e o usuário não for ADMIN
- [x] 4.5 Adicionar rotas de endereço: `POST /{id}/addresses` (201), `PATCH /{id}/addresses/{address_id}`, `DELETE /{id}/addresses/{address_id}` (204)
- [x] 4.6 Incluir `customers.router` em `pdv_API/main.py`

## 5. Backend — Vínculo da venda

- [x] 5.1 Em `pdv_API/app/routers/sales.py` (`update_order_details`), acrescentar `customer_id` ao `data` quando `"customer_id" in payload.model_fields_set` (inclusive `None`), mantendo `exclude_none=True` para os demais campos
- [x] 5.2 Em `SaleService.update_order_details` (`pdv_API/app/services/sale_service.py`), incluir `customer_id` em `updatable_fields` e validar cliente não-nulo: inexistente → 404 "Cliente não encontrado"; inativo → 400 "Cliente inativo"
- [x] 5.3 Verificar via `/docs` que `SaleOut` retorna `customer_id` em `GET /sales/current`, `GET /sales/{id}` e `GET /sales`

## 6. Frontend — Modelos e Service

- [x] 6.1 Criar `pdv_View/src/app/core/models/customer.model.ts` (`Customer`, `CustomerAddress`, `CustomerCreate`, `CustomerUpdate`, `CustomerAddressCreate`, `CustomerAddressUpdate`) e helpers `formatAddress` (omite partes vazias, máx. 500 caracteres) e `formatPhone`
- [x] 6.2 Exportar `customer.model` no barrel `core/models/index.ts`
- [x] 6.3 Adicionar `customer_id?: number | null` em `Sale` e `UpdateOrderDetailsRequest` (`core/models/sale.model.ts`)
- [x] 6.4 Criar `pdv_View/src/app/core/services/customer.service.ts` com `search`, `list`, `getById`, `create`, `update`, `deactivate`, `addAddress`, `updateAddress`, `removeAddress`

## 7. Frontend — Página Clientes

- [x] 7.1 Criar `pdv_View/src/app/pages/customers/` (`customers.component.ts`, `customers.html`, `customers.scss`) seguindo `pages/products`: `app-data-table` com colunas Nome, Telefone (formatado), Bairro (endereço padrão), Ativo e ações
- [x] 7.2 Adicionar campo de busca (filtra nome/telefone) e checkbox "Mostrar inativos" (recarrega com `active_only=false`)
- [x] 7.3 Implementar modal de cadastro/edição (nome, telefone com máscara, observação) com sub-lista de endereços: adicionar, editar, remover e definir padrão
- [x] 7.4 Exibir botões Desativar/Reativar somente quando `authService.isAdmin()`, com confirmação antes de desativar
- [x] 7.5 Registrar a rota `customers` em `pdv_View/src/app/app.routes.ts` (sem `adminGuard`)
- [x] 7.6 Adicionar item "Clientes" (`/customers`) no `navItems` de `shared/components/sidebar/sidebar.component.ts`, após "Histórico de Vendas"

## 8. Frontend — Checkout: seleção de cliente (etapa 1)

- [x] 8.1 Em `pages/sales/sale-checkout-modal/sale-checkout-modal.component.ts`, adicionar signals `customerResults`, `selectedCustomer`, `showCustomerDropdown`, `showQuickCreate`, `quickCreatePhone` e busca com debounce 300 ms + `switchMap` (mín. 2 caracteres, `limit=8`, apenas ativos)
- [x] 8.2 No template, transformar o input de nome em autocomplete: dropdown "Nome — telefone", opção final "+ Cadastrar \"{texto}\"", chip "Cliente vinculado ✕"
- [x] 8.3 Ao selecionar cliente: preencher `customerName` e `customerPhone` (se vazio); ao editar o nome depois da seleção ou clicar ✕: limpar `selectedCustomer`
- [x] 8.4 Implementar mini-formulário de cadastro rápido (nome, telefone com máscara) que chama `customerService.create` e seleciona o cliente; em erro, exibir mensagem e manter os dados
- [x] 8.5 Em `ngOnInit`, se `sale.customer_id` existir, carregar `getById` e restaurar `selectedCustomer`
- [x] 8.6 Enviar `customer_id: selectedCustomer()?.id ?? null` no payload de `advanceStep()` (Balcão) e em `_buildOrderDetailsPayload()` (Retirada/Entrega)

## 9. Frontend — Checkout: seleção de endereço (etapa 2)

- [x] 9.1 Quando Entrega e há `selectedCustomer`, exibir os endereços como cards de rádio com o padrão pré-selecionado e preencher `deliveryAddress` com `formatAddress`
- [x] 9.2 Adicionar opção "Novo endereço" (rua, número, complemento, bairro, referência) que chama `addAddress`, atualiza `selectedCustomer` e seleciona o endereço criado
- [x] 9.3 Adicionar opção "Outro endereço (não salvar)" que mostra o input livre atual; sem cliente vinculado, manter apenas o input livre
- [x] 9.4 Quando o cliente não tiver endereços, abrir direto o formulário de novo endereço (com a opção avulsa disponível)
- [x] 9.5 Estilizar autocomplete, chip, cards de endereço e mini-formulários em `sale-checkout-modal.scss` usando os tokens de `src/styles.scss`, garantindo layout em telas pequenas

## 10. Testes manuais

- [ ] 10.1 API (`/docs`): criar cliente como OPERATOR com telefone formatado → 201 e telefone só dígitos; telefone com 8 dígitos → 422
- [ ] 10.2 API: `GET /customers?q=` por parte do nome e por parte do telefone formatado; confirmar ordenação e ocultação de inativos
- [ ] 10.3 API: `DELETE /customers/{id}` como OPERATOR → 403; como ADMIN → `is_active: false`; `PATCH` com `is_active` como OPERATOR → 403
- [ ] 10.4 API: endereços — primeiro vira padrão, trocar padrão, remover padrão promove outro, `address_id` de outro cliente → 404
- [ ] 10.5 API: `PATCH /sales/{id}/order-details` com `customer_id` válido, inexistente (404), inativo (400) e `null` explícito (desvincula); omitido mantém vínculo
- [ ] 10.6 UI: página Clientes como OPERATOR (sem botão desativar) e como ADMIN (desativar/reativar, mostrar inativos); item "Clientes" no sidebar
- [ ] 10.7 UI: checkout Balcão selecionando cliente existente → venda salva com `customer_id` e `customer_name`; checkout com nome livre → `customer_id` nulo
- [ ] 10.8 UI: checkout Entrega com cadastro rápido de cliente + novo endereço → `delivery_address` formatado e endereço salvo no cadastro; endereço avulso não é salvo
- [ ] 10.9 UI: editar o telefone/endereço do cliente após a venda e confirmar no histórico que a venda mantém o snapshot original
