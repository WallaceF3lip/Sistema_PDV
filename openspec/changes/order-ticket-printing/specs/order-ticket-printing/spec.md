## Purpose

Imprimir pelo navegador, em impressora térmica de 80 mm, a comanda de um pedido finalizado (itens, cliente, dados de entrega, valores e pagamento). A comanda sai automaticamente ao finalizar e pode ser reimpressa pelo quadro de pedidos e pelo histórico.

## ADDED Requirements

### Requirement: Layout da comanda para bobina de 80 mm
A comanda SHALL ser impressa com página de 80 mm de largura, altura automática e margem zero. O conteúdo SHALL ocupar no máximo 72 mm de largura, em fonte monoespaçada, texto preto sobre fundo branco, sem cores, sombras ou imagens. Textos longos (nome de produto, endereço, observações) SHALL quebrar linha dentro da largura útil, sem serem cortados. Ao imprimir a comanda, SHALL ser impressa somente a comanda, sem nenhum elemento da interface (sidebar, cabeçalhos, modais, toasts).

#### Scenario: Somente a comanda no papel
- **WHEN** a comanda é impressa com o modal de checkout aberto na tela
- **THEN** a pré-visualização de impressão mostra apenas a comanda, sem sidebar, modal ou toast

#### Scenario: Nome de produto longo
- **WHEN** um item tem nome maior do que a largura útil
- **THEN** o nome quebra em mais de uma linha e quantidade e valores continuam visíveis e alinhados à direita

#### Scenario: Tamanho de página
- **WHEN** o operador abre a pré-visualização de impressão do Chrome com a impressora térmica selecionada
- **THEN** a página tem 80 mm de largura, a altura acompanha o conteúdo e não há margem adicionada pela página

### Requirement: Conteúdo da comanda
A comanda SHALL conter, nesta ordem e omitindo as linhas cujo dado não existe:
1. Cabeçalho: nome do estabelecimento (configuração do frontend) e, se configurado, telefone da loja.
2. Identificação: "Pedido #<daily_number>" em destaque (ou "Venda #<id>" quando não houver número do dia), data e hora do pedido (`closed_at`, ou `opened_at` se nulo, no fuso local, formato `dd/MM/yyyy HH:mm`) e o tipo: "BALCÃO", "RETIRADA" ou "ENTREGA".
3. Cliente: nome, telefone, endereço de entrega com a zona (`delivery_zone_name`) e o horário de entrega/retirada (`delivery_time`). O horário SHALL ser rotulado "Entrega:" para Entrega e "Retirada:" para Retirada.
4. Itens: para cada item, quantidade, nome do produto (`product_name`, ou "Produto #<product_id>" se ausente), preço unitário e subtotal. Quantidades inteiras SHALL aparecer sem casas decimais e as fracionadas com até 3 casas.
5. Totais: "Subtotal itens" (`items_total`), "Taxa de entrega" (só quando `delivery_fee` > 0) e "TOTAL" (`total_amount`) em destaque. Valores SHALL estar em reais no formato `R$ 1.234,56`.
6. Pagamento: se a venda está `PAID`, cada pagamento com o método em português (Dinheiro, Cartão, PIX) e o valor, e, quando informado na impressão, o valor recebido em dinheiro e o troco. Se está `PENDING`, a linha em destaque "A RECEBER: <método previsto>" com o total (ou "A RECEBER" sem método quando não houver método previsto).
7. Observações (`notes`), em destaque, com quebra de linha preservada.
8. Rodapé: mensagem configurável (padrão "Obrigado pela preferência!") , data/hora da impressão e o aviso "Não é documento fiscal".

#### Scenario: Comanda de entrega pendente
- **WHEN** o Pedido #12 de Entrega, cliente "Ana", telefone "(11) 99999-0000", endereço "Rua A, 10", zona "Centro", horário "19:30", 2 × "Pizza Calabresa" a R$ 40,00, taxa R$ 5,00, pagamento previsto PIX e `is_paid` falso é impresso
- **THEN** a comanda mostra "Pedido #12", "ENTREGA", "Ana", "(11) 99999-0000", "Rua A, 10", "Centro", "Entrega: 19:30", a linha "2 x Pizza Calabresa" com R$ 40,00 e R$ 80,00, "Subtotal itens R$ 80,00", "Taxa de entrega R$ 5,00", "TOTAL R$ 85,00" e "A RECEBER: PIX"

#### Scenario: Comanda de balcão paga com troco
- **WHEN** uma venda de Balcão de R$ 37,50 é finalizada com pagamento em Dinheiro, o operador informa R$ 50,00 recebidos e a comanda é impressa logo em seguida
- **THEN** a comanda mostra "BALCÃO", "Dinheiro R$ 37,50", "Recebido R$ 50,00" e "Troco R$ 12,50", e não mostra endereço, horário nem taxa de entrega

#### Scenario: Venda sem número do dia
- **WHEN** é reimpressa uma venda antiga sem `daily_number` e com id 340
- **THEN** a comanda é identificada como "Venda #340"

#### Scenario: Pagamento dividido
- **WHEN** a venda paga tem pagamentos PIX R$ 20,00 e Cartão R$ 30,00
- **THEN** a comanda lista "PIX R$ 20,00" e "Cartão R$ 30,00"

#### Scenario: Observações
- **WHEN** a venda tem a observação "Sem cebola\nBem passado"
- **THEN** a comanda mostra o bloco de observações com as duas linhas

