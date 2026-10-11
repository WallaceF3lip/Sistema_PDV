export const environment = {
  production: true,
  apiUrl: 'https://sistema-pdvback.vercel.app', // API em produção
  // Identificação da loja na comanda impressa (order-ticket-printing)
  establishment: {
    name: 'Nome da Loja',
    phone: '',
    footer: 'Obrigado pela preferência!',
  },
  // Vias impressas ao finalizar (1 ou 2). Reimpressão sai sempre em 1 via.
  ticket: { copies: 1 as 1 | 2 },
};