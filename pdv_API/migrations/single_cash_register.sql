-- Migração: caixa único compartilhado (single-cash-register).
--   - novo valor SALE_CANCEL em cashmovementtypeenum (estorno de venda)
--   - cash_registers.closed_by_user_id (quem fechou)
--   - cash_movements.payment_method (paymentmethodenum) e cash_movements.sale_id
--   - sales.cash_register_id (caixa que recebeu a venda)
--   - fechamento automático de caixas OPEN excedentes (mantém o mais recente)
--   - índice único parcial: no máximo um caixa OPEN no sistema
--
-- ORDEM OBRIGATÓRIA: executar APÓS add_customers.sql e add_delivery_zones.sql
-- e ANTES do deploy do backend com o novo código. O SQLAlchemy passa a
-- selecionar as novas colunas em todas as queries de Sale/CashMovement/
-- CashRegister; sem elas, a API quebra.
--
-- Recomendado antes de executar: o ADMIN fecha pela UI os caixas abertos,
-- deixando no máximo um. Conferir com:
--   SELECT id, user_id, opened_at FROM cash_registers WHERE status = 'OPEN' ORDER BY opened_at;
--
-- Script idempotente (IF NOT EXISTS). Sem backfill de sales.cash_register_id.
--
-- Rollback (o valor SALE_CANCEL permanece no enum — PG não remove valores;
-- movimentos SALE_CANCEL devem ser removidos/convertidos antes de voltar ao
-- código antigo):
--   DROP INDEX IF EXISTS ux_cash_registers_single_open;
--   ALTER TABLE sales DROP COLUMN IF EXISTS cash_register_id;
--   ALTER TABLE cash_movements DROP COLUMN IF EXISTS sale_id, DROP COLUMN IF EXISTS payment_method;
--   ALTER TABLE cash_registers DROP COLUMN IF EXISTS closed_by_user_id;


-- ═══ Parte 1 — FORA de transação ═══════════════════════════════════════════
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de BEGIN/COMMIT junto com
-- o uso do novo valor. Execute esta instrução isoladamente.

ALTER TYPE cashmovementtypeenum ADD VALUE IF NOT EXISTS 'SALE_CANCEL';


-- ═══ Parte 2 — transação ═══════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'delivery_fee'
    ) THEN
        RAISE EXCEPTION 'Coluna sales.delivery_fee não existe: execute add_delivery_zones.sql antes de single_cash_register.sql';
    END IF;
END $$;

-- Quem fechou o caixa
ALTER TABLE cash_registers
    ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users (id) ON DELETE RESTRICT;

-- Forma de pagamento e venda de origem no movimento (SALE / SALE_CANCEL)
ALTER TABLE cash_movements
    ADD COLUMN IF NOT EXISTS payment_method paymentmethodenum NULL;

ALTER TABLE cash_movements
    ADD COLUMN IF NOT EXISTS sale_id INTEGER REFERENCES sales (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_cash_movements_sale_id ON cash_movements (sale_id);

-- Caixa que recebeu a venda
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS cash_register_id INTEGER REFERENCES cash_registers (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_sales_cash_register_id ON sales (cash_register_id);

-- Correção de dados: fecha automaticamente os caixas OPEN excedentes,
-- mantendo aberto apenas o de maior opened_at. Saldo em dinheiro =
-- OPENING + SUPRIMENTO + SALE − SANGRIA (não existem SALE/SALE_CANCEL com
-- forma de pagamento antes desta migração). Diferença registrada = 0,
-- auditável pela nota.
CREATE TEMP TABLE _scr_to_close ON COMMIT DROP AS
SELECT r.id,
       r.user_id,
       COALESCE((
           SELECT SUM(CASE
                          WHEN m.type IN ('OPENING', 'SUPRIMENTO', 'SALE') THEN m.amount
                          WHEN m.type = 'SANGRIA' THEN -m.amount
                          ELSE 0
                      END)
           FROM cash_movements m
           WHERE m.cash_register_id = r.id
       ), 0)::NUMERIC(10, 2) AS balance
FROM cash_registers r
WHERE r.status = 'OPEN'
  AND r.id <> (
      SELECT id FROM cash_registers
      WHERE status = 'OPEN'
      ORDER BY opened_at DESC, id DESC
      LIMIT 1
  );

INSERT INTO cash_movements (cash_register_id, type, amount, description, user_id, created_at)
SELECT c.id,
       'CLOSING',
       c.balance,
       'Fechamento automático (migração single-cash-register) — contagem: ' || c.balance || ', esperado: ' || c.balance,
       c.user_id,
       now()
FROM _scr_to_close c;

UPDATE cash_registers r
SET status = 'CLOSED',
    closed_at = now(),
    closing_amount = c.balance,
    -- trunca a nota original (String(255)) para preservar o marcador de auditoria
    notes = LEFT(COALESCE(r.notes, ''), 190) || ' [Fechado automaticamente na migração single-cash-register]'
FROM _scr_to_close c
WHERE r.id = c.id;

-- Unicidade: no máximo um caixa OPEN no sistema
CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_registers_single_open
    ON cash_registers ((true))
    WHERE status = 'OPEN';

COMMIT;
