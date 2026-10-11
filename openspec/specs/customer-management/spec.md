# customer-management Specification

## Purpose
Manter um cadastro de clientes do estabelecimento (nome, telefone, observação) com endereços estruturados, permitindo busca rápida por nome ou telefone para reaproveitar os dados nos pedidos.

## Requirements

### Requirement: Cadastrar cliente
O sistema SHALL permitir que qualquer usuário autenticado (ADMIN ou OPERATOR) cadastre um cliente via `POST /customers` com `name` (obrigatório, 2–255 caracteres), `phone` (opcional), `notes` (opcional, até 500 caracteres) e, opcionalmente, uma lista inicial de endereços. O telefone SHALL ser armazenado apenas com dígitos (10 ou 11 dígitos). O cliente SHALL ser criado com `is_active = true`.

#### Scenario: Cadastro com nome e telefone
- **WHEN** um OPERATOR envia `POST /customers` com `name: "Maria Silva"` e `phone: "(11) 98765-4321"`
- **THEN** o sistema retorna 201 com o cliente criado, `phone: "11987654321"`, `is_active: true`, `created_at` preenchido e `addresses: []`

#### Scenario: Cadastro com endereço inicial
- **WHEN** o usuário envia `POST /customers` com `name` e um endereço em `addresses`
- **THEN** o sistema cria o cliente e o endereço, e o endereço é marcado como `is_default: true`

#### Scenario: Nome ausente ou curto
- **WHEN** o usuário envia `POST /customers` sem `name` ou com nome de 1 caractere
- **THEN** o sistema retorna 422

#### Scenario: Telefone inválido
- **WHEN** o usuário envia `phone` que, após remover não-dígitos, não tem 10 ou 11 dígitos
- **THEN** o sistema retorna 422 com mensagem "Telefone inválido"

#### Scenario: Usuário não autenticado
- **WHEN** uma requisição sem token válido chama `POST /customers`
- **THEN** o sistema retorna 401

---

### Requirement: Buscar e listar clientes
O sistema SHALL expor `GET /customers` para qualquer usuário autenticado, aceitando `q` (texto de busca), `active_only` (padrão `true`) e `limit` (padrão 50, máximo 200). Quando `q` for informado, o sistema SHALL retornar clientes cujo nome contenha `q` (sem diferenciar maiúsculas/minúsculas) OU cujo telefone contenha os dígitos de `q` (quando `q` tiver ao menos 2 dígitos). Os resultados SHALL ser ordenados por nome e incluir os endereços de cada cliente.

#### Scenario: Busca por parte do nome
- **WHEN** o usuário chama `GET /customers?q=mar`
- **THEN** o sistema retorna os clientes ativos cujo nome contém "mar" (ex.: "Maria Silva", "Marcos"), ordenados por nome

#### Scenario: Busca por telefone formatado
- **WHEN** o usuário chama `GET /customers?q=(11) 98765`
- **THEN** o sistema retorna os clientes cujo telefone contém "1198765"

#### Scenario: Clientes inativos ocultos por padrão
- **WHEN** o usuário chama `GET /customers` sem `active_only`
- **THEN** clientes com `is_active: false` não são retornados

#### Scenario: Incluir inativos
- **WHEN** o usuário chama `GET /customers?active_only=false`
- **THEN** o sistema retorna clientes ativos e inativos

---

### Requirement: Consultar cliente
O sistema SHALL expor `GET /customers/{id}` para qualquer usuário autenticado, retornando o cliente com seus endereços (endereço padrão primeiro).

#### Scenario: Cliente existente
- **WHEN** o usuário chama `GET /customers/{id}` de um cliente existente
- **THEN** o sistema retorna 200 com os dados do cliente e a lista `addresses`

#### Scenario: Cliente inexistente
- **WHEN** o usuário chama `GET /customers/9999`
- **THEN** o sistema retorna 404 com detalhe "Cliente não encontrado"

---

### Requirement: Editar cliente
O sistema SHALL permitir que qualquer usuário autenticado edite `name`, `phone` e `notes` de um cliente via `PATCH /customers/{id}`, aplicando as mesmas validações do cadastro. Alterar `is_active` SHALL ser permitido somente a ADMIN.

#### Scenario: Operador edita telefone
- **WHEN** um OPERATOR envia `PATCH /customers/{id}` com novo `phone`
- **THEN** o sistema persiste o telefone normalizado e retorna 200 com o cliente atualizado

#### Scenario: Operador tenta reativar/desativar via PATCH
- **WHEN** um OPERATOR envia `PATCH /customers/{id}` contendo `is_active`
- **THEN** o sistema retorna 403 e não altera o cliente

#### Scenario: Admin reativa cliente
- **WHEN** um ADMIN envia `PATCH /customers/{id}` com `is_active: true` para um cliente inativo
- **THEN** o sistema reativa o cliente e retorna 200

---

### Requirement: Desativar cliente (somente ADMIN)
O sistema SHALL permitir que apenas ADMIN desative um cliente via `DELETE /customers/{id}`, que realiza exclusão lógica (`is_active = false`). Clientes nunca SHALL ser excluídos fisicamente, preservando o vínculo com vendas.

#### Scenario: Admin desativa cliente
- **WHEN** um ADMIN chama `DELETE /customers/{id}`
- **THEN** o sistema define `is_active: false`, retorna 200 com o cliente e o registro permanece no banco

#### Scenario: Operador tenta desativar
- **WHEN** um OPERATOR chama `DELETE /customers/{id}`
- **THEN** o sistema retorna 403

#### Scenario: Vendas anteriores preservadas
- **WHEN** um cliente vinculado a vendas é desativado
- **THEN** as vendas continuam com `customer_id` e com os dados textuais (nome, telefone, endereço) inalterados

---

### Requirement: Gerenciar endereços do cliente
O sistema SHALL permitir que qualquer usuário autenticado crie (`POST /customers/{id}/addresses`), edite (`PATCH /customers/{id}/addresses/{address_id}`) e remova (`DELETE /customers/{id}/addresses/{address_id}`) endereços de um cliente. Cada endereço SHALL ter `street` (obrigatório), `number`, `complement`, `neighborhood` (obrigatório), `reference` e `is_default`. Cada cliente SHALL ter no máximo um endereço padrão; o primeiro endereço cadastrado SHALL se tornar padrão automaticamente.

#### Scenario: Adicionar endereço
- **WHEN** o usuário envia `POST /customers/{id}/addresses` com `street: "Rua das Flores"`, `number: "120"`, `neighborhood: "Centro"`
- **THEN** o sistema retorna 201 com o endereço criado vinculado ao cliente

#### Scenario: Bairro obrigatório
- **WHEN** o usuário envia um endereço sem `neighborhood`
- **THEN** o sistema retorna 422

#### Scenario: Definir novo endereço padrão
- **WHEN** o usuário cria ou edita um endereço com `is_default: true`
- **THEN** esse endereço passa a ser o padrão e os demais endereços do cliente ficam com `is_default: false`

#### Scenario: Remover endereço padrão
- **WHEN** o usuário remove o endereço padrão e o cliente possui outros endereços
- **THEN** o endereço é removido e outro endereço do cliente passa a ser o padrão

#### Scenario: Endereço de outro cliente
- **WHEN** o usuário chama `PATCH /customers/{id}/addresses/{address_id}` com um `address_id` que não pertence ao cliente `{id}`
- **THEN** o sistema retorna 404 com detalhe "Endereço não encontrado"

---

### Requirement: Página de clientes
O frontend SHALL oferecer a página "Clientes" (`/customers`), acessível a ADMIN e OPERATOR pelo item "Clientes" do menu lateral, com tabela (nome, telefone, bairro do endereço padrão, status), campo de busca por nome/telefone e modal de cadastro/edição contendo os dados do cliente e a lista de endereços. As ações de desativar/reativar SHALL ser exibidas somente para ADMIN.

#### Scenario: Operador acessa a página
- **WHEN** um OPERATOR clica em "Clientes" no menu lateral
- **THEN** a página lista os clientes ativos e permite cadastrar e editar clientes e endereços

#### Scenario: Ação de desativar oculta para operador
- **WHEN** um OPERATOR visualiza a tabela de clientes
- **THEN** o botão de desativar/reativar não é exibido

#### Scenario: Busca na página
- **WHEN** o usuário digita "9876" no campo de busca
- **THEN** a tabela exibe apenas os clientes cujo nome ou telefone corresponde ao termo
