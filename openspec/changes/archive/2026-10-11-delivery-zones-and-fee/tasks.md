## 0. Pré-requisito

- [x] 0.1 Confirmar que a change `customer-registry` está implementada (models `Customer`/`CustomerAddress`, router `/customers`, checkout com seleção de cliente/endereço) e que `pdv_API/migrations/add_customers.sql` foi executado no banco alvo

## 1. Banco de dados — Migração SQL

- [x] 1.1 Criar `pdv_API/migrations/add_delivery_zones.sql` com cabeçalho "executar após add_customers.sql e antes do deploy do backend" e guarda `DO $$ ... RAISE EXCEPTION` se `customer_addresses` não existir
- [x] 1.2 No script: `CREATE TABLE IF NOT EXISTS delivery_zones` (name VARCHAR(100), fee NUMERIC(10,2) DEFAULT 0 CHECK ≥ 0, is_active) + índice único `lower(name)`
- [x] 1.3 No script: `ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS delivery_zone_id` (FK `ON DELETE SET NULL`) + índice
- [x] 1.4 No script: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0` e `delivery_zone_id` (FK `ON DELETE SET NULL`) + índice
- [x] 1.5 Executar em banco local, conferir com `\d sales`, `\d customer_addresses`, `\d delivery_zones` e reexecutar para confirmar idempotência

## 2. Backend — Modelos

- [x] 2.1 Criar `pdv_API/app/models/delivery_zone.py` com `DeliveryZone` (id, name, fee, is_active)
- [x] 2.2 Em `pdv_API/app/models/customer.py`, adicionar `CustomerAddress.delivery_zone_id` (FK `delivery_zones.id`, `ondelete="SET NULL"`, nullable, index) e relação `delivery_zone`
- [x] 2.3 Em `pdv_API/app/models/sale.py`, adicionar `delivery_fee` (Numeric(10,2), default 0, `server_default="0"`), `delivery_zone_id` (FK, `SET NULL`, nullable, index), relação `delivery_zone` e propriedades `items_total` e `delivery_zone_name`
- [x] 2.4 Registrar `DeliveryZone` em `pdv_API/app/models/__init__.py`

## 3. Backend — Schemas

- [x] 3.1 Em `pdv_API/app/schemas/schemas.py`, seção `# ─── Delivery Zones`: `DeliveryZoneCreate` (name 2–100 com strip, fee ≥ 0, 2 casas), `DeliveryZoneUpdate` (opcionais + `is_active`), `DeliveryZoneOut`, `DeliveryZoneBrief`
- [x] 3.2 Adicionar `delivery_zone_id` em `CustomerAddressCreate`/`CustomerAddressUpdate` e `delivery_zone_id` + `delivery_zone: DeliveryZoneBrief | None` em `CustomerAddressOut`
- [x] 3.3 Adicionar `delivery_zone_id: Optional[int]` e `delivery_fee: Optional[Decimal]` (ge=0, le=9999.99) em `UpdateOrderDetailsRequest`
- [x] 3.4 Adicionar `items_total`, `delivery_fee`, `delivery_zone_id`, `delivery_zone_name` em `SaleOut`

## 4. Backend — Router de zonas

- [x] 4.1 Criar `pdv_API/app/routers/delivery_zones.py` (prefix `/delivery-zones`): `GET /` (`get_current_user`, `active_only=true`, ordem por nome)
- [x] 4.2 Implementar `POST /` (201), `PATCH /{id}` e `DELETE /{id}` (lógico) com `require_admin`; 404 "Zona de entrega não encontrada"; 409 "Já existe uma zona com este nome" (checagem case-insensitive, ignorando a própria zona no PATCH)
- [x] 4.3 Incluir o router em `pdv_API/main.py`

## 5. Backend — Endereço com zona

- [x] 5.1 Criar helper `validate_active_zone(db, zone_id)` (404 inexistente / 400 "Zona de entrega inativa") reutilizável por clientes e vendas
- [x] 5.2 Em `pdv_API/app/services/customer_service.py` / `app/routers/customers.py`, validar e aplicar `delivery_zone_id` na criação de endereços (inclusive endereços iniciais de `POST /customers`) e no PATCH quando presente em `model_fields_set` (aceitando `null`)
- [x] 5.3 Carregar `delivery_zone` junto dos endereços na busca/consulta de clientes (`selectinload`)

## 6. Backend — Taxa na venda

- [x] 6.1 Alterar `SaleService._recalculate_total` (`pdv_API/app/services/sale_service.py`) para `items_total + delivery_fee`
- [x] 6.2 Em `SaleService.update_order_details`, aplicar as regras do design (Decisão 3): zerar taxa/zona fora de DELIVERY; validar zona (inativa só se diferente da atual); taxa da zona quando `delivery_fee` ausente e zona alterada; recalcular total
- [x] 6.3 Em `pdv_API/app/routers/sales.py` (`update_order_details`), incluir `order_type` e `delivery_zone_id` no `data` quando presentes em `payload.model_fields_set`, mesmo se `None`
- [x] 6.4 Confirmar que `finalize_sale` valida pagamentos contra o `total_amount` com taxa e que `cancel_sale` não altera `delivery_fee`/`total_amount` (sem mudança de código esperada)

## 7. Frontend — Modelos e Service

