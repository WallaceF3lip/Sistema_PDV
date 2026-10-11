-- Migração: cadastro de clientes (customers / customer_addresses)
-- e vínculo opcional da venda ao cliente (sales.customer_id).
--
-- IMPORTANTE: execute este script no banco PostgreSQL ANTES do deploy
-- do backend com o novo código. O SQLAlchemy passa a selecionar
-- sales.customer_id em todas as queries de Sale; sem a coluna, a API quebra.
--
-- Script idempotente (IF NOT EXISTS) e seguro para rodar dentro de uma transação.
--
-- Rollback (perde o cadastro de clientes):
--   ALTER TABLE sales DROP COLUMN IF EXISTS customer_id;
--   DROP TABLE IF EXISTS customer_addresses;
--   DROP TABLE IF EXISTS customers;

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(20),
    notes       VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_customers_id ON customers (id);
CREATE INDEX IF NOT EXISTS ix_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS ix_customers_phone ON customers (phone);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id            SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    street        VARCHAR(255) NOT NULL,
    number        VARCHAR(20),
    complement    VARCHAR(100),
    neighborhood  VARCHAR(100) NOT NULL,
    reference     VARCHAR(255),
    is_default    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS ix_customer_addresses_id ON customer_addresses (id);
CREATE INDEX IF NOT EXISTS ix_customer_addresses_customer_id ON customer_addresses (customer_id);

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_sales_customer_id ON sales (customer_id);

COMMIT;
