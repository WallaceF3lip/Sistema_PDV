## Context

Veja proposal.md (Why). **Pré-requisito**: change `customer-registry` implementada (tabelas `customers`/`customer_addresses` com `neighborhood` obrigatório, `Sale.customer_id`, router `/customers`, `app/services/customer_service.py`, `formatAddress` no frontend, seleção de cliente na etapa 1 e de endereço na etapa 2 do checkout, script `add_customers.sql`). Estado atual relevante:

- `pdv_API/app/models/sale.py`: `Sale.total_amount` Numeric(10,2) é hoje apenas a soma dos itens; não há taxa de entrega.
- `pdv_API/app/services/sale_service.py`: `_recalculate_total(sale)` soma `item.subtotal` e é chamado por `add_item`, `remove_item` e `update_item`. `finalize_sale` compara `sum(payments) != total_amount` (exato) exceto em reserva (`PICKUP/DELIVERY` com `is_paid is False` → PENDING sem pagamentos). `update_order_details` aplica uma lista fixa `updatable_fields` só em venda OPEN. `cancel_sale` estorna estoque e não toca em valores.
- `pdv_API/app/routers/sales.py` → `PATCH /sales/{id}/order-details` usa `payload.model_dump(exclude_none=True)`: hoje o checkout Balcão envia `order_type: null`, que é **descartado** — uma venda que foi marcada como Entrega e depois voltou para Balcão continua `DELIVERY`. `customer-registry` já introduz o padrão "incluir campo se estiver em `model_fields_set`" para `customer_id`.
- `UpdateOrderDetailsRequest` (`app/schemas/schemas.py`) valida campos obrigatórios de entrega via `model_validator`.
- Frontend: `pages/sales/sale-checkout-modal` usa `this.sale.total_amount` (o `@Input`, nunca atualizado após o PATCH) no resumo (`checkout-total`), na etapa de pagamento (`payment-total`), em `_initPaymentEntries` e em `remainingAmount`. `confirmDetails()` ignora a resposta do PATCH. `pages/sales/sales.html` exibe `currentSale()?.total_amount` no carrinho. Dashboard e histórico somam/exibem `total_amount`.
- Sidebar: `navItems` com `adminOnly` em `shared/components/sidebar/sidebar.component.ts`; rota admin usa `canActivate: [adminGuard]` em `app.routes.ts`.

## Análise de cenário (fluxo de Entrega ponta a ponta)

1. **Cliente novo por telefone**: operador abre o checkout, escolhe Entrega e digita o telefone/nome na busca (etapa 1, `customer-registry`); sem resultado, usa "+ Cadastrar" (nome + telefone) → cliente vinculado.
2. **Endereço**: na etapa 2, como o cliente não tem endereços, abre "Novo endereço" (rua, número, bairro…). Ao digitar o bairro, o formulário sugere a zona ativa com nome igual ao bairro (comparação sem maiúsculas/espaços); o operador confirma ou troca → endereço salvo com `delivery_zone_id`.
3. **Zona → taxa**: com o endereço selecionado, o seletor de zona é preenchido com a zona do endereço e o campo de taxa com `zone.fee`. Operador pode trocar a zona (taxa acompanha) ou editar a taxa (sobrescrita, ex.: cortesia/distância).
4. **Horário**: `delivery_time` (padrão = hora atual) e telefone pré-preenchido do cliente.
5. **Pago ou não**: "Já pago?" — se **não**, informa a forma de pagamento esperada; ao confirmar, o PATCH grava zona/taxa e o total geral, e a venda é finalizada como PENDING (valor a receber = itens + taxa). Se **sim**, segue para pagamento com o total geral pré-preenchido.
6. **Finalizar**: `finalize_sale` valida pagamentos contra `total_amount` (com taxa), baixa estoque e fecha a venda. A taxa fica congelada na venda.

**Casos de borda**

