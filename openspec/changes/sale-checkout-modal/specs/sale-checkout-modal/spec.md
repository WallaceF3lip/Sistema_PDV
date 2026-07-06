## ADDED Requirements

### Requirement: Botão "Continuar" no carrinho substitui "Cobrar"
O carrinho SHALL exibir um botão "Continuar" no lugar do botão "Cobrar". O botão SHALL estar desabilitado quando não houver venda aberta ou o carrinho estiver vazio.

#### Scenario: Carrinho com itens
- **WHEN** existe uma venda aberta com pelo menos um item
- **THEN** o botão "Continuar" está habilitado

#### Scenario: Carrinho vazio
- **WHEN** não existe venda aberta ou o carrinho não tem itens
- **THEN** o botão "Continuar" está desabilitado

---

### Requirement: Painel de detalhes do pedido removido do carrinho
O carrinho SHALL exibir apenas a lista de itens, o total e o botão "Continuar". Os campos de tipo de pedido, dados do cliente, endereço e pagamento NÃO SHALL ser exibidos no carrinho.

#### Scenario: Tela de vendas sem formulário inline
- **WHEN** o operador acessa a página de vendas
- **THEN** o carrinho não exibe campos de formulário (tipo de pedido, nome do cliente, observação, etc.)

---

### Requirement: Modal de checkout abre ao clicar em "Continuar"
O sistema SHALL abrir o `CheckoutModalComponent` quando o operador clicar em "Continuar", passando a venda atual como contexto.

#### Scenario: Abertura do modal
- **WHEN** o operador clica em "Continuar" com carrinho não vazio
- **THEN** o modal de checkout é exibido na Etapa 1 (seleção de tipo de pedido)

#### Scenario: Modal pré-preenchido com dados existentes
- **WHEN** a venda já possui dados de pedido salvos (order_type, customer_name, etc.)
- **THEN** o modal abre com os campos pré-preenchidos com esses dados

---

### Requirement: Etapa 1 — Seleção do tipo de pedido
O `CheckoutModalComponent` SHALL exibir na primeira etapa um seletor visual com três opções: Balcão, Retirada e Entrega.

#### Scenario: Seleção de Balcão
- **WHEN** o operador seleciona "Balcão" e confirma
- **THEN** o modal avança diretamente para a Etapa 3 (pagamento), pulando a Etapa 2

#### Scenario: Seleção de Retirada ou Entrega
- **WHEN** o operador seleciona "Retirada" ou "Entrega" e confirma
- **THEN** o modal avança para a Etapa 2 (detalhes do pedido)

#### Scenario: Nenhum tipo selecionado
- **WHEN** o operador não seleciona nenhum tipo
- **THEN** o botão de avançar da Etapa 1 está desabilitado

---

### Requirement: Etapa 2 — Detalhes do pedido com campos condicionais
O `CheckoutModalComponent` SHALL exibir na Etapa 2 campos de acordo com o tipo selecionado. Para Retirada: nome do cliente (opcional), observação (opcional), horário (obrigatório), telefone (obrigatório), forma de pagamento prevista e flag "já pago". Para Entrega: todos os campos de Retirada mais endereço (obrigatório).

#### Scenario: Campos obrigatórios de Entrega ausentes
- **WHEN** o tipo é Entrega e o operador tenta avançar sem preencher horário, endereço ou telefone
- **THEN** o sistema exibe erros de validação e não avança para a próxima etapa

#### Scenario: Campos obrigatórios de Retirada ausentes
- **WHEN** o tipo é Retirada e o operador tenta avançar sem preencher horário ou telefone
- **THEN** o sistema exibe erros de validação e não avança

#### Scenario: Campos opcionais em branco
- **WHEN** o operador deixa nome do cliente e observação em branco
- **THEN** o sistema aceita e avança normalmente

#### Scenario: Pedido marcado como já pago
- **WHEN** o operador ativa a flag "Já pago"
- **THEN** ao avançar, o modal vai para a Etapa 3 (pagamento normal com modal de formas de pagamento)

#### Scenario: Pedido não pago (reserva)
- **WHEN** o operador deixa "Já pago" desativado
- **THEN** ao confirmar, o sistema finaliza a venda como reserva sem abrir etapa de pagamento e fecha o modal

---

### Requirement: Etapa 3 — Pagamento
O `CheckoutModalComponent` SHALL exibir na Etapa 3 o formulário de seleção de formas de pagamento com suporte a pagamento misto (até 3 entradas), exibição de troco para Dinheiro e botão "Finalizar Venda".

#### Scenario: Pagamento cobre o total
- **WHEN** a soma das entradas de pagamento cobre o total da venda (tolerância R$ 0,01)
- **THEN** o botão "Finalizar Venda" está habilitado

#### Scenario: Pagamento insuficiente
- **WHEN** a soma das entradas não cobre o total
- **THEN** o botão "Finalizar Venda" está desabilitado e o valor restante é exibido

#### Scenario: Troco em dinheiro
- **WHEN** há uma entrada de Dinheiro e a soma supera o total
- **THEN** o troco é calculado e exibido em destaque

#### Scenario: Finalização bem-sucedida
- **WHEN** o operador clica em "Finalizar Venda" com pagamento válido
- **THEN** a venda é finalizada, o modal fecha e o carrinho é limpo

---

### Requirement: Navegação entre etapas no modal
O `CheckoutModalComponent` SHALL permitir que o operador volte à etapa anterior usando um botão "Voltar", exceto na Etapa 1.

#### Scenario: Voltar da Etapa 2 para Etapa 1
- **WHEN** o operador clica em "Voltar" na Etapa 2
- **THEN** o modal retorna para a Etapa 1 mantendo o tipo selecionado

#### Scenario: Voltar da Etapa 3 para Etapa anterior
- **WHEN** o operador clica em "Voltar" na Etapa 3
- **THEN** o modal retorna para a etapa anterior (Etapa 2 se Retirada/Entrega, ou Etapa 1 se Balcão)

#### Scenario: Fechar modal sem finalizar
- **WHEN** o operador fecha o modal (botão ✕ ou clica fora)
- **THEN** o modal fecha sem alterar o carrinho e sem salvar dados parciais

---

### Requirement: Comunicação entre SalesComponent e CheckoutModalComponent
O `CheckoutModalComponent` SHALL receber a venda via `@Input() sale` e emitir eventos `@Output() completed` (venda finalizada) e `@Output() cancelled` (modal fechado sem finalizar).

#### Scenario: Evento completed emitido
- **WHEN** a venda é finalizada com sucesso (pagamento ou reserva)
- **THEN** o componente emite `completed` e o `SalesComponent` limpa o carrinho e fecha o modal

#### Scenario: Evento cancelled emitido
- **WHEN** o operador fecha o modal sem finalizar
- **THEN** o componente emite `cancelled` e o `SalesComponent` fecha o modal mantendo o carrinho intacto