### Requirement: Impressão pelo diálogo do navegador
O sistema SHALL imprimir a comanda pelo diálogo de impressão do navegador (`window.print`), sem abrir nova janela ou aba e sem serviço local de impressão. A impressão SHALL começar só depois que a comanda estiver renderizada por completo. Depois que o diálogo for fechado (impresso ou cancelado), a comanda SHALL ser removida da área de impressão e a tela SHALL voltar ao estado anterior. Pedidos de impressão feitos enquanto outro está em andamento SHALL ser atendidos em sequência, um diálogo por vez, sem misturar comandas. Uma falha ao preparar a impressão SHALL ser mostrada ao operador como mensagem de erro e SHALL NOT desfazer nem bloquear a venda.

#### Scenario: Cancelar o diálogo
- **WHEN** o operador cancela o diálogo de impressão
- **THEN** nenhum erro é mostrado, a venda continua finalizada e a área de impressão é limpa

#### Scenario: Duas reimpressões seguidas
- **WHEN** o operador clica em "Reimprimir" no Pedido #3 e, antes de fechar o diálogo, pede a reimpressão do Pedido #4
- **THEN** o diálogo do Pedido #3 é concluído primeiro e só então abre o diálogo com a comanda do Pedido #4

#### Scenario: Disponibilidade da impressão
- **WHEN** o frontend roda em um navegador que oferece `window.print`
- **THEN** o serviço de impressão se declara disponível e as ações "Reimprimir" são exibidas

### Requirement: Impressão automática ao finalizar
O checkout SHALL oferecer a opção "Imprimir comanda", marcada por padrão, nas etapas que finalizam o pedido (pagamento e reserva de Retirada/Entrega). A escolha do operador SHALL ficar salva no navegador e SHALL ser usada como valor inicial nas próximas vendas. Quando a opção está marcada, a comanda SHALL ser impressa logo após a finalização bem-sucedida, a partir do pedido devolvido pela finalização (já com número do dia e nomes dos produtos). Pagamentos em dinheiro com troco SHALL levar o valor recebido e o troco para a comanda. Quando a finalização falha, nada SHALL ser impresso.

#### Scenario: Finalizar com impressão
- **WHEN** a opção "Imprimir comanda" está marcada e o operador finaliza uma venda com sucesso
- **THEN** o modal fecha, a mensagem de sucesso aparece e o diálogo de impressão abre com a comanda do pedido finalizado

#### Scenario: Reserva com impressão
- **WHEN** a opção está marcada e o operador confirma uma Retirada sem pagamento ("Já pago?" desmarcado)
- **THEN** o pedido é finalizado como pendente e a comanda é impressa com "A RECEBER: <método previsto>"

#### Scenario: Opção desmarcada é lembrada
- **WHEN** o operador desmarca "Imprimir comanda", finaliza uma venda e depois inicia outra venda
- **THEN** nenhuma comanda é impressa na primeira e a opção já aparece desmarcada no checkout da segunda

#### Scenario: Falha na finalização
- **WHEN** a finalização retorna erro (por exemplo, estoque insuficiente ou caixa fechado)
- **THEN** nenhuma comanda é impressa e o modal permanece aberto

### Requirement: Vias da comanda
O número de vias impressas ao finalizar SHALL vir da configuração do frontend (1 ou 2; padrão 1). Com 2 vias, as duas cópias SHALL sair em um único trabalho de impressão, separadas por quebra de página e identificadas por "VIA COZINHA" e "VIA CLIENTE". A reimpressão SHALL sair sempre em uma via, identificada como "REIMPRESSÃO".

#### Scenario: Duas vias ao finalizar
- **WHEN** a configuração de vias é 2 e uma venda é finalizada com impressão
- **THEN** abre um único diálogo de impressão com duas comandas iguais, a primeira marcada "VIA COZINHA" e a segunda "VIA CLIENTE"

#### Scenario: Reimpressão em uma via
- **WHEN** a configuração de vias é 2 e o operador reimprime um pedido
- **THEN** sai uma única comanda marcada "REIMPRESSÃO"

### Requirement: Reimpressão da comanda
O operador SHALL poder reimprimir a comanda de pedidos `PENDING` e `PAID` pelo quadro "Pedidos do Dia" e pelo histórico de vendas. A reimpressão SHALL usar os dados atuais do pedido, como o quadro/histórico os carregou, refletindo por exemplo um pedido quitado depois da primeira impressão. Pedidos `CANCELED` e `OPEN` SHALL NOT oferecer reimpressão.

#### Scenario: Reimprimir pedido quitado
- **WHEN** o Pedido #7, impresso como "A RECEBER: Dinheiro", foi quitado no quadro e o operador clica em "Reimprimir"
- **THEN** a comanda reimpressa mostra os pagamentos registrados em vez de "A RECEBER"

#### Scenario: Pedido cancelado
- **WHEN** o quadro exibe um pedido cancelado
- **THEN** o cartão não oferece "Reimprimir"

### Requirement: Identificação do estabelecimento configurável
O nome do estabelecimento, o telefone opcional e a mensagem de rodapé da comanda SHALL vir da configuração de ambiente do frontend, sem alterar o backend. Sem nome configurado, a comanda SHALL usar "PDV".

#### Scenario: Nome configurado
- **WHEN** a configuração de ambiente define o nome do estabelecimento como "Pizzaria do Zé"
- **THEN** toda comanda impressa começa com "Pizzaria do Zé"
