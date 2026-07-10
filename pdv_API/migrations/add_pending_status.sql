-- Migração: adicionar valor PENDING ao enum salestatusenum
-- Execute este script uma única vez no banco de dados PostgreSQL
-- antes de fazer o deploy do backend com o novo código.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE não pode ser executado
-- dentro de uma transação no PostgreSQL. Execute fora de BEGIN/COMMIT.

ALTER TYPE salestatusenum ADD VALUE IF NOT EXISTS 'PENDING';
