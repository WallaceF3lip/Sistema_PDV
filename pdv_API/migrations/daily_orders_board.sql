-- Migração: quadro de pedidos do dia (daily-orders-board).
--   - sales.paid_at        (momento do recebimento; finalização PAID ou quitação)
--   - sales.business_date  (dia de operação, America/Sao_Paulo + hora de virada)
--   - sales.daily_number   (número sequencial do pedido no dia de operação)
--   - índice ix_sales_business_date e índice único parcial
--     ux_sales_business_date_daily_number (business_date, daily_number)
--   - tabela daily_order_counters (contador por dia de operação)
--   - backfill: paid_at = closed_at (PAID); business_date pelo closed_at em
--     America/Sao_Paulo (status <> OPEN, virada à meia-noite). daily_number
--     NÃO é preenchido para vendas antigas (exibidas como "Venda #id").
--
-- ORDEM OBRIGATÓRIA: executar APÓS add_customers.sql, add_delivery_zones.sql
-- e single_cash_register.sql, e ANTES do deploy do backend com o novo código.
-- O SQLAlchemy passa a selecionar as novas colunas em todas as queries de
-- Sale; sem elas, a API quebra.
--
-- Script idempotente (IF NOT EXISTS / backfill só onde nulo).
--
-- Rollback:
--   DROP INDEX IF EXISTS ux_sales_business_date_daily_number;
--   DROP INDEX IF EXISTS ix_sales_business_date;
--   ALTER TABLE sales DROP COLUMN IF EXISTS daily_number,
--                     DROP COLUMN IF EXISTS business_date,
--                     DROP COLUMN IF EXISTS paid_at;
--   DROP TABLE IF EXISTS daily_order_counters;

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'cash_register_id'
    ) THEN
        RAISE EXCEPTION 'Coluna sales.cash_register_id não existe: execute single_cash_register.sql antes de daily_orders_board.sql';
    END IF;
END $$;

-- Colunas novas em sales
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS business_date DATE NULL,
    ADD COLUMN IF NOT EXISTS daily_number INTEGER NULL;

CREATE INDEX IF NOT EXISTS ix_sales_business_date ON sales (business_date);

-- Unicidade do número do pedido por dia de operação (rede de segurança)
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_business_date_daily_number
    ON sales (business_date, daily_number)
    WHERE daily_number IS NOT NULL;

-- Contador por dia de operação (UPSERT atômico na finalização)
CREATE TABLE IF NOT EXISTS daily_order_counters (
    business_date DATE PRIMARY KEY,
    last_number INTEGER NOT NULL CHECK (last_number >= 0)
);

-- Backfill
UPDATE sales
SET paid_at = closed_at
WHERE status = 'PAID' AND paid_at IS NULL;

UPDATE sales
SET business_date = (closed_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE status <> 'OPEN' AND closed_at IS NOT NULL AND business_date IS NULL;

COMMIT;
