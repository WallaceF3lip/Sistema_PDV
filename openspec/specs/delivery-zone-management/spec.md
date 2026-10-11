# delivery-zone-management Specification

## Purpose
Permitir que o administrador cadastre zonas de entrega (bairros ou regiões) com uma taxa fixa e que os endereços dos clientes sejam associados a uma zona, servindo de base para sugerir a taxa de entrega no checkout.

## Requirements

### Requirement: Cadastrar zona de entrega (somente ADMIN)
O sistema SHALL permitir que apenas ADMIN cadastre uma zona de entrega via `POST /delivery-zones` com `name` (obrigatório, 2–100 caracteres, sem espaços nas extremidades) e `fee` (obrigatório, decimal com 2 casas, maior ou igual a 0). A zona SHALL ser criada com `is_active = true`. O nome SHALL ser único sem diferenciar maiúsculas/minúsculas.

#### Scenario: Admin cadastra zona
- **WHEN** um ADMIN envia `POST /delivery-zones` com `name: "Centro"` e `fee: 5.00`
- **THEN** o sistema retorna 201 com `id`, `name: "Centro"`, `fee: 5.00` e `is_active: true`

#### Scenario: Zona com entrega grátis
- **WHEN** um ADMIN cadastra uma zona com `fee: 0`
- **THEN** a zona é criada normalmente com taxa zero

#### Scenario: Taxa negativa
- **WHEN** um ADMIN envia `fee: -1`
- **THEN** o sistema retorna 422

#### Scenario: Nome duplicado
- **WHEN** já existe a zona "Centro" e um ADMIN envia `name: "centro"`
- **THEN** o sistema retorna 409 com detalhe "Já existe uma zona com este nome"

#### Scenario: Operador tenta cadastrar
- **WHEN** um OPERATOR envia `POST /delivery-zones`
- **THEN** o sistema retorna 403

---

### Requirement: Listar zonas de entrega
O sistema SHALL expor `GET /delivery-zones` a qualquer usuário autenticado, retornando as zonas ordenadas por nome. Por padrão (`active_only=true`) SHALL retornar apenas zonas ativas; com `active_only=false` SHALL retornar também as inativas.

#### Scenario: Operador lista zonas ativas
- **WHEN** um OPERATOR chama `GET /delivery-zones`
- **THEN** o sistema retorna apenas as zonas com `is_active: true`, ordenadas por nome

#### Scenario: Admin lista todas as zonas
- **WHEN** um ADMIN chama `GET /delivery-zones?active_only=false`
- **THEN** o sistema retorna zonas ativas e inativas

---

### Requirement: Editar zona de entrega (somente ADMIN)
O sistema SHALL permitir que apenas ADMIN edite `name`, `fee` e `is_active` de uma zona via `PATCH /delivery-zones/{id}`, com as mesmas validações do cadastro. Alterar a taxa de uma zona SHALL NOT alterar a taxa de vendas já registradas.

#### Scenario: Admin altera a taxa
- **WHEN** um ADMIN altera a taxa da zona "Centro" de 5.00 para 6.00
- **THEN** a zona passa a sugerir 6.00 em novos pedidos e as vendas anteriores mantêm `delivery_fee` 5.00

#### Scenario: Zona inexistente
- **WHEN** um ADMIN chama `PATCH /delivery-zones/9999`
- **THEN** o sistema retorna 404 com detalhe "Zona de entrega não encontrada"

---

### Requirement: Desativar e reativar zona (somente ADMIN)
O sistema SHALL permitir que apenas ADMIN desative uma zona via `DELETE /delivery-zones/{id}`, realizando exclusão lógica (`is_active = false`); zonas nunca SHALL ser excluídas fisicamente. A reativação SHALL ocorrer via `PATCH` com `is_active: true`. Zonas inativas SHALL NOT ser oferecidas no checkout nem aceitas em novos vínculos, mas endereços e vendas que já as referenciam SHALL permanecer inalterados.

