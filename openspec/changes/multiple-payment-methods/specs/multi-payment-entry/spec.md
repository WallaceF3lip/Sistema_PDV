## ADDED Requirements

### Requirement: Operador pode adicionar múltiplas entradas de pagamento
O sistema SHALL permitir que o operador adicione mais de uma entrada de pagamento no modal de finalização de venda, cada entrada contendo um método (`PIX`, `CARD` ou `CASH`) e um valor em reais.

#### Scenario: Modal abre com entrada inicial pré-preenchida
- **WHEN** o operador clica em "Cobrar" com itens no carrinho
- **THEN** o modal de pagamento exibe uma única entrada com o valor total da venda e o método padrão (PIX)

#### Scenario: Operador adiciona segunda forma de pagamento
- **WHEN** o operador clica em "Adicionar forma de pagamento"
- **THEN** uma nova linha de entrada é adicionada com o valor restante (total − soma das entradas anteriores) pré-preenchido e o campo de valor focado

#### Scenario: Limite de entradas atingido
- **WHEN** já existem 3 entradas de pagamento no modal
- **THEN** o botão "Adicionar forma de pagamento" não está visível

#### Scenario: Operador remove uma entrada
- **WHEN** o operador clica no botão de remover de uma entrada existente
- **THEN** a entrada é removida da lista e o valor restante é recalculado

---

### Requirement: Validação de cobertura total antes de finalizar
O sistema SHALL bloquear a finalização da venda enquanto a soma dos valores das entradas não cobrir o total da venda.

#### Scenario: Soma insuficiente bloqueia finalização
- **WHEN** a soma dos valores inseridos for menor que o total da venda
- **THEN** o botão "Finalizar Venda" está desabilitado

#### Scenario: Soma exatamente igual ao total habilita finalização
- **WHEN** a soma dos valores inseridos for igual ao total da venda (tolerância de R$ 0,01)
- **THEN** o botão "Finalizar Venda" está habilitado

#### Scenario: Soma superior ao total com CASH habilita finalização
- **WHEN** pelo menos uma entrada é CASH e a soma total supera o valor da venda
- **THEN** o botão "Finalizar Venda" está habilitado (excesso é tratado como troco)

---

### Requirement: Indicador de valor restante em tempo real
O sistema SHALL exibir o valor ainda não coberto (total − soma das entradas) em tempo real enquanto o operador edita os valores.

#### Scenario: Valor restante exibido durante preenchimento
- **WHEN** a soma das entradas for menor que o total
- **THEN** o modal exibe "Restante: R$ X,XX" em destaque

#### Scenario: Valor restante zerado quando coberto
- **WHEN** a soma das entradas for maior ou igual ao total
- **THEN** o indicador de restante não exibe valor pendente (ou exibe R$ 0,00)

---

### Requirement: Troco calculado para entrada em dinheiro
O sistema SHALL calcular e exibir o troco quando uma entrada do tipo CASH resultar em valor excedente sobre o total da venda.

#### Scenario: Troco exibido ao informar dinheiro a mais
- **WHEN** o operador informa um valor em CASH que, somado às demais entradas, supera o total
- **THEN** o modal exibe "Troco: R$ X,XX" correspondente ao excedente

#### Scenario: Sem troco para métodos não-dinheiro
- **WHEN** nenhuma entrada é do tipo CASH
- **THEN** o campo de troco não é exibido

---

### Requirement: Envio correto dos pagamentos ao backend
O sistema SHALL enviar somente as entradas com valor maior que zero ao finalizar a venda, mapeando cada entrada para `PaymentIn { method, amount }`.

#### Scenario: Finalização envia array completo de pagamentos
- **WHEN** o operador finaliza uma venda com duas entradas válidas (ex: PIX R$ 30 + CASH R$ 20)
- **THEN** o serviço `finalizeSale` é chamado com `payments: [{ method: 'PIX', amount: 30 }, { method: 'CASH', amount: 20 }]`

#### Scenario: Entradas com valor zero são filtradas
- **WHEN** existir alguma entrada com `amount === 0` no momento de finalizar
- **THEN** essa entrada não é incluída no payload enviado ao backend
