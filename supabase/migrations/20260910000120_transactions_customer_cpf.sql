-- Checkout PIX: persiste o CPF/CNPJ retornado no cadastro da transação.
-- A rota /api/checkout/pay já envia este campo ao criar a cobrança.
alter table public.transactions
  add column if not exists customer_cpf text;

comment on column public.transactions.customer_cpf is
  'CPF/CNPJ informado pelo comprador no checkout; armazenado somente no servidor.';