| Caso | Comportamento |
|---|---|
| Endereço sem zona (cadastro antigo, bairro novo, endereço avulso) | Seletor vazio com erro até o operador escolher uma zona ou "Sem zona (taxa manual)" + valor. Backend aceita Entrega sem zona. Operador pode vincular a zona ao endereço depois na página Clientes. |
| Operador sobrescreve a taxa | `delivery_fee` enviado prevalece; `delivery_zone_id` é mantido para relatório por zona. |
| Zona desativada | Não aparece no seletor; endereço que aponta para ela é tratado como "sem zona" no checkout. Backend rejeita vincular zona inativa (400), exceto quando é a mesma zona já gravada na venda (re-salvar detalhes não quebra). Vendas/endereços antigos mantêm o vínculo. |
| Retirada (PICKUP) | Sem seletor/taxa; backend força `delivery_fee=0`, `delivery_zone_id=null`. |
| Balcão (order_type null) | Idem; `order_type: null` explícito passa a ser aplicado, corrigindo a troca Entrega → Balcão. |
| Cancelamento | `cancel_sale` não altera valores: a taxa permanece no registro (relatórios futuros filtram por status). |
| Itens alterados após definir a taxa | `_recalculate_total` soma itens + `delivery_fee`; a taxa não é recalculada a partir da zona. |
| Checkout fechado sem finalizar | A venda OPEN mantém a taxa; o carrinho mostra a taxa no resumo; ao reabrir o checkout, zona/taxa são restauradas da venda. |
| Taxa da zona alterada após o pedido | Venda mantém a taxa cobrada (valor copiado, não referência). |

## Goals / Non-Goals

**Goals:**
- Zonas de entrega com taxa fixa, administradas por ADMIN, no contrato definido (`delivery_zones`, `customer_addresses.delivery_zone_id`, `sales.delivery_fee`, `sales.delivery_zone_id`).
- `total_amount` como total geral único e consistente em todo o backend, com `items_total` explícito para quem precisa separar.
- Checkout que sugere a taxa e nunca deixa uma Entrega "esquecer" a taxa sem decisão explícita.

**Non-Goals:**
- Cálculo de taxa por distância/CEP, geolocalização, mapas ou faixas de valor mínimo/frete grátis acima de X.
- Mapeamento automático bairro → zona no backend (a sugestão é apenas no frontend, por nome igual).
- Múltiplos bairros por zona como entidade separada (o nome da zona pode listar bairros; ex.: "Centro / Vila Nova").
- Exibir a taxa no histórico de vendas, quadro de pedidos, comanda e relatórios (changes `daily-orders-board`, `order-ticket-printing`, `sales-reports` consomem os campos expostos aqui).
- Separar receita de itens e taxa no dashboard atual (continua somando `total_amount`).

## Decisions

### 1. Modelo `DeliveryZone` e FKs
**Decisão**: Novo `app/models/delivery_zone.py`: `DeliveryZone` (`id`, `name` String(100) not null, `fee` Numeric(10,2) not null default 0, `is_active` Boolean default true). Unicidade de nome case-insensitive via índice único `lower(name)` no SQL e checagem no router (409). `CustomerAddress.delivery_zone_id` e `Sale.delivery_zone_id`: Integer FK `delivery_zones.id` `ON DELETE SET NULL`, nullable, index. `Sale.delivery_fee` Numeric(10,2) not null default 0 (`server_default='0'`). Relações `CustomerAddress.delivery_zone` e `Sale.delivery_zone` (carregamento padrão; `selectinload` na busca de clientes).
**Rationale**: Taxa fixa por zona cobre o caso de um comércio local; `SET NULL` é defensivo (zonas não são excluídas fisicamente).
**Alternativa**: taxa no próprio endereço. Rejeitada: mudar a taxa de um bairro exigiria editar todos os endereços.

### 2. `total_amount` = total geral; `items_total` derivado
**Decisão**: `total_amount` passa a ser `items_total + delivery_fee`, persistido. `items_total` é uma propriedade Python em `Sale` (`sum(subtotal)`), exposta em `SaleOut` (Pydantic lê atributos via `from_attributes`); `delivery_zone_name` idem (`self.delivery_zone.name if self.delivery_zone else None`). `_recalculate_total` passa a somar itens + `Decimal(str(sale.delivery_fee or 0))`.
**Rationale**: `finalize_sale`, o checkout, o histórico, o dashboard e as changes de caixa/relatórios já usam `total_amount` como "valor do pedido"; mantê-lo como total geral evita alterar todos os consumidores e a validação de pagamento passa a cobrar a taxa automaticamente. Vendas antigas ficam corretas sem backfill (taxa 0).
**Alternativa**: manter `total_amount` = itens e criar `grand_total`. Rejeitada: exigiria mudar a validação de pagamento e todos os consumidores, com risco de cobrar sem taxa.

