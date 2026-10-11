## REMOVED Requirements

### Requirement: Botão de edição por linha (placeholder)
**Reason**: O botão "Editar" nunca teve função, e editar pedidos finalizados está fora do escopo. A coluna de ações passa a oferecer a reimpressão da comanda.
**Migration**: Nenhuma; o botão não executava ação. Use "Reimprimir" (comanda) na mesma coluna.

## ADDED Requirements

### Requirement: Reimprimir comanda pelo histórico
A coluna de ações de cada linha SHALL exibir o botão "Reimprimir" para vendas com status `PENDING` ou `PAID`, quando a impressão de comanda estiver disponível. O clique SHALL imprimir a comanda da venda (uma via, marcada "REIMPRESSÃO") com os dados carregados no histórico. Vendas `OPEN` ou `CANCELED` SHALL NOT exibir o botão.

#### Scenario: Reimprimir venda paga
- **WHEN** o usuário clica em "Reimprimir" na linha de uma venda `PAID`
- **THEN** abre o diálogo de impressão com a comanda dessa venda

#### Scenario: Venda cancelada sem ação
- **WHEN** a tabela exibe uma venda `CANCELED`
- **THEN** a linha não exibe o botão "Reimprimir"
