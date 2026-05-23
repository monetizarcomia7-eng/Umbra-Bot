-- ============================================================
-- Umbra Bot — Migração 098
-- 1. Atualiza CHECK de activity_events para incluir 'courseCompleted'
-- 2. Seed de um curso completo "Dominando o Umbra Bot"
-- ============================================================

-- ─── 1. CHECK constraint de activity_events ─────────────────
-- Inclui 'courseCompleted' disparado quando usuário conclui 100% do curso
alter table public.activity_events
  drop constraint if exists activity_events_type_check;

alter table public.activity_events
  add constraint activity_events_type_check
  check (type in (
    'sale', 'lead', 'payment', 'refund', 'reconnect', 'disconnect',
    'limit', 'newBot', 'webhookFailed', 'flowPublished', 'cancellation',
    'failure', 'team_invite', 'courseCompleted'
  ));

-- ─── 2. Seed: "Dominando o Umbra Bot" ───────────────────────
-- Curso completo com 4 módulos e 13 aulas.
-- video_url vazio → admin preenche depois via Supabase Dashboard.
-- Idempotente via ON CONFLICT (id) DO NOTHING.
insert into public.courses (
  id,
  title,
  subtitle,
  instructor,
  instructor_role,
  instructor_avatar,
  level,
  duration_min,
  cover_accent,
  cover_pattern,
  featured,
  modules
)
values (
  'dominando-umbra-bot',
  'Dominando o Umbra Bot',
  'Do zero às primeiras vendas automáticas no Telegram — configuração, checkout e automações.',
  'Time Umbra Bot',
  'Especialistas em Automação de Vendas',
  'UB',
  'Iniciante',
  180,
  'oklch(0.55 0.22 290)',
  'wave',
  true,
  '[
    {
      "id": "m1-ub",
      "title": "Módulo 1 — Primeiros Passos",
      "lessons": [
        {
          "id": "l1-1-ub",
          "title": "Bem-vindo ao Umbra Bot",
          "description": "Entenda o que é o Umbra Bot, como a plataforma funciona e o que você vai aprender neste curso.",
          "duration_min": 8,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l1-2-ub",
          "title": "Criando sua conta",
          "description": "Passo a passo para criar sua conta e configurar seu perfil no painel da Umbra Bot.",
          "duration_min": 5,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l1-3-ub",
          "title": "Tour pelo painel",
          "description": "Conheça todas as abas do painel e entenda para que serve cada seção.",
          "duration_min": 10,
          "type": "video",
          "video_url": ""
        }
      ]
    },
    {
      "id": "m2-ub",
      "title": "Módulo 2 — Configurando seu Bot",
      "lessons": [
        {
          "id": "l2-1-ub",
          "title": "Criando seu bot no BotFather",
          "description": "Aprenda a criar um bot no Telegram usando o BotFather e como obter o token de acesso.",
          "duration_min": 12,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l2-2-ub",
          "title": "Conectando o bot ao Umbra Bot",
          "description": "Como adicionar seu token ao painel e registrar o webhook corretamente.",
          "duration_min": 8,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l2-3-ub",
          "title": "Personalizando a mensagem de boas-vindas",
          "description": "Configure a mensagem que seus leads recebem ao entrar em contato com o bot pela primeira vez.",
          "duration_min": 6,
          "type": "video",
          "video_url": ""
        }
      ]
    },
    {
      "id": "m3-ub",
      "title": "Módulo 3 — Primeiro PIX",
      "lessons": [
        {
          "id": "l3-1-ub",
          "title": "Conectando o Mercado Pago",
          "description": "Configure o gateway de pagamento via OAuth para receber PIX automaticamente no Telegram.",
          "duration_min": 10,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l3-2-ub",
          "title": "Criando seu checkout",
          "description": "Monte uma página de pagamento profissional para o seu produto digital.",
          "duration_min": 15,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l3-3-ub",
          "title": "Testando o fluxo de compra",
          "description": "Simule uma compra do início ao fim e verifique os dados no painel da Umbra Bot.",
          "duration_min": 8,
          "type": "video",
          "video_url": ""
        }
      ]
    },
    {
      "id": "m4-ub",
      "title": "Módulo 4 — Automações Avançadas",
      "lessons": [
        {
          "id": "l4-1-ub",
          "title": "Criando fluxos de venda",
          "description": "Construa seu primeiro fluxo automatizado com o editor visual de fluxos da Umbra Bot.",
          "duration_min": 18,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l4-2-ub",
          "title": "Configurando remarketing",
          "description": "Crie campanhas de remarketing para recuperar leads e compradores inativos automaticamente.",
          "duration_min": 14,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l4-3-ub",
          "title": "Disparos em massa (Broadcasts)",
          "description": "Envie mensagens em massa segmentadas para leads, compradores ou por tags personalizadas.",
          "duration_min": 12,
          "type": "video",
          "video_url": ""
        },
        {
          "id": "l4-4-ub",
          "title": "Análises e resultados",
          "description": "Interprete os KPIs do painel, o funil de conversão e tome decisões baseadas em dados reais.",
          "duration_min": 10,
          "type": "video",
          "video_url": ""
        }
      ]
    }
  ]'::jsonb
)
on conflict (id) do nothing;