### 3. Regras de taxa em `update_order_details`
**Decisão**: Após aplicar os campos existentes:
- Se `sale.order_type != DELIVERY` → `delivery_fee = 0`, `delivery_zone_id = None`.
- Se `DELIVERY`: se `delivery_zone_id` está em `data` → valida (404 inexistente; 400 inativa se diferente de `sale.delivery_zone_id`) e grava (pode ser `None`). Se `delivery_fee` está em `data` → grava; senão, se a zona mudou para uma zona não nula → `delivery_fee = zone.fee`. 
- Em seguida chama `_recalculate_total(sale)`.
Schema: `UpdateOrderDetailsRequest` ganha `delivery_zone_id: Optional[int] = None` e `delivery_fee: Optional[Decimal] = Field(None, ge=0, le=Decimal("9999.99"), decimal_places=2)`.
**Rationale**: Backend é a fonte de verdade da regra "só Entrega tem taxa"; o frontend sempre envia a taxa visível ao operador, então a sugestão no backend é rede de segurança para clientes de API.

### 4. Nulos explícitos em order-details (`order_type`, `delivery_zone_id`)
**Decisão**: O router mantém `model_dump(exclude_none=True)` para os demais campos e acrescenta ao `data`, quando presentes em `payload.model_fields_set` (mesmo `None`): `order_type` e `delivery_zone_id` (além de `customer_id`, já tratado por `customer-registry`).
**Rationale**: Sem isso, voltar de Entrega para Balcão não limpa o tipo e a taxa ficaria cobrada em Balcão — viola o requisito "Balcão não tem taxa". Escopo mínimo: só esses campos.
**Alternativa**: zerar a taxa no frontend enviando `delivery_fee: 0`. Rejeitada: a venda continuaria marcada como `DELIVERY`.

### 5. Endereço do cliente com zona
**Decisão**: `CustomerAddressCreate/Update` ganham `delivery_zone_id: Optional[int]`; `CustomerAddressOut` ganha `delivery_zone_id` e `delivery_zone: DeliveryZoneBrief | None` (`id`, `name`, `fee`, `is_active`). Validação em `customer_service` (helper `_validate_zone(db, zone_id)` compartilhado: 404/400). No `PATCH` de endereço, `delivery_zone_id` é aplicado se estiver em `model_fields_set` (permite `null`). Como `customer-management` ainda não está arquivada em `openspec/specs/`, o requisito é registrado como ADDED em `delivery-zone-management`.
**Rationale**: O checkout já recebe os endereços do cliente; incluir a zona resumida evita uma segunda requisição.

### 6. Permissões e router `/delivery-zones`
**Decisão**: `app/routers/delivery_zones.py`: `GET /` (`get_current_user`, `active_only=true`, ordenado por nome), `POST /` (201), `PATCH /{id}`, `DELETE /{id}` (lógico, retorna `DeliveryZoneOut`) com `require_admin`. Schemas `DeliveryZoneCreate` (name 2–100 com strip, fee ≥ 0), `DeliveryZoneUpdate` (opcionais + `is_active`), `DeliveryZoneOut`.
**Rationale**: Operador precisa listar zonas no checkout e no cadastro de endereço; cadastro de preço é decisão administrativa (mesmo padrão de produtos).

### 7. Frontend
**Decisão**:
- `core/models/delivery-zone.model.ts` (`DeliveryZone`, `DeliveryZoneCreate`, `DeliveryZoneUpdate`) no barrel; `Sale` ganha `items_total`, `delivery_fee`, `delivery_zone_id`, `delivery_zone_name`; `UpdateOrderDetailsRequest` ganha `delivery_zone_id?`, `delivery_fee?`; `CustomerAddress` ganha `delivery_zone_id` e `delivery_zone`.
- `core/services/delivery-zone.service.ts`: `list(activeOnly=true)`, `create`, `update`, `deactivate`. Valores numéricos da API (Decimal serializado como string) convertidos com `Number()`.
- `pages/delivery-zones` seguindo `pages/products`/`pages/customers`: `app-data-table` (Nome, Taxa, Status, ações), checkbox "Mostrar inativas", modal nome/taxa, desativar com confirmação/reativar. Rota `delivery-zones` com `adminGuard`; sidebar `{ icon: '⌖', label: 'Zonas de Entrega', route: '/delivery-zones', adminOnly: true }` após "Clientes".
- `pages/customers` (formulário de endereço) e mini-form "Novo endereço" do checkout: `<select>` de zonas ativas + "Sem zona"; ao alterar o bairro, se nenhuma zona foi escolhida manualmente, pré-seleciona a zona com `name.trim().toLowerCase() === neighborhood.trim().toLowerCase()`.
- Checkout: signal local `currentSale` (inicia com `@Input sale`, atualizado com a resposta de cada `updateOrderDetails`); resumo/pagamento/`remainingAmount`/`_initPaymentEntries` passam a usar `currentSale().total_amount`. Signals `zones`, `deliveryZoneId` (`number | 'MANUAL' | null`), `deliveryFee`, `feeTouched`. Ao selecionar endereço com zona ativa → zona + taxa; ao trocar zona → taxa = `zone.fee`. Validação `deliveryFieldsValid` exige zona ou `'MANUAL'` com taxa ≥ 0 quando Entrega. Payload envia `delivery_zone_id` (null em manual) e `delivery_fee`; Balcão/Retirada não enviam taxa (backend zera). Ao abrir com venda OPEN já com zona/taxa, restaura os valores.
- `pages/sales/sales.html`: no resumo do carrinho, quando `delivery_fee > 0`, linhas "Itens" e "Taxa de entrega" acima do total.

