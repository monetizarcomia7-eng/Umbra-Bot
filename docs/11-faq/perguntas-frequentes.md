---
title: "Perguntas frequentes"
description: "Respostas rápidas para as dúvidas mais comuns sobre o Umbra Bot."
order: 1
category: "FAQ"
---

# Perguntas frequentes

---

## Bots e Telegram

### Posso ter mais de um bot?

Sim. Você pode conectar quantos bots quiser ao Umbra Bot. Cada bot aparece separado na lista e você pode filtrar os dados por bot nas telas de Análises, Clientes e Atividade.

### Meu bot ficou offline. O que faço?

Abra **Gerenciar Bots**, clique no bot offline e clique em **"Reconectar"**. Resolve em 90% dos casos. Veja o guia completo em [Bot desconectado — o que fazer](../02-bots/desconectar-bot.md).

### O bot fica funcionando mesmo quando fecho o navegador?

Sim. O bot funciona nos servidores do Umbra Bot — você não precisa deixar o navegador aberto.

### Perdi o token do bot. Como recupero?

No Telegram, abra o **@BotFather**, mande `/mybots`, escolha o bot e clique em **"API Token"**. O token aparece novamente.

### Posso usar o mesmo bot em outro sistema ao mesmo tempo?

Não recomendamos. Um bot do Telegram só pode ter um sistema "ouvindo" as mensagens por vez. Se você conectar o mesmo bot em outro lugar, o Umbra Bot vai perder a conexão.

---

## Pagamentos e financeiro

### Quanto tempo demora para o dinheiro cair?

Pagamentos PIX aparecem como "Aprovados" em segundos. O valor fica disponível para saque após o prazo de liquidação do Mercado Pago (geralmente 1-2 dias úteis).

### Quando posso sacar?

Assim que tiver saldo disponível. O saque é processado às 06:00 (horário de Brasília) e o dinheiro cai na conta cadastrada em até 1 dia útil. Limite: 3 saques por dia.

### O Umbra Bot cobra taxa sobre as vendas?

<!-- TODO: confirmar estrutura de taxas e planos antes de documentar -->

As taxas do Mercado Pago são cobradas diretamente por eles — o Umbra Bot exibe o valor já descontado como "Valor líquido" em cada transação.

### Por que uma transação está como "Expirada"?

O comprador abriu a cobrança PIX mas não pagou dentro do prazo (geralmente 30 minutos). Isso é normal — muitas pessoas iniciam o processo mas não finalizam. A transação expirada não gera cobrança para você.

### Posso receber por outros meios além de PIX?

No momento, o Umbra Bot suporta pagamentos via PIX pelo Mercado Pago.

<!-- TODO: atualizar quando novos gateways e métodos de pagamento forem lançados -->

---

## Clientes e leads

### Qual a diferença entre lead e comprador?

**Lead** é quem entrou no bot mas ainda não comprou. **Comprador** é quem fez pelo menos uma compra confirmada. A classificação é automática e atualiza em tempo real.

### O cliente entrou no bot mas não aparece na lista. Por quê?

O contato é registrado quando alguém envia o comando `/start` para o seu bot. Se o bot estava offline no momento, ou se a pessoa só encontrou o bot mas não enviou nenhuma mensagem, o contato não é registrado.

### Por que a "origem" de alguns clientes está vazia?

A origem é preenchida quando o cliente chega pelo seu bot através de um link com rastreamento UTM. Se o cliente encontrou o bot diretamente no Telegram (pesquisando o @usuário, por exemplo), a origem fica vazia.

---

## Afiliados

### O afiliado recebe automaticamente quando há uma venda?

Não. O sistema registra a comissão automaticamente, mas o pagamento em dinheiro é feito manualmente por você. Depois de pagar, você marca como pago na aba de Pagamentos para manter o controle.

### Como o sistema sabe que a venda veio de um afiliado?

Quando o visitante clica no link do afiliado, o sistema salva essa informação por um período (a "janela do cookie"). Se a pessoa comprar dentro desse período, a venda é atribuída ao afiliado automaticamente.

### Um afiliado pode ver meus dados de vendas?

Não. O afiliado não tem acesso ao painel do Umbra Bot. Ele pode ver apenas as informações que você compartilhar diretamente com ele.

---

## Conta e segurança

### Posso usar o Umbra Bot em mais de um computador?

Sim. A conta é acessível de qualquer navegador. Basta fazer login com e-mail e senha (ou Google).

### Como altero minha senha?

Acesse **Perfil** no menu e clique em **"Alterar senha"**. Se esqueceu a senha, use a opção **"Esqueci minha senha"** na tela de login.

### Meus dados estão seguros?

Os tokens dos bots são armazenados criptografados — nem a equipe do Umbra Bot consegue ler o conteúdo. Todas as conexões usam HTTPS e os dados ficam em servidores seguros.

---

## Não encontrou o que procurava?

Entre em contato com o suporte.

<!-- TODO: adicionar link/canal de suporte quando definido -->