- [x] 7.1 Criar `pdv_View/src/app/core/models/delivery-zone.model.ts` e exportar no barrel `core/models/index.ts`
- [x] 7.2 Atualizar `core/models/sale.model.ts` (`items_total`, `delivery_fee`, `delivery_zone_id`, `delivery_zone_name`; `UpdateOrderDetailsRequest` com `delivery_zone_id`, `delivery_fee`) e `core/models/customer.model.ts` (`delivery_zone_id`, `delivery_zone`)
- [x] 7.3 Criar `pdv_View/src/app/core/services/delivery-zone.service.ts` (`list`, `create`, `update`, `deactivate`)

## 8. Frontend — Página Zonas de Entrega

- [x] 8.1 Criar `pdv_View/src/app/pages/delivery-zones/` seguindo `pages/products`: `app-data-table` (Nome, Taxa em R$, Status, ações) e checkbox "Mostrar inativas"
- [x] 8.2 Modal de cadastro/edição (nome, taxa) com mensagens de erro da API (409/422); desativar com confirmação e reativar
- [x] 8.3 Registrar rota `delivery-zones` com `adminGuard` em `pdv_View/src/app/app.routes.ts`
- [x] 8.4 Adicionar item "Zonas de Entrega" (`/delivery-zones`, `adminOnly: true`) em `shared/components/sidebar/sidebar.component.ts`, após "Clientes"

## 9. Frontend — Zona no cadastro de endereço

- [x] 9.1 Em `pages/customers` (formulário de endereço), adicionar `<select>` de zonas ativas + "Sem zona", com pré-seleção pela correspondência bairro = nome da zona (sem maiúsculas/espaços) enquanto o usuário não escolher manualmente
- [x] 9.2 Aplicar o mesmo seletor no mini-form "Novo endereço" do checkout e exibir o nome da zona nos cards de endereço

## 10. Frontend — Checkout com taxa

- [x] 10.1 Em `pages/sales/sale-checkout-modal/sale-checkout-modal.component.ts`, criar signal `currentSale` (inicial = `@Input sale`) atualizado com a resposta de `updateOrderDetails` (Balcão e `confirmDetails`); trocar todos os usos de `this.sale.total_amount` (`remainingAmount`, `_initPaymentEntries`) por `currentSale()`
- [x] 10.2 Carregar zonas ativas no `ngOnInit`; signals `deliveryZoneId` (`number | 'MANUAL' | null`) e `deliveryFee`; restaurar da venda quando já houver zona/taxa
- [x] 10.3 Ao selecionar endereço com zona ativa → preencher zona e taxa; endereço sem zona/inativa/avulso → `deliveryZoneId = null`; trocar zona → taxa = taxa da zona
- [x] 10.4 Estender `deliveryFieldsValid` para exigir zona ou `'MANUAL'` com taxa ≥ 0 em Entrega; exibir erro no seletor
- [x] 10.5 Em `_buildOrderDetailsPayload`, enviar `delivery_zone_id` (null em manual) e `delivery_fee` somente para Entrega
- [x] 10.6 No template, exibir seletor de zona e input de taxa (máscara monetária/`type=number step=0.01`) apenas em Entrega; resumo e etapa de pagamento com linhas Itens / Taxa de entrega / Total usando `currentSale()`
- [x] 10.7 Em `pages/sales/sales.html`, exibir "Itens" e "Taxa de entrega" no resumo do carrinho quando `delivery_fee > 0`
- [x] 10.8 Estilizar em `sale-checkout-modal.scss` com tokens de `src/styles.scss`, garantindo layout em telas pequenas

## 11. Testes manuais

- [x] 11.1 API: CRUD de zonas como ADMIN (201, nome duplicado case-insensitive → 409, taxa negativa → 422); como OPERATOR: `GET` ok, `POST/PATCH/DELETE` → 403
- [x] 11.2 API: endereço com zona válida, zona inativa (400), inexistente (404), `delivery_zone_id: null` remove vínculo; `GET /customers/{id}` retorna zona resumida
- [x] 11.3 API: order-details Entrega com zona sem taxa → taxa da zona; com taxa → sobrescrita; sem zona + taxa manual; zona inativa nova → 400; re-salvar com a mesma zona já desativada → ok
- [x] 11.4 API: Entrega com taxa → PATCH `order_type: "PICKUP"` e depois `order_type: null` → taxa 0, zona null, tipo Balcão, total = itens
- [x] 11.5 API: adicionar/alterar/remover item numa venda com taxa → `total_amount = items_total + delivery_fee`
- [x] 11.6 API: finalizar Entrega paga com pagamentos = itens (422) e = itens + taxa (PAID); Entrega não paga → PENDING com total com taxa; cancelar → taxa mantida
- [x] 11.7 API: venda antiga → `delivery_fee: 0`, `items_total == total_amount`
- [ ] 11.8 UI: página Zonas de Entrega como ADMIN; menu oculto e rota redirecionada para OPERATOR
- [ ] 11.9 UI: fluxo completo — cliente novo por telefone → novo endereço (zona sugerida pelo bairro) → taxa preenchida → horário → "Já pago?" não → pedido PENDING com total correto
- [ ] 11.10 UI: endereço sem zona bloqueia avanço até escolher zona ou taxa manual; editar taxa sugerida; Retirada e Balcão sem campos de taxa; pagamento pré-preenchido e troco sobre o total geral
- [ ] 11.11 UI: alterar a taxa da zona após um pedido e confirmar no histórico que o total da venda não mudou
