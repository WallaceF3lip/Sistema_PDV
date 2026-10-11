## Purpose

Permitir vincular opcionalmente uma venda a um cliente cadastrado durante o checkout, reaproveitando nome, telefone e endereços do cadastro, sem perder o snapshot textual dos dados no pedido.

## ADDED Requirements

### Requirement: Vincular venda a cliente
O sistema SHALL armazenar em cada venda um `customer_id` opcional que referencia um cliente cadastrado. O endpoint `PATCH /sales/{id}/order-details` SHALL aceitar `customer_id`; quando informado com um valor, o cliente SHALL existir e estar ativo. Quando enviado explicitamente como `null`, o vínculo SHALL ser removido; quando omitido, o vínculo atual SHALL ser mantido. `SaleOut` SHALL expor `customer_id`. Vendas sem cliente vinculado SHALL continuar válidas.

#### Scenario: Vincular cliente ativo
- **WHEN** o operador envia `PATCH /sales/{id}/order-details` com `customer_id` de um cliente ativo e `customer_name`
- **THEN** o sistema persiste `customer_id` e retorna `SaleOut` com `customer_id` preenchido

#### Scenario: Cliente inexistente
- **WHEN** o operador envia `customer_id: 9999`
- **THEN** o sistema retorna 404 com detalhe "Cliente não encontrado" e não altera a venda

#### Scenario: Cliente inativo
- **WHEN** o operador envia `customer_id` de um cliente com `is_active: false`
- **THEN** o sistema retorna 400 com detalhe "Cliente inativo"

#### Scenario: Desvincular cliente
- **WHEN** o operador envia `customer_id: null` explicitamente para uma venda vinculada
- **THEN** o sistema remove o vínculo (`customer_id: null`) e mantém os demais dados textuais enviados

#### Scenario: Venda sem cliente
- **WHEN** o operador finaliza uma venda sem nunca informar `customer_id`
- **THEN** a venda é finalizada normalmente com `customer_id: null`

---

### Requirement: Snapshot textual dos dados do cliente
A venda SHALL manter `customer_name`, `customer_phone` e `delivery_address` como texto gravado no momento do pedido, independente do vínculo com o cliente. Alterações posteriores no cadastro do cliente ou de seus endereços SHALL NOT alterar vendas existentes.

#### Scenario: Cliente editado após a venda
- **WHEN** o telefone ou endereço de um cliente é alterado depois de uma venda vinculada ter sido finalizada
- **THEN** a venda continua exibindo o telefone e o endereço gravados no momento do pedido

#### Scenario: Endereço removido após a venda
- **WHEN** um endereço usado em uma venda é removido do cadastro do cliente
- **THEN** o `delivery_address` da venda permanece inalterado

---

### Requirement: Busca e seleção de cliente no checkout
Na etapa 1 do modal de checkout, o campo de nome do cliente SHALL oferecer busca de clientes ativos por nome ou telefone (a partir de 2 caracteres digitados), exibindo nome e telefone de cada resultado. Ao selecionar um cliente, o frontend SHALL preencher o nome e o telefone do pedido e registrar o vínculo. Editar o nome após a seleção SHALL desfazer o vínculo. O nome continua obrigatório e o operador SHALL poder prosseguir com nome digitado livremente, sem cliente vinculado.

#### Scenario: Selecionar cliente existente
- **WHEN** o operador digita "mar" no campo de cliente e seleciona "Maria Silva — (11) 98765-4321"
- **THEN** o nome e o telefone do pedido são preenchidos com os dados de Maria e o modal indica que há um cliente vinculado

#### Scenario: Nome livre sem cadastro
- **WHEN** o operador digita um nome e avança sem selecionar nenhum resultado
- **THEN** o checkout prossegue e a venda é salva com `customer_name` e sem `customer_id`

#### Scenario: Alterar nome após seleção
- **WHEN** o operador seleciona um cliente e depois edita o texto do nome
- **THEN** o vínculo é removido e a venda é salva com `customer_id: null`

#### Scenario: Balcão com cliente vinculado
- **WHEN** o pedido é do tipo Balcão e o operador selecionou um cliente
- **THEN** o frontend envia `customer_id` junto com `customer_name` ao salvar os dados do pedido

---

### Requirement: Cadastro rápido de cliente no checkout
O modal de checkout SHALL oferecer, quando a busca não encontrar o cliente desejado, a opção de cadastrar rapidamente um novo cliente com nome e telefone, sem sair do modal. Após o cadastro, o cliente SHALL ficar selecionado e vinculado ao pedido.

#### Scenario: Cadastrar cliente novo no checkout
- **WHEN** o operador digita "João Souza", escolhe "Cadastrar novo cliente", informa o telefone e confirma
- **THEN** o cliente é criado, fica selecionado no checkout e o nome e telefone do pedido são preenchidos

#### Scenario: Falha no cadastro rápido
- **WHEN** o cadastro rápido falha (ex.: telefone inválido)
- **THEN** o modal exibe a mensagem de erro e mantém os dados digitados, sem perder o andamento do checkout

---

### Requirement: Seleção de endereço do cliente na entrega
Na etapa 2 do checkout, para pedidos do tipo Entrega com cliente vinculado, o frontend SHALL listar os endereços cadastrados do cliente, pré-selecionando o endereço padrão, e preencher `delivery_address` com o endereço formatado (rua, número, complemento, bairro e referência). O operador SHALL poder cadastrar um novo endereço para o cliente (que passa a ser o selecionado) ou digitar um endereço avulso que não é salvo no cadastro. Sem cliente vinculado, o campo de endereço SHALL permanecer como texto livre. O telefone SHALL vir pré-preenchido com o telefone do cliente quando estiver vazio.

#### Scenario: Endereço padrão pré-selecionado
- **WHEN** o operador escolhe Entrega para um cliente vinculado que possui endereço padrão "Rua das Flores, 120 - Centro"
- **THEN** esse endereço aparece selecionado e `delivery_address` é preenchido com o texto formatado

#### Scenario: Escolher outro endereço cadastrado
- **WHEN** o operador seleciona outro endereço da lista do cliente
- **THEN** `delivery_address` é atualizado com o texto formatado desse endereço

#### Scenario: Cadastrar novo endereço no checkout
- **WHEN** o operador escolhe "Novo endereço", preenche rua, número e bairro e confirma
- **THEN** o endereço é salvo no cadastro do cliente e fica selecionado para o pedido

#### Scenario: Endereço avulso
- **WHEN** o operador escolhe "Outro endereço (não salvar)" e digita o endereço
- **THEN** o texto digitado é usado em `delivery_address` e nenhum endereço é criado no cadastro

#### Scenario: Cliente sem endereços
- **WHEN** o cliente vinculado não possui endereços cadastrados
- **THEN** o modal exibe o formulário de novo endereço e a opção de endereço avulso