### 8. Migração SQL
**Decisão**: `pdv_API/migrations/add_delivery_zones.sql`, idempotente, executado **após** `add_customers.sql` e **antes** do deploy do backend (ver Migration Plan).

## Risks / Trade-offs

- [Risco] Deploy do backend antes do SQL → colunas `sales.delivery_fee`/`delivery_zone_id` inexistentes quebram toda query de `Sale`. → Mitigação: script obrigatório antes do deploy, cabeçalho explícito, `IF NOT EXISTS`.
- [Risco] Executar antes de `add_customers.sql` → `ALTER TABLE customer_addresses` falha. → Mitigação: ordem documentada no cabeçalho e em tasks; o script verifica com `DO $$ ... IF NOT EXISTS (tabela) THEN RAISE EXCEPTION` .
- [Trade-off] Dashboard e histórico passam a contar a taxa como receita (`total_amount`). → Aceito; `items_total`/`delivery_fee` disponíveis para `sales-reports` separar.
- [Risco] Taxa sobrescrita indevidamente (erro ou abuso). → Aceito no MVP (operador de confiança); `delivery_zone_id` mantido permite auditar divergência entre `delivery_fee` e a taxa da zona em relatórios.
- [Risco] Venda OPEN com taxa e checkout abandonado: carrinho mostra total maior que a soma dos itens. → Mitigação: linhas "Itens"/"Taxa de entrega" no carrinho deixam explícito.
- [Trade-off] `items_total` calculado em Python carrega `items` (já carregados pelo `SaleOut`), sem custo extra relevante.
- [Risco] Comparação exata `paid != total` com taxa decimal. → Sem mudança de risco: ambos `Decimal` com 2 casas; frontend arredonda a 2 casas.

## Migration Plan

1. Garantir que `pdv_API/migrations/add_customers.sql` (change `customer-registry`) já foi executado.
2. Criar e executar `pdv_API/migrations/add_delivery_zones.sql` (dentro de transação):
   - Guarda: `DO $$ BEGIN IF to_regclass('public.customer_addresses') IS NULL THEN RAISE EXCEPTION 'Execute add_customers.sql antes'; END IF; END $$;`
   - `CREATE TABLE IF NOT EXISTS delivery_zones (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0), is_active BOOLEAN NOT NULL DEFAULT TRUE);` + `CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_zones_name_lower ON delivery_zones (lower(name));`
   - `ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL;` + `CREATE INDEX IF NOT EXISTS ix_customer_addresses_delivery_zone_id ...`
   - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;` e `ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL;` + `CREATE INDEX IF NOT EXISTS ix_sales_delivery_zone_id ...`
   - Nenhum backfill: `total_amount` das vendas existentes já é igual a `items_total` (taxa 0).
3. Deploy do backend (`create_all` não recria nada).
4. Deploy do frontend; ADMIN cadastra as zonas e vincula endereços existentes pela página Clientes.

**Rollback**: backend/frontend anteriores ignoram as colunas novas (nullable/default 0), mas vendas criadas com taxa manterão `total_amount` com taxa. Remoção completa: `ALTER TABLE sales DROP COLUMN IF EXISTS delivery_zone_id, DROP COLUMN IF EXISTS delivery_fee; ALTER TABLE customer_addresses DROP COLUMN IF EXISTS delivery_zone_id; DROP TABLE IF EXISTS delivery_zones;`

## Open Questions

- Nome do ícone do item de menu e cores do badge de status podem ser ajustados na implementação sem impacto nos requisitos.
