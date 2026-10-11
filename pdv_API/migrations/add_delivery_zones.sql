-- Migração: zonas de entrega e taxa de entrega na venda.
--   - nova tabela delivery_zones (nome único sem diferenciar maiúsculas, taxa >= 0)
--   - customer_addresses.delivery_zone_id (FK opcional)
--   - sales.delivery_fee (default 0) e sales.delivery_zone_id (FK opcional)
--
-- ORDEM OBRIGATÓRIA: executar APÓS add_customers.sql e ANTES do deploy
-- do backend com o novo código. O SQLAlchemy passa a selecionar
-- sales.delivery_fee / sales.delivery_zone_id em todas as queries de Sale;
-- sem as colunas, a API quebra.
--
-- Script idempotente (IF NOT EXISTS). Nenhum backfill é necessário:
-- vendas existentes ficam com delivery_fee = 0 e total_amount inalterado.
--
-- Rollback (perde zonas e taxas registradas):
--   ALTER TABLE sales DROP COLUMN IF EXISTS delivery_zone_id, DROP COLUMN IF EXISTS delivery_fee;
--   ALTER TABLE customer_addresses DROP COLUMN IF EXISTS delivery_zone_id;
--   DROP TABLE IF EXISTS delivery_zones;

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.customer_addresses') IS NULL THEN
        RAISE EXCEPTION 'Tabela customer_addresses não existe: execute add_customers.sql antes de add_delivery_zones.sql';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_zones (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    fee        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_delivery_zones_id ON delivery_zones (id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_zones_name_lower ON delivery_zones (lower(name));

ALTER TABLE customer_addresses
    ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_customer_addresses_delivery_zone_id ON customer_addresses (delivery_zone_id);

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_sales_delivery_zone_id ON sales (delivery_zone_id);

COMMIT;
