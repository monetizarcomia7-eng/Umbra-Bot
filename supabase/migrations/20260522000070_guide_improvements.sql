-- ============================================================
-- 070 — Guia da Plataforma: melhorias completas
-- Adiciona colunas, corrige RLS, cria tabelas auxiliares,
-- RPCs atômicas e seed com 17 artigos + 7 FAQs
-- ============================================================

-- ============================================================
-- 1. ALTER TABLE guide_articles — colunas adicionais
-- ============================================================

ALTER TABLE public.guide_articles
  ADD COLUMN IF NOT EXISTS slug               text,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'published'
                                               CHECK (status IN ('published','draft','archived')),
  ADD COLUMN IF NOT EXISTS icon               text NOT NULL DEFAULT 'book-open',
  ADD COLUMN IF NOT EXISTS icon_color         text NOT NULL DEFAULT 'var(--primary)',
  ADD COLUMN IF NOT EXISTS helpful_yes        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helpful_no         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags               text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS order_in_category  integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS guide_articles_slug_idx
  ON public.guide_articles (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS guide_articles_status_idx
  ON public.guide_articles (status);

-- ============================================================
-- 2. Fix RLS — SELECT-only para authenticated
-- ============================================================

DROP POLICY IF EXISTS "guide_articles_open"                 ON public.guide_articles;
DROP POLICY IF EXISTS "guide_articles_authenticated_select" ON public.guide_articles;

CREATE POLICY "guide_articles_authenticated_select"
  ON public.guide_articles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. Tabela guide_faqs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guide_faqs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL DEFAULT '',
  answer     text        NOT NULL DEFAULT '',
  order_num  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guide_faqs_order_idx ON public.guide_faqs (order_num);

ALTER TABLE public.guide_faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guide_faqs_select" ON public.guide_faqs;
CREATE POLICY "guide_faqs_select" ON public.guide_faqs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. Tabela guide_article_votes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guide_article_votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id text        NOT NULL REFERENCES public.guide_articles(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful    boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_article_votes_uq UNIQUE (article_id, user_id)
);

CREATE INDEX IF NOT EXISTS guide_votes_article_idx ON public.guide_article_votes (article_id);
CREATE INDEX IF NOT EXISTS guide_votes_user_idx    ON public.guide_article_votes (user_id);

ALTER TABLE public.guide_article_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guide_votes_owner" ON public.guide_article_votes;
CREATE POLICY "guide_votes_owner" ON public.guide_article_votes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. Tabela guide_search_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guide_search_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  query         text        NOT NULL,
  results_count integer     NOT NULL DEFAULT 0,
  clicked       boolean     NOT NULL DEFAULT false,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guide_search_logs_user_idx ON public.guide_search_logs (user_id);
CREATE INDEX IF NOT EXISTS guide_search_logs_query_idx ON public.guide_search_logs (query);

ALTER TABLE public.guide_search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guide_search_logs_insert" ON public.guide_search_logs;
CREATE POLICY "guide_search_logs_insert" ON public.guide_search_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. RPC: increment_article_views (atômico)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE guide_articles
  SET views = views + 1
  WHERE id = p_article_id AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO authenticated;

-- ============================================================
-- 7. RPC: vote_article (upsert + ajusta contadores)
-- ============================================================

CREATE OR REPLACE FUNCTION public.vote_article(p_article_id text, p_helpful boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing boolean;
BEGIN
  SELECT helpful INTO v_existing
  FROM guide_article_votes
  WHERE article_id = p_article_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO guide_article_votes (article_id, user_id, helpful)
    VALUES (p_article_id, auth.uid(), p_helpful);
    IF p_helpful THEN
      UPDATE guide_articles SET helpful_yes = helpful_yes + 1 WHERE id = p_article_id;
    ELSE
      UPDATE guide_articles SET helpful_no = helpful_no + 1 WHERE id = p_article_id;
    END IF;
  ELSIF v_existing = p_helpful THEN
    -- Mesmo voto: toggle off (remove)
    DELETE FROM guide_article_votes
    WHERE article_id = p_article_id AND user_id = auth.uid();
    IF p_helpful THEN
      UPDATE guide_articles SET helpful_yes = GREATEST(0, helpful_yes - 1) WHERE id = p_article_id;
    ELSE
      UPDATE guide_articles SET helpful_no  = GREATEST(0, helpful_no - 1)  WHERE id = p_article_id;
    END IF;
  ELSE
    -- Voto diferente: troca
    UPDATE guide_article_votes SET helpful = p_helpful
    WHERE article_id = p_article_id AND user_id = auth.uid();
    IF p_helpful THEN
      UPDATE guide_articles
        SET helpful_yes = helpful_yes + 1,
            helpful_no  = GREATEST(0, helpful_no - 1)
        WHERE id = p_article_id;
    ELSE
      UPDATE guide_articles
        SET helpful_no  = helpful_no + 1,
            helpful_yes = GREATEST(0, helpful_yes - 1)
        WHERE id = p_article_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_article(text, boolean) TO authenticated;

-- ============================================================
-- 8. RPC: get_article_vote (voto atual do usuário)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_article_vote(p_article_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT helpful FROM guide_article_votes
  WHERE article_id = p_article_id AND user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_article_vote(text) TO authenticated;

-- ============================================================
-- 9. Seed: guide_articles (17 artigos com corpo em Markdown)
-- ============================================================

INSERT INTO public.guide_articles
  (id, slug, category, icon, icon_color, title, excerpt, read_min, views,
   featured, helpful_yes, helpful_no, status, order_in_category, body, updated_at)
VALUES

-- a01 -------------------------------------------------------
('a01', 'bem-vindo-ao-umbra-bot', 'getting_started', 'rocket', 'var(--primary)',
 'Bem-vindo ao Umbra Bot — visão geral do painel',
 'Tour rápido pelos módulos do painel — Dashboard, Bots, Fluxos, Financeiro — e o que cada um faz.',
 4, 8420, true, 0, 0, 'published', 1,
$a01$
## Módulos do painel

O Umbra Bot é uma plataforma de automação de vendas para o Telegram. Em um único painel você gerencia bots, cria fluxos de conversa, processa pagamentos PIX, dispara mensagens e monitora resultados em tempo real.

| Módulo | O que faz |
|--------|-----------|
| **Dashboard** | KPIs de receita, vendas e conversão com gráfico diário |
| **Bots** | Conecte e monitore seus bots; cada um tem métricas de leads e receita |
| **Fluxos** | Editor visual de conversas com nós arrastáveis |
| **Financeiro** | Extrato, saques e faturas atualizados em tempo real |
| **Clientes** | Todos os contatos da base com filtros, tags e timeline |
| **Análises** | Funil de conversão, coorte semanal e top produtos |
| **Disparos** | Envio em massa para segmentos com agendamento |
| **Rastreamento** | Pixels da Meta, TikTok e Google com CAPI server-side |
| **Webhooks** | Integre o Umbra Bot com Zapier, Make, n8n e qualquer API |

## Atalhos de teclado

| Atalho | Ação |
|--------|------|
| ⌘K | Busca global (14 tabelas) |
| B | Bots |
| F | Fluxos |
| C | Clientes |
| A | Análises |

> **Dica:** Pressione `⌘K` em qualquer tela para ir direto a qualquer módulo sem usar a barra lateral.

## Por onde começar

1. Conecte seu primeiro bot → veja *Como conectar seu primeiro bot em 3 minutos*
2. Configure o gateway de pagamentos → veja *Conectando o Mercado Pago e configurando Pix*
3. Crie seu primeiro fluxo de conversa → veja *Anatomia do editor visual de fluxos*

## Próximos passos

Use o modo ao vivo na aba **Atividade** para acompanhar leads e vendas assim que acontecem. O Supabase Realtime atualiza tudo sem precisar recarregar a página.
$a01$,
 now() - interval '3 days'),

-- a02 -------------------------------------------------------
('a02', 'conectar-primeiro-bot', 'getting_started', 'rocket', 'var(--primary)',
 'Como conectar seu primeiro bot em 3 minutos',
 'Vamos do @BotFather até o webhook configurado, passo a passo.',
 3, 6210, true, 0, 0, 'published', 2,
$a02$
## Pré-requisitos

- Uma conta no Telegram
- Acesso ao @BotFather no Telegram
- Conta ativa no Umbra Bot

## Passo 1 — Criar o bot no BotFather

1. Abra o Telegram e procure **@BotFather**.
2. Envie `/newbot` e siga as instruções.
3. Escolha um **nome** (ex.: "Minha Loja") e um **username** (deve terminar em `bot`).
4. O BotFather retorna o **token** no formato `1234567890:AAFxxxxx...`.

> **Copie o token completo** — você vai precisar dele no próximo passo.

## Passo 2 — Adicionar o bot no Umbra Bot

1. No painel, acesse **Bots** na barra lateral.
2. Clique em **+ Adicionar bot**.
3. Cole o token e clique em **Validar** — o painel confirma o nome e @username em tempo real.
4. Preencha o nome de exibição e clique em **Salvar**.

## Passo 3 — Webhook registrado automaticamente

Ao salvar, o Umbra Bot chama `setWebhook` no Telegram. O status muda para **Online** em segundos.

Se o status ficar **Offline**, clique em **Reconectar** na aba Geral do bot.

## Verificando

Abra o Telegram, procure seu bot pelo @username e envie `/start`. Ele deve responder com a mensagem de boas-vindas configurada em **Bots → Mensagens padrão**.

## Problemas comuns

- **"Token inválido"** — confira se copiou o token completo, sem espaços extras.
- **Bot não responde** — aguarde 30 segundos e clique em Reconectar.
- **@username já existe** — adicione um sufixo numérico (ex.: `minhaloja42_bot`).
$a02$,
 now() - interval '5 days'),

-- a03 -------------------------------------------------------
('a03', 'convidar-equipe-papeis', 'getting_started', 'rocket', 'var(--primary)',
 'Convidando sua equipe e definindo papéis',
 'Administrador, Editor, Analista: o que cada papel pode fazer e como convidar membros.',
 5, 2840, false, 0, 0, 'published', 3,
$a03$
## Papéis disponíveis

| Papel | Acesso |
|-------|--------|
| Proprietário | Total — não pode ser alterado |
| Administrador | Bots, fluxos, finanças e equipe |
| Editor | Bots, fluxos e disparos; sem acesso a finanças |
| Analista | Somente leitura — análises e relatórios |

## Como convidar um membro

1. Acesse **Perfil** na barra lateral → aba **Equipe**.
2. Clique em **Convidar membro**.
3. Digite o e-mail e selecione o papel desejado.
4. Clique em **Enviar convite**.

O convidado recebe uma notificação na aba **Alertas** na próxima vez que entrar no painel. Ele aceita ou recusa em **Perfil → Convites pendentes**.

## Gerenciando membros

Na aba Equipe, o menu de ações de cada membro permite:
- **Alterar papel** — selecione um novo papel no dropdown.
- **Remover** — abre confirmação antes de excluir.

## Boas práticas

- Use o papel **Analista** para quem só acompanha métricas.
- Use **Editor** para quem cria campanhas mas não deve ver o financeiro.
- Limite o papel **Administrador** a pessoas de confiança com acesso à conta bancária.

> **Nota:** o controle de acesso por papel está em desenvolvimento. No momento, cada membro acessa apenas o próprio workspace.
$a03$,
 now() - interval '14 days'),

-- a10 -------------------------------------------------------
('a10', 'validar-token-botfather', 'bots', 'bot', 'var(--success)',
 'Validando o token do BotFather',
 'Como verificar se um token está correto antes de conectar o bot.',
 2, 4180, false, 0, 0, 'published', 1,
$a10$
## Formato do token

```
1234567890:AAFexemplo_xxxxxxxxxxxxxxxxxxxxxxxxx
```

Composto por:
- **ID numérico** do bot (antes dos dois-pontos)
- **Chave secreta** de 35 caracteres (após os dois-pontos)

## Validação no Umbra Bot

Ao colar o token na tela de Bots, o painel chama `getMe` do Telegram em tempo real e confirma:

1. O token é válido e pertence a um bot real.
2. O bot está ativo (não banido).
3. O @username e o nome são retornados para exibição.

## Validação manual via cURL

```bash
curl "https://api.telegram.org/bot{SEU_TOKEN}/getMe"
```

Resposta esperada:
```json
{
  "ok": true,
  "result": { "is_bot": true, "first_name": "Meu Bot", "username": "meubot_bot" }
}
```

Se `ok` for `false`, o token é inválido ou o bot foi excluído.

## Tokens legados

Tokens criados antes da criptografia AES-256-GCM ficam em texto plano no banco. Use o botão **Migrar tokens** em Ferramentas para re-encriptar todos de uma vez.
$a10$,
 now() - interval '7 days'),

-- a11 -------------------------------------------------------
('a11', 'bot-banido-recuperar', 'bots', 'bot', 'var(--success)',
 'Bot banido — como recuperar ou substituir',
 'O Telegram baniu seu bot? Veja o que fazer e como manter os contatos.',
 6, 1842, false, 0, 0, 'published', 2,
$a11$
## Por que bots são banidos

O Telegram bane bots quando violam as Políticas de Bots. Causas mais comuns:

- Envio de conteúdo proibido ou spam
- Disparos para contatos que não iniciaram conversa
- Muitas requisições simultâneas acima do rate limit
- Resposta a mensagens de grupos sem permissão explícita

## Como verificar

Na aba **Bots**, bots banidos aparecem com status **Banido**. Você também pode checar manualmente:

```bash
curl "https://api.telegram.org/bot{TOKEN}/getMe"
# Retorna "Unauthorized" se banido
```

## Tentando recuperar

O Telegram não oferece apelação automática. Opções:

1. Contate **@BotSupport** no Telegram — descreva o caso e aguarde (pode demorar dias).
2. Crie um novo bot no @BotFather.

## Criando um bot substituto

1. No @BotFather, crie um novo bot e copie o token.
2. No Umbra Bot → Bots → **+ Adicionar bot** — cole o token do novo bot.
3. Atualize os links `t.me/novousername` nos seus checkouts e materiais.
4. Os **contatos** são preservados — são associados pelo `telegram_id` do contato, não do bot.

> Contatos que bloquearam o bot antigo não podem ser contactados pelo novo. Isso é esperado pelo Telegram.

## Prevenindo banimentos

- Respeite o limite de **30 mensagens/segundo** (já configurado por padrão no Umbra Bot).
- Dispare apenas para contatos que enviaram `/start` voluntariamente.
- Evite conteúdo adulto, links de phishing ou spam financeiro.
$a11$,
 now() - interval '12 days'),

-- a12 -------------------------------------------------------
('a12', 'configurar-webhook', 'bots', 'bot', 'var(--success)',
 'Configurando o webhook do bot',
 'Como o Umbra Bot recebe eventos do Telegram e o que cada endpoint faz.',
 4, 1284, false, 0, 0, 'published', 3,
$a12$
## O que é o webhook

O webhook é uma URL no Umbra Bot que o Telegram chama toda vez que alguém envia uma mensagem. Sem webhook configurado, o bot não responde.

## Endpoint

```
POST https://umbra.bot/api/telegram/webhook
Header: X-Telegram-Bot-Api-Secret-Token: {webhook_secret}
```

O `webhook_secret` é gerado automaticamente. Ele garante que apenas o Telegram consegue enviar mensagens para este endpoint.

## Registro automático

Ao salvar um bot, o Umbra Bot chama `setWebhook` no Telegram com:
- URL do endpoint
- Secret token gerado internamente
- Updates aceitos: `message`, `callback_query`

## Status na aba Geral

| Status | Significado |
|--------|-------------|
| Online | Webhook ativo e respondendo |
| Offline | Webhook não registrado ou com erro recente |
| Banido | Bot removido pelo Telegram |

## Re-registrando manualmente

Se o status ficar **Offline** após um deploy ou troca de domínio:

1. Na aba Geral do bot, clique em **Reconectar webhook**.
2. O Umbra Bot chama `setWebhook` novamente.

## Monitoramento automático

O cron `check-bots` roda a cada 30 minutos, chama `getWebhookInfo` para cada bot e marca como **Offline** se detectar erros. Um alerta crítico é gerado automaticamente.
$a12$,
 now() - interval '20 days'),

-- a20 -------------------------------------------------------
('a20', 'anatomia-editor-visual-fluxos', 'flows', 'git-branch', 'var(--warning)',
 'Anatomia do editor visual de fluxos',
 'Nós, conexões, condições e como pensar fluxos que convertem.',
 7, 5128, true, 0, 0, 'published', 1,
$a20$
## O que é um fluxo

Um fluxo é uma sequência visual de nós que define como seu bot conversa. Cada nó representa uma ação e se conecta ao próximo por arestas. O bot executa o fluxo quando alguém envia `/start`.

## Tipos de nó

| Tipo | Categoria | Descrição |
|------|-----------|-----------|
| Mensagem | Conversa | Envia texto livre |
| Pergunta | Conversa | Captura a resposta em `{variavel}` |
| Botões | Conversa | Até 6 botões inline; cada um cria uma saída separada |
| Condição | Lógica | Bifurca: Sim / Não |
| Delay | Lógica | Pausa o fluxo (segundos, minutos, horas) |
| Tag | CRM | Adiciona ou remove tag do contato |
| Oferta | Comercial | Produto com preço e botão de CTA |
| Imagem | Mídia | Envia foto via URL |
| Link | Mídia | Botão com URL externa |
| Fim | Terminal | Encerra o fluxo |

## Navegação no canvas

- **Arrastar** — clique no fundo e arraste (não em cima de nós)
- **Zoom** — scroll do mouse
- **Selecionar vários** — Shift+clique ou Shift+arrastar uma área
- **Deletar** — Delete ou Backspace com nó/aresta selecionados
- **Desfazer/Refazer** — ⌘Z / ⌘Y (até 50 passos)

## Nó inicial

O nó sem aresta de entrada recebe o badge **▷ INÍCIO**. A execução começa nele quando alguém envia `/start`.

## Publicando

Um fluxo em rascunho não executa. Clique em **Publicar** para ativá-lo. Após publicar, o bot usa este fluxo para todos os novos contatos.

## Limites

- Profundidade máxima de execução: **10 nós** por `/start` (proteção contra loops).
- Nó Delay: a pausa não é em tempo real; o contato aguarda no estado `flow_node_id` até responder.
$a20$,
 now() - interval '6 days'),

-- a21 -------------------------------------------------------
('a21', 'variaveis-nome-produto', 'flows', 'git-branch', 'var(--warning)',
 'Variáveis — {nome}, {produto} e mais',
 'Como usar variáveis em mensagens e por que elas turbinam conversão.',
 3, 2440, false, 0, 0, 'published', 2,
$a21$
## Variáveis disponíveis

| Variável | Substituída por |
|----------|----------------|
| `{nome}` | Primeiro nome do contato no Telegram |
| `{bot}` | Nome do bot |
| `{produto}` | Nome do produto (em nós de oferta) |
| `{valor}` | Preço formatado em BRL (ex.: R$ 197,00) |
| `{data}` | Data atual no formato DD/MM/AAAA |

## Onde usar

Variáveis funcionam em qualquer campo de texto: **Mensagem**, **Pergunta**, **Botões**, **Oferta** e na **mensagem de boas-vindas** em Bots → Mensagens padrão.

## Variáveis capturadas pelo nó Pergunta

O nó Pergunta salva a resposta em uma variável que você nomeia, por exemplo `{email}`. Essa variável fica disponível em todos os nós seguintes do mesmo fluxo.

**Exemplo de fluxo:**

1. **Pergunta** → "Qual é o seu e-mail?" → captura em `{email}`
2. **Mensagem** → "Ótimo! Vou enviar informações para {email}."
3. **Tag** → adiciona `email-coletado`

## Por que variáveis aumentam conversão

Mensagens com `{nome}` têm, em média, 23% mais taxa de abertura do que mensagens genéricas. Use `{nome}` no início da primeira mensagem para criar conexão imediata.

## Exemplo de mensagem personalizada

```
Olá, {nome}! Você demonstrou interesse em {produto}.

Aqui está um resumo rápido:
Investimento: {valor}
Oferta válida até: {data}

Quer garantir o seu acesso agora?
```
$a21$,
 now() - interval '16 days'),

-- a22 -------------------------------------------------------
('a22', 'boas-praticas-funil-vip', 'flows', 'git-branch', 'var(--warning)',
 'Boas práticas: o funil VIP de 7 etapas',
 'Modelo passo-a-passo que vende mentoria premium em alta conversão.',
 9, 3128, false, 0, 0, 'published', 3,
$a22$
## O que é o funil VIP

O funil VIP é uma sequência de 7 nós no editor de fluxos que combina qualificação, educação e urgência para vender produtos premium (R$ 497+) com alta taxa de conversão.

## Estrutura das 7 etapas

**Etapa 1 — Abertura (nó Mensagem)**
Apresente o bot e conecte o produto ao problema declarado. Use `{nome}` para personalizar.

**Etapa 2 — Qualificação (nó Pergunta)**
Faça uma pergunta de diagnóstico para entender o nível do contato. Ex.: "Você já tentou resolver X antes?"

**Etapa 3 — Educação (nó Mensagem)**
Explique o método em 3-4 parágrafos curtos. Antes / Depois / Método.

**Etapa 4 — Prova social (nó Imagem + Mensagem)**
Envie um resultado de cliente com citação específica. Ex.: "João saiu de R$ 2.000 para R$ 18.000/mês em 90 dias."

**Etapa 5 — Oferta (nó Oferta)**
Revele o preço depois de construir valor. Liste bônus com valor individual antes do investimento total.

**Etapa 6 — Objeção (nó Botões)**
Capture quem ficou em dúvida:
- [Quero garantir meu acesso]
- [Tenho uma dúvida]
- [Preciso pensar mais]

**Etapa 7 — CTA (nó Link)**
Urgência real + botão para o checkout. Ex.: "Últimas 8 vagas — link fecha às 23h59."

## Métricas de referência

| Etapas | Abandono típico |
|--------|----------------|
| 1-2 | ~40% |
| 3-4 | ~20% |
| 5-7 | ~15% |
| **Conversão final** | **~25% dos leads** |

## Dica de configuração

No nó Oferta, configure `{produto}` e `{valor}` para que o fluxo funcione com qualquer produto sem precisar editar manualmente.
$a22$,
 now() - interval '25 days'),

-- a30 -------------------------------------------------------
('a30', 'split-pagamento', 'payments', 'credit-card', 'var(--danger)',
 'Como o split de pagamento funciona',
 'Gateway, comissão Umbra Bot e sua conta — quem retém o quê em cada venda.',
 5, 4120, true, 0, 0, 'published', 1,
$a30$
## O que é o split

Quando uma venda é confirmada, o valor se divide automaticamente entre:

1. **Taxa do gateway** (ex.: 0,99% para Pix via Mercado Pago)
2. **Comissão Umbra Bot** (3% fixo)
3. **Você** — o restante, liquidado na sua conta

## Exemplo com Pix de R$ 100

| Destinatário | Valor | % |
|-------------|-------|---|
| Gateway (PIX) | R$ 0,99 | 0,99% |
| Umbra Bot | R$ 3,00 | 3,00% |
| **Você** | **R$ 96,01** | **96,01%** |

## Taxas por método (Mercado Pago)

| Método | Taxa |
|--------|------|
| PIX | 0,99% |
| Cartão de crédito à vista | 4,99% |
| Boleto | 3,49% |

## Quando o dinheiro fica disponível

- **PIX:** aprovação instantânea. Disponível para saque no próximo dia útil.
- **Cartão à vista:** D+14.
- **Cartão parcelado:** D+30.

## Solicitando saque

1. Acesse **Financeiro** → botão **Solicitar saque**.
2. Selecione a conta bancária de destino.
3. O cron processa saques aprovados todos os dias às 06:00 UTC.

## Afiliados

Se o programa de afiliados está ativo, a comissão do afiliado é debitada **do seu valor** — não das taxas. Configure a porcentagem em **Afiliados → Configurações do programa**.
$a30$,
 now() - interval '4 days'),

-- a31 -------------------------------------------------------
('a31', 'conectar-mercadopago-pix', 'payments', 'credit-card', 'var(--danger)',
 'Conectando o Mercado Pago e configurando Pix',
 'Token de API, conta de recebimento e teste de cobrança em 3 cliques.',
 4, 2810, false, 0, 0, 'published', 2,
$a31$
## Pré-requisito

Conta ativa no **Mercado Pago** com aplicativo aprovado como desenvolvedor.

## Conexão via OAuth (recomendado)

1. Acesse **Gateways** no painel.
2. Clique em **Conectar** no card do Mercado Pago.
3. Selecione ou crie uma conta bancária de recebimento.
4. Clique no botão azul **"Conectar com Mercado Pago"**.
5. Autorize na tela do Mercado Pago e volte ao painel.

O token é armazenado criptografado (AES-256-GCM) com validade de 180 dias. Você recebe um alerta automático antes do vencimento.

## Conexão manual (Access Token)

1. No [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel), copie o **Access Token** de produção.
2. No Umbra Bot, clique em **"Prefiro inserir o Access Token manualmente"**.
3. Cole o token e clique em **Validar**.

## Testando a conexão

Clique em **Verificar conexão** no card do gateway — o Umbra Bot chama a API do Mercado Pago e confirma se o token é válido.

## Configurando conta de recebimento

Clique em **Configurar** no card para definir qual conta PIX recebe os valores liquidados.

## Token expirado

Tokens OAuth expiram em 180 dias. Quando o badge de expiração aparecer, clique em **Renovar token** para um novo fluxo OAuth sem desconectar.
$a31$,
 now() - interval '9 days'),

-- a32 -------------------------------------------------------
('a32', 'taxas-prazos-liquidacao', 'payments', 'credit-card', 'var(--danger)',
 'Taxas, antecipação e prazos de liquidação',
 'Tabela comparativa de gateways suportados no Umbra Bot.',
 6, 1840, false, 0, 0, 'published', 3,
$a32$
## Comparativo de taxas

| Gateway | PIX | Cartão à vista | Boleto |
|---------|-----|---------------|--------|
| Mercado Pago | 0,99% | 4,99% | 3,49% |
| Pushinpay | 0,99% | — | — |
| Pagar.me | 0,50% | 2,99% | 2,99% |
| Stripe | 1,50% | 3,59% | — |

> Confirme as taxas vigentes diretamente com o gateway. Os valores acima são de referência.

## Prazos de liquidação

| Método | D+ para saldo disponível |
|--------|--------------------------|
| PIX | D+1 útil |
| Cartão à vista | D+14 |
| Cartão 2-12x | D+30 |
| Boleto | D+2 úteis após compensação |

O saldo no painel **Financeiro** reflete apenas transações com `status = aprovada`.

## Antecipação

O Mercado Pago oferece antecipação de recebíveis de cartão parcelado (custo ~1,99% a.m.). Configure diretamente no painel do Mercado Pago — o Umbra Bot não interfere neste fluxo.

## Comissão Umbra Bot

A comissão de **3%** é descontada automaticamente em cada venda aprovada. Ela aparece na coluna **Taxa** do extrato em Financeiro.

## Chargebacks e reembolsos

- **Chargeback:** o gateway retém o valor durante a disputa. O Umbra Bot gera um alerta automático tipo "Chargeback recebido" via webhook.
- **Reembolso:** processe diretamente no painel do gateway. O webhook atualiza o status para `refunded` no Umbra Bot automaticamente.
$a32$,
 now() - interval '28 days'),

-- a40 -------------------------------------------------------
('a40', 'limites-envio-telegram', 'broadcasts', 'send', 'oklch(0.62 0.18 280)',
 'Limites de envio do Telegram (30 msgs/s)',
 'Por que disparos demoram e como o Umbra Bot enfileira para não dar throttling.',
 4, 2240, false, 0, 0, 'published', 1,
$a40$
## Limites oficiais do Telegram

| Limite | Valor |
|--------|-------|
| Mensagens por segundo (global) | 30 |
| Mensagens por minuto (mesmo chat) | 20 |
| Mensagens por segundo (mesmo grupo) | 1 |

Ultrapassar esses limites resulta em erro `429 Too Many Requests`.

## Como o Umbra Bot respeita os limites

O Umbra Bot usa um delay de **35 ms entre mensagens** (≈ 28 msgs/s), mantendo margem de segurança. Isso é configurado internamente.

## Estimativa de tempo para disparos

```
10.000 mensagens ÷ 28 msgs/s = ~357 segundos ≈ 6 minutos
```

O progresso aparece em tempo real na tela de Disparos via Supabase Realtime.

## Cancelando um disparo em andamento

Clique em **Cancelar disparo** na barra de progresso. O cancelamento é verificado a cada 50 mensagens — pode demorar alguns segundos para entrar em efeito.

## Múltiplos bots

Cada bot tem seu próprio limite de 30 msgs/s — não há rate limit compartilhado entre bots. Se você tem 2 bots com bases separadas, os disparos rodam em paralelo sem interferência.

## Erros de entrega

- **403 Forbidden** — contato bloqueou o bot: marcado como `failed`, execução continua.
- **400 Bad Request** — chat não encontrado: contato apagou a conta ou removeu o bot.

Falhas são contabilizadas na coluna **Falhas** e na taxa de entrega do disparo.
$a40$,
 now() - interval '11 days'),

-- a41 -------------------------------------------------------
('a41', 'segmentacao-tags', 'broadcasts', 'send', 'oklch(0.62 0.18 280)',
 'Segmentando sua base com tags',
 'Tag = filtro. Como criar segmentos que tornam cada disparo mais relevante.',
 3, 1684, false, 0, 0, 'published', 2,
$a41$
## O que são tags

Tags são etiquetas livres que você aplica a contatos para criar segmentos. Exemplos: `comprador`, `vip`, `webinar-junho`.

## Adicionando tags

**Individual:** abra o perfil lateral de um contato em Clientes → campo de tags → pressione Enter.

**Em lote (bulk):** marque os checkboxes na listagem de Clientes → botão **Adicionar tag** → confirme.

**Via fluxo (automático):** use o nó **Tag** no editor visual para adicionar ou remover tags conforme o contato avança.

## Usando tags em disparos

No campo **Público-alvo** de um disparo, as opções são:

| Segmento | Quem recebe |
|----------|-------------|
| Todos | Todos os contatos do bot |
| Leads | Quem nunca comprou |
| Compradores | Quem tem ao menos 1 compra aprovada |
| `tag:NOME` | Contatos com a tag exata `NOME` |

## Boas práticas de nomenclatura

Use nomes em minúsculo, sem acentos, com hífens:

- ✅ `comprador`, `vip`, `interesse-mentoria`, `webinar-2026-05`
- ❌ `Comprador`, `Interesse Mentoria`

Consistência evita duplicatas — o Umbra Bot não normaliza tags automaticamente.

## Removendo tags

No perfil do contato, clique no X ao lado de cada tag para removê-la individualmente.
$a41$,
 now() - interval '18 days'),

-- a42 -------------------------------------------------------
('a42', 'boas-praticas-copy-disparos', 'broadcasts', 'send', 'oklch(0.62 0.18 280)',
 'Boas práticas de copy para disparos',
 'Cabeçalho, gatilho de abertura e CTA: estrutura de mensagens que convertem.',
 5, 2128, false, 0, 0, 'published', 3,
$a42$
## Estrutura de uma mensagem que converte

### 1. Abertura (1-2 linhas)
Evite saudações genéricas. Vá direto ao ponto.

- ❌ "Olá, {nome}! Tudo bem por aí?"
- ✅ "{nome}, você sabe por que 87% das pessoas desistem da dieta no 3º dia?"

### 2. Corpo (2-4 parágrafos curtos)
No Telegram, mensagens longas têm baixa leitura. Use parágrafos de 2-3 linhas separados por quebra.

### 3. CTA (1-2 linhas)
Um único apelo à ação. Seja específico:

- ❌ "Clique aqui para saber mais."
- ✅ "Acesse agora → [link] — oferta válida por 24h."

## Técnicas de engajamento

- **Pergunta no início:** +34% de taxa de resposta.
- **Especificidade:** "R$ 23.847 em 90 dias" converte mais do que "muito dinheiro".
- **Emojis com moderação:** 1-3 por mensagem aumentam abertura; mais do que isso, reduz percepção de profissionalismo.
- **Urgência real:** só use escassez verdadeira — urgência falsa destrói credibilidade.

## Erros mais comuns

| Erro | Como corrigir |
|------|---------------|
| Mensagem muito longa | Quebre em 2-3 mensagens menores (múltiplos nós) |
| CTA vago | Diga exatamente o que acontece ao clicar |
| Enviar sem testar | Use o botão Prévia antes de disparar |
| Disparar à noite | Picos de abertura: 08-09h e 19-20h |

## Limite de caracteres

O Telegram aceita até **4.096 caracteres** por mensagem. O MessageComposer exibe um contador — se ultrapassar, divida em dois nós Mensagem.
$a42$,
 now() - interval '30 days'),

-- a50 -------------------------------------------------------
('a50', 'pixel-meta-capi', 'integrations', 'globe', 'oklch(0.62 0.16 200)',
 'Pixel da Meta + CAPI no Umbra Bot',
 'Configurando rastreamento server-side e melhorando o match rate.',
 6, 3284, false, 0, 0, 'published', 1,
$a50$
## O que é a CAPI

A Conversions API (CAPI) envia eventos de conversão diretamente do servidor do Umbra Bot para a Meta — sem depender do pixel JavaScript no browser, sem bloqueadores de anúncio, sem limitações do iOS. Resultado: match rate muito mais alto.

## Configurando o pixel

1. Acesse **Rastreamento** no painel.
2. No card **Meta**, clique em **Configurar**.
3. Preencha:
   - **Meta Pixel ID** — número de 10-16 dígitos do Gerenciador de Eventos
   - **Access Token da CAPI** — gerado em Configurações → API de Conversões
   - Marque **Ativar CAPI** para envio server-to-server

## Obtendo o Access Token da CAPI

1. No Gerenciador de Eventos, selecione o pixel.
2. Clique em **Configurações → API de Conversões**.
3. Gere um token com permissões `ads_management` e `conversions_api`.

## Eventos enviados automaticamente

O Umbra Bot envia o evento `Purchase` via CAPI toda vez que uma transação recebe `status = approved` no webhook do Mercado Pago.

Campos enviados:
- `event_id`: ID da transação (deduplicação automática)
- `value` e `currency`: valor em BRL
- `em` (hash SHA-256 do e-mail) e `fn` (hash do nome) quando disponíveis

## Match rate

Meta ideal: acima de **70%**. Para aumentar:
- Configure CPF/e-mail no checkout público — o Umbra Bot os envia com hash via CAPI.
- Use o snippet do pixel JavaScript no checkout (em Rastreamento → SnippetCard).

## Verificando a configuração

Clique em **Verificar** no card do pixel → confirmação da Graph API. Em seguida, clique em **Enviar evento de teste** para ver o evento aparecer no Gerenciador de Eventos com código `TEST00001`.
$a50$,
 now() - interval '8 days'),

-- a51 -------------------------------------------------------
('a51', 'verificar-assinatura-webhook', 'integrations', 'globe', 'oklch(0.62 0.16 200)',
 'Verificando a assinatura de webhooks',
 'HMAC SHA-256 e o header X-Umbra-Signature. Exemplo em Node/Python.',
 4, 940, false, 0, 0, 'published', 2,
$a51$
## Por que verificar a assinatura

A assinatura garante que o payload recebido veio **realmente do Umbra Bot** e não foi adulterado em trânsito. Sem verificação, qualquer pessoa que souber a URL do endpoint pode enviar dados falsos.

## Como funciona

O Umbra Bot calcula um HMAC-SHA256 do corpo da requisição usando o **secret do webhook** e envia no header:

```
X-Umbra-Signature-256: sha256=<hex_digest>
```

## Verificando em Node.js

```typescript
import crypto from 'crypto'

function verifySignature(body: string | Buffer, secret: string, header: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}
```

## Verificando em Python

```python
import hmac, hashlib

def verify_signature(body: bytes, secret: str, header: str) -> bool:
    expected = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

## Onde encontrar o secret

Em **Webhooks → Mostrar secret** no card do webhook. O secret é armazenado criptografado e exibido apenas sob demanda.

## Rotacionando o secret

1. No card do webhook, clique em **Rotacionar secret**.
2. Um novo secret é gerado imediatamente — o antigo é invalidado.
3. Atualize sua integração com o novo valor.

## Header X-Umbra-Retry

Reenvios automáticos incluem:
```
X-Umbra-Retry: N  (0 = primeira tentativa, 1 = segunda, 2 = terceira)
```

Use esse header para idempotência na sua lógica (evitar processar o mesmo evento duas vezes).
$a51$,
 now() - interval '22 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. Seed: guide_faqs (7 perguntas)
-- ============================================================

INSERT INTO public.guide_faqs (question, answer, order_num) VALUES
(
  'O Umbra Bot cobra mensalidade ou comissão por venda?',
  'Os dois. Você paga uma assinatura mensal de acordo com o plano (Starter, Pro ou Scale) e o Umbra Bot retém 3% sobre cada venda processada via gateway conectado. A comissão é descontada automaticamente no split — você não precisa pagar separadamente.',
  1
),
(
  'Posso usar mais de um gateway ao mesmo tempo?',
  'Sim. Conecte quantos gateways quiser e escolha qual é o padrão em cada checkout. Se um gateway cair, troque o gateway padrão diretamente na configuração do checkout.',
  2
),
(
  'O Telegram pode banir meu bot por causa do Umbra Bot?',
  'Não. O Umbra Bot usa a API oficial do Telegram Bots e respeita todos os limites de envio. Banimentos acontecem apenas se o conteúdo ou a forma de uso violar as Políticas do Telegram.',
  3
),
(
  'Como funciona o limite de mensagens do meu plano?',
  'Cada plano tem uma cota mensal de mensagens. A cota reseta no dia da renovação. Quando você ultrapassar 80%, recebe um alerta automático. Após 100%, os disparos pausam até a renovação ou upgrade de plano.',
  4
),
(
  'Os dados dos meus clientes ficam onde?',
  'Em data centers com alta disponibilidade via Supabase. O Umbra Bot é compatível com a LGPD — você é o controlador e nós somos o operador. Você pode exportar ou apagar dados pessoais a qualquer momento nas Configurações.',
  5
),
(
  'Posso testar antes de pagar?',
  'Sim. Todo plano tem 14 dias gratuitos com acesso completo. Sem necessidade de cartão de crédito na assinatura inicial — pedimos só quando você converter para um plano pago.',
  6
),
(
  'Vocês ajudam na migração de outra ferramenta?',
  'Sim. O time de Sucesso do Cliente faz a migração junto com você nos planos Pro e Scale, incluindo importação de leads, fluxos e templates. No plano Starter, use Ferramentas → Importar configurações para migrar manualmente.',
  7
)
ON CONFLICT DO NOTHING;