#### Scenario: Admin desativa zona
- **WHEN** um ADMIN chama `DELETE /delivery-zones/{id}`
- **THEN** o sistema retorna 200 com a zona com `is_active: false` e o registro permanece no banco

#### Scenario: Vendas e endereços preservados
- **WHEN** uma zona referenciada por endereços e vendas é desativada
- **THEN** os endereços mantêm `delivery_zone_id` e as vendas mantêm `delivery_zone_id` e `delivery_fee` inalterados

#### Scenario: Operador tenta desativar
- **WHEN** um OPERATOR chama `DELETE /delivery-zones/{id}`
- **THEN** o sistema retorna 403

---

### Requirement: Associar endereço do cliente a uma zona
Os endereços de clientes SHALL possuir um vínculo opcional `delivery_zone_id` com uma zona de entrega. Os endpoints `POST /customers/{id}/addresses` e `PATCH /customers/{id}/addresses/{address_id}` (e os endereços iniciais de `POST /customers`) SHALL aceitar `delivery_zone_id`; quando informado com valor, a zona SHALL existir (senão 404 "Zona de entrega não encontrada") e estar ativa (senão 400 "Zona de entrega inativa"). Enviar `delivery_zone_id: null` explicitamente SHALL remover o vínculo. Os endereços retornados SHALL incluir `delivery_zone_id` e os dados resumidos da zona (`name`, `fee`, `is_active`). Endereços sem zona SHALL continuar válidos.

#### Scenario: Cadastrar endereço com zona
- **WHEN** o usuário envia `POST /customers/{id}/addresses` com `neighborhood: "Centro"` e `delivery_zone_id` da zona "Centro"
- **THEN** o endereço é criado e retornado com `delivery_zone_id` e a zona `{ name: "Centro", fee: 5.00, is_active: true }`

#### Scenario: Endereço sem zona
- **WHEN** o usuário cadastra um endereço sem `delivery_zone_id`
- **THEN** o endereço é criado com `delivery_zone_id: null`

#### Scenario: Zona inativa no endereço
- **WHEN** o usuário envia `delivery_zone_id` de uma zona inativa
- **THEN** o sistema retorna 400 com detalhe "Zona de entrega inativa" e não altera o endereço

#### Scenario: Remover zona do endereço
- **WHEN** o usuário envia `PATCH` do endereço com `delivery_zone_id: null`
- **THEN** o vínculo é removido e os demais campos do endereço permanecem

#### Scenario: Sugestão de zona pelo bairro
- **WHEN** o usuário digita o bairro "centro" no formulário de endereço e existe a zona ativa "Centro"
- **THEN** o frontend pré-seleciona a zona "Centro", que pode ser trocada antes de salvar

---

### Requirement: Página de zonas de entrega
O frontend SHALL oferecer a página "Zonas de Entrega" (`/delivery-zones`), acessível somente a ADMIN pelo item "Zonas de Entrega" do menu lateral, com tabela (nome, taxa em R$, status), opção de mostrar inativas e modal de cadastro/edição (nome e taxa). A página SHALL permitir desativar (com confirmação) e reativar zonas. O item de menu SHALL ficar oculto para OPERATOR e a rota SHALL redirecionar usuários não-ADMIN.

#### Scenario: Admin gerencia zonas
- **WHEN** um ADMIN acessa "Zonas de Entrega", cadastra "Jardim América" com taxa 8,00
- **THEN** a zona aparece na tabela com taxa "R$ 8,00" e status ativo

#### Scenario: Operador sem acesso
- **WHEN** um OPERATOR está logado
- **THEN** o item "Zonas de Entrega" não aparece no menu e acessar `/delivery-zones` diretamente o redireciona

#### Scenario: Zona na página de clientes
- **WHEN** o usuário edita um endereço na página "Clientes"
- **THEN** o formulário de endereço exibe um seletor com as zonas ativas e a opção "Sem zona"
