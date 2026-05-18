import React from 'react'

/* ─── Shared content primitives ────────────────────────────────── */

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      data-toc-section
      style={{ scrollMarginTop: '72px' }}
      className="text-[18px] font-semibold text-text mt-8 mb-3 pb-2 border-b border-border first:mt-0"
    >
      {children}
    </h2>
  )
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-text-muted leading-[1.8] mb-3">{children}</p>
}
export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5 mb-4 ml-1">{children}</ul>
}
export function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] text-text-muted leading-[1.7]">
      <span className="text-primary mt-[5px] shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14px] text-text-muted leading-[1.7]">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-primary-soft/30 border border-primary/20 rounded-xl px-4 py-3 text-[13px] text-text my-4 leading-relaxed">
      <span className="text-primary shrink-0 mt-px">ℹ</span>
      <span>{children}</span>
    </div>
  )
}
export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-warning-soft/30 border border-warning/25 rounded-xl px-4 py-3 text-[13px] text-text my-4 leading-relaxed">
      <span className="text-warning shrink-0 mt-px">⚠</span>
      <span>{children}</span>
    </div>
  )
}
export function Code({ children }: { children: string }) {
  return (
    <pre className="bg-surface-2 border border-border rounded-xl p-4 overflow-x-auto text-[12.5px] text-text font-mono mb-4 leading-relaxed">
      <code>{children}</code>
    </pre>
  )
}
export function Img({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-10 text-text-subtle text-[13px] my-4 gap-1">
      <span className="text-2xl">🖼</span>
      <span>{label}</span>
    </div>
  )
}
export function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-text font-semibold">{children}</strong>
}

/* ─── Types ─────────────────────────────────────────────────────── */

export interface DocsTocItem { id: string; label: string }

export interface DocArticle {
  slug:        string
  title:       string
  description: string
  toc:         DocsTocItem[]
  Content:     React.FC
}

export interface DocCategory {
  slug:        string
  title:       string
  icon:        string
  description: string
  articles:    DocArticle[]
}

/* ─── Categories + Articles ─────────────────────────────────────── */

export const DOCS_CATEGORIES: DocCategory[] = [

  /* ── 1. Primeiros passos ─────────────────────────────────────── */
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    icon: '🚀',
    description: 'Tudo o que você precisa para começar a usar o Umbra Bot.',
    articles: [
      {
        slug: 'visao-geral',
        title: 'Visão geral do painel',
        description: 'Entenda as métricas, o gráfico de faturamento e as seções do dashboard principal.',
        toc: [
          { id: 'intro',    label: 'O que é o painel' },
          { id: 'metricas', label: 'Cards de métricas' },
          { id: 'grafico',  label: 'Gráfico de receita' },
          { id: 'pedidos',  label: 'Pedidos recentes' },
          { id: 'sidebar',  label: 'Menu lateral' },
        ],
        Content: () => (
          <>
            <H2 id="intro">O que é o painel</H2>
            <P>
              Ao fazer login, você cai direto no <Bold>Dashboard</Bold> — a tela central com um resumo de tudo que
              acontece na sua operação: faturamento, leads, vendas e bots ativos.
            </P>
            <Img label="Screenshot do Dashboard principal" />

            <H2 id="metricas">Cards de métricas</H2>
            <P>Na parte superior há quatro cards de resumo:</P>
            <Ul>
              <Li><Bold>Receita total</Bold> — soma de todas as vendas confirmadas no período selecionado.</Li>
              <Li><Bold>Novos leads</Bold> — contatos que iniciaram conversa com algum bot pela primeira vez.</Li>
              <Li><Bold>Vendas</Bold> — quantidade de transações aprovadas.</Li>
              <Li><Bold>Bots ativos</Bold> — número de bots com status "online".</Li>
            </Ul>
            <Note>
              Use o seletor de período (7 dias / 30 dias / 90 dias) no canto superior direito para filtrar todas
              as métricas ao mesmo tempo.
            </Note>

            <H2 id="grafico">Gráfico de receita</H2>
            <P>
              O gráfico de área exibe a evolução da receita ao longo do período selecionado. Passe o mouse
              sobre qualquer ponto para ver o valor exato daquele dia. O eixo Y escala automaticamente de
              acordo com o maior valor do intervalo.
            </P>

            <H2 id="pedidos">Pedidos recentes</H2>
            <P>
              A tabela inferior lista as últimas transações com: código do pedido, cliente, bot de origem,
              valor, taxa do gateway, valor líquido e status (Aprovado / Pendente / Reembolsado / Estornado).
            </P>

            <H2 id="sidebar">Menu lateral</H2>
            <P>
              A barra lateral esquerda organiza todas as seções da plataforma em grupos colapsáveis:
              <Bold> Automações</Bold>, <Bold>Integrações</Bold> e <Bold>Configurações</Bold>. Clique no
              chevron para recolher/expandir cada grupo. No desktop, o botão de recolher lateral (&lt; / &gt;)
              minimiza o menu para ícones apenas, ampliando a área de trabalho.
            </P>
          </>
        ),
      },
      {
        slug: 'criar-conta',
        title: 'Criar conta',
        description: 'Como se cadastrar e configurar sua conta no Umbra Bot.',
        toc: [
          { id: 'cadastro',     label: 'Cadastro' },
          { id: 'primeiro-bot', label: 'Primeiro bot' },
          { id: 'plano',        label: 'Plano e cobranças' },
        ],
        Content: () => (
          <>
            <Warn>
              O sistema de autenticação está em desenvolvimento. Esta documentação descreve o fluxo previsto —
              a tela de cadastro real será disponibilizada em breve.
            </Warn>
            <H2 id="cadastro">Cadastro</H2>
            <Steps items={[
              'Acesse o site do Umbra Bot e clique em "Criar conta grátis".',
              'Preencha nome, e-mail e senha (mínimo 8 caracteres).',
              'Confirme seu e-mail clicando no link enviado para a caixa de entrada.',
              'Você será redirecionado automaticamente para o painel.',
            ]} />

            <H2 id="primeiro-bot">Primeiro bot</H2>
            <P>
              Após o cadastro, o assistente de onboarding sugere conectar seu primeiro bot do Telegram.
              Consulte o artigo <Bold>Conectar um bot</Bold> na categoria Bots para o passo a passo completo.
            </P>

            <H2 id="plano">Plano e cobranças</H2>
            <P>
              O Umbra Bot não cobra mensalidade. Você paga apenas uma taxa por venda processada —
              consulte a página de <Bold>Preços</Bold> no site para o valor atualizado.
              Não há limite de bots, leads ou clientes.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 2. Bots ─────────────────────────────────────────────────── */
  {
    slug: 'bots',
    title: 'Bots',
    icon: '🤖',
    description: 'Conecte e gerencie seus bots do Telegram.',
    articles: [
      {
        slug: 'conectar-bot',
        title: 'Conectar um bot',
        description: 'Como criar um bot no BotFather e conectá-lo ao Umbra Bot usando o token de API.',
        toc: [
          { id: 'botfather', label: 'Criar no BotFather' },
          { id: 'token',     label: 'Copiar o token' },
          { id: 'conectar',  label: 'Conectar no painel' },
          { id: 'status',    label: 'Verificar status' },
        ],
        Content: () => (
          <>
            <H2 id="botfather">Criar um bot no BotFather</H2>
            <Steps items={[
              <>Abra o Telegram e busque por <Bold>@BotFather</Bold> (conta oficial verificada com ✓).</>,
              <>Envie o comando <Bold>/newbot</Bold>.</>,
              'Escolha um nome de exibição (ex.: "Loja do João").',
              <>Escolha um username terminando em <Bold>bot</Bold> (ex.: "lojajoao_bot"). Deve ser único no Telegram.</>,
              'O BotFather confirmará e exibirá o token de API.',
            ]} />
            <Img label="Screenshot do BotFather com token gerado" />

            <H2 id="token">Copiar o token</H2>
            <P>
              O token tem o formato <Bold>123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw</Bold>. Copie o
              valor completo — ele é necessário para conectar o bot ao Umbra Bot.
            </P>
            <Warn>
              Nunca compartilhe o token do bot publicamente. Qualquer pessoa com o token pode controlar
              o bot. Se vazar, gere um novo token no BotFather com <Bold>/revoke</Bold>.
            </Warn>

            <H2 id="conectar">Conectar no painel</H2>
            <Steps items={[
              <>No painel, acesse <Bold>Automações → Gerenciar bots</Bold>.</>,
              <>Clique em <Bold>"+ Novo bot"</Bold>.</>,
              'Cole o token copiado do BotFather no campo "Token de API".',
              <>O Umbra Bot validará o token e preencherá automaticamente o nome de usuário e a foto do bot.</>,
              <>Clique em <Bold>"Salvar"</Bold>. O bot aparecerá na listagem com status <Bold>"Online"</Bold>.</>,
            ]} />

            <H2 id="status">Verificar o status</H2>
            <P>
              Na tela de Gerenciar bots, cada card exibe: nome do bot, @username, status
              (Online / Offline), número de leads, vendas realizadas e data da última atividade.
              Use o botão de ação (⋯) para editar, desativar ou remover o bot.
            </P>
          </>
        ),
      },
      {
        slug: 'gerenciar-bots',
        title: 'Gerenciar bots',
        description: 'Visualize, edite e monitore todos os bots conectados à sua conta.',
        toc: [
          { id: 'listagem', label: 'Listagem e busca' },
          { id: 'acoes',    label: 'Ações disponíveis' },
          { id: 'metricas', label: 'Métricas por bot' },
        ],
        Content: () => (
          <>
            <H2 id="listagem">Listagem e busca</H2>
            <P>
              A tela <Bold>Gerenciar bots</Bold> exibe todos os bots em um grid de cards. Use a barra
              de busca no topo para filtrar por nome ou @username. O seletor de status
              (Todos / Online / Offline) filtra adicionalmente pela disponibilidade.
            </P>

            <H2 id="acoes">Ações disponíveis</H2>
            <Ul>
              <Li><Bold>Editar</Bold> — altera o nome de exibição e as configurações do bot.</Li>
              <Li><Bold>Ativar / Desativar</Bold> — pausa o bot sem desconectar o token.</Li>
              <Li><Bold>Remover</Bold> — desconecta o bot permanentemente da plataforma. O bot permanece no Telegram.</Li>
              <Li><Bold>Ver detalhes</Bold> — abre o painel de métricas daquele bot.</Li>
            </Ul>

            <H2 id="metricas">Métricas por bot</H2>
            <P>
              Cada card exibe: número de leads captados, total de vendas, data/hora da última
              interação e o status de conexão em tempo real. Bots offline exibem o motivo
              da desconexão (token revogado, webhook inativo etc.).
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 3. Fluxos de venda ──────────────────────────────────────── */
  {
    slug: 'fluxos',
    title: 'Fluxos de venda',
    icon: '🔀',
    description: 'Monte funis de venda automatizados com o editor visual.',
    articles: [
      {
        slug: 'editor-de-fluxos',
        title: 'Editor de fluxos',
        description: 'Como criar e editar funis de venda com blocos visuais.',
        toc: [
          { id: 'visao',   label: 'Visão geral' },
          { id: 'blocos',  label: 'Tipos de bloco' },
          { id: 'criar',   label: 'Criar um fluxo' },
          { id: 'ativar',  label: 'Ativar o fluxo' },
        ],
        Content: () => (
          <>
            <H2 id="visao">Visão geral</H2>
            <P>
              A tela <Bold>Fluxos de venda</Bold> lista todos os funis criados. Cada fluxo é associado
              a um bot e define a sequência de mensagens, condições e ofertas que o comprador recebe.
            </P>

            <H2 id="blocos">Tipos de bloco</H2>
            <Ul>
              <Li><Bold>Mensagem</Bold> — texto enviado ao comprador com suporte a variáveis dinâmicas.</Li>
              <Li><Bold>Botões</Bold> — opções clicáveis para o comprador escolher.</Li>
              <Li><Bold>Oferta</Bold> — apresenta um produto com link de pagamento.</Li>
              <Li><Bold>Aguardar</Bold> — pausa o fluxo por um tempo definido (minutos, horas, dias).</Li>
              <Li><Bold>Condição</Bold> — bifurca o fluxo com base em uma ação do comprador (comprou / não comprou).</Li>
              <Li><Bold>Tag</Bold> — aplica uma etiqueta ao lead para segmentação futura.</Li>
            </Ul>

            <H2 id="criar">Criar um fluxo</H2>
            <Steps items={[
              <>Acesse <Bold>Automações → Fluxos de venda</Bold> e clique em <Bold>"+ Novo fluxo"</Bold>.</>,
              'Dê um nome ao fluxo e selecione o bot de origem.',
              'Adicione blocos arrastando-os do painel lateral para a área de trabalho.',
              'Conecte os blocos arrastando a seta de saída de um para a entrada do próximo.',
              <>Clique em <Bold>"Salvar"</Bold> para preservar o rascunho.</>,
            ]} />

            <H2 id="ativar">Ativar o fluxo</H2>
            <P>
              Fluxos salvos ficam no estado <Bold>Rascunho</Bold> até serem ativados. Clique no toggle
              de status no card do fluxo para ativar. Apenas fluxos ativos são executados quando um
              lead inicia a conversa.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 4. Pagamentos e Gateways ───────────────────────────────── */
  {
    slug: 'pagamentos',
    title: 'Pagamentos e Gateways',
    icon: '💳',
    description: 'Conecte gateways de PIX, configure taxas e acompanhe transações.',
    articles: [
      {
        slug: 'conectar-gateway',
        title: 'Conectar um gateway',
        description: 'Como integrar seu gateway de pagamento para receber via PIX.',
        toc: [
          { id: 'gateways',   label: 'Gateways suportados' },
          { id: 'conectar',   label: 'Configurar a integração' },
          { id: 'split',      label: 'Split de comissão' },
          { id: 'financeiro', label: 'Tela Financeiro' },
        ],
        Content: () => (
          <>
            <H2 id="gateways">Gateways suportados</H2>
            <P>
              O Umbra Bot integra com os principais gateways de pagamento brasileiros que processam PIX
              para infoprodutores. A lista atualizada está disponível em{' '}
              <Bold>Integrações → Gateways</Bold> dentro do painel.
            </P>
            <Note>
              [GATEWAYS — preencher a lista real quando as integrações estiverem ativas]
            </Note>

            <H2 id="conectar">Configurar a integração</H2>
            <Steps items={[
              <>Acesse <Bold>Integrações → Gateways</Bold>.</>,
              'Clique no gateway desejado e depois em "Conectar".',
              'Insira as credenciais de API fornecidas pelo gateway (client ID, client secret ou token).',
              <>Clique em <Bold>"Salvar e testar"</Bold> — o sistema validará as credenciais e exibirá "Conectado".</>,
            ]} />

            <H2 id="split">Split de comissão</H2>
            <P>
              Na tela de configuração do gateway você pode definir um percentual de split para
              afiliados. O valor é calculado automaticamente a cada venda aprovada e registrado
              no relatório financeiro.
            </P>

            <H2 id="financeiro">Tela Financeiro</H2>
            <P>
              Em <Bold>Financeiro</Bold> você visualiza: saldo disponível, total de vendas,
              taxa média do gateway e lucro líquido. A tabela de transações lista cada
              venda com valor bruto, taxa cobrada, valor líquido e status.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 5. Remarketing ─────────────────────────────────────────── */
  {
    slug: 'remarketing',
    title: 'Remarketing',
    icon: '📣',
    description: 'Recupere leads e compradores com campanhas automatizadas.',
    articles: [
      {
        slug: 'campanhas',
        title: 'Criar campanhas de remarketing',
        description: 'Configure sequências automáticas ativadas por gatilhos de comportamento.',
        toc: [
          { id: 'visao',      label: 'O que é remarketing' },
          { id: 'gatilhos',   label: 'Gatilhos disponíveis' },
          { id: 'criar',      label: 'Criar uma campanha' },
          { id: 'sequencias', label: 'Sequências de passos' },
        ],
        Content: () => (
          <>
            <H2 id="visao">O que é remarketing</H2>
            <P>
              O módulo de remarketing dispara sequências de mensagens automaticamente com base em
              ações do lead. Por exemplo: um comprador gerou o QR Code mas não pagou — o sistema
              envia uma mensagem de lembrete após 1 hora, outra após 24 horas e uma oferta de
              desconto após 3 dias.
            </P>

            <H2 id="gatilhos">Gatilhos disponíveis</H2>
            <Ul>
              <Li><Bold>PIX gerado mas não pago</Bold> — lead criou o QR Code e não confirmou.</Li>
              <Li><Bold>Compra aprovada</Bold> — pós-venda automático para entregar acesso ou upsell.</Li>
              <Li><Bold>Reembolso solicitado</Bold> — sequência de retenção.</Li>
              <Li><Bold>Carrinho abandonado</Bold> — lead clicou na oferta mas não avançou.</Li>
              <Li><Bold>Lead inativo</Bold> — sem interação há N dias.</Li>
              <Li><Bold>Tag aplicada</Bold> — ativado quando uma etiqueta específica é adicionada ao lead.</Li>
              <Li><Bold>Data especial</Bold> — aniversário ou data programada.</Li>
            </Ul>

            <H2 id="criar">Criar uma campanha</H2>
            <Steps items={[
              <>Acesse <Bold>Automações → Remarketing</Bold> e clique em <Bold>"+ Nova campanha"</Bold>.</>,
              'Dê um nome, selecione o bot e o público-alvo (todos os leads / segmento específico).',
              'Escolha o gatilho que ativará a campanha.',
              'Adicione os passos da sequência (mensagens e delays).',
              <>Clique em <Bold>"Ativar"</Bold> para colocar a campanha em produção.</>,
            ]} />

            <H2 id="sequencias">Sequências de passos</H2>
            <P>
              Cada passo pode ser uma <Bold>mensagem de texto</Bold> (com variáveis como {'{{nome}}'},{' '}
              {'{{produto}}'}) ou um <Bold>delay</Bold> (aguardar X minutos/horas/dias antes do próximo
              passo). A pré-visualização lateral exibe como as mensagens aparecerão no Telegram.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 6. Disparador ──────────────────────────────────────────── */
  {
    slug: 'disparador',
    title: 'Disparador',
    icon: '📤',
    description: 'Envie mensagens em massa para segmentos da sua base.',
    articles: [
      {
        slug: 'envios',
        title: 'Envios em massa',
        description: 'Como criar e agendar disparos para toda a base ou segmentos específicos.',
        toc: [
          { id: 'visao',   label: 'Como funciona' },
          { id: 'criar',   label: 'Criar um disparo' },
          { id: 'publico', label: 'Segmentação de público' },
          { id: 'agend',   label: 'Agendamento' },
        ],
        Content: () => (
          <>
            <H2 id="visao">Como funciona</H2>
            <P>
              O Disparador (<Bold>Broadcasts</Bold>) permite enviar uma mensagem para múltiplos contatos
              de uma só vez. Você escolhe o bot, define o público (todos ou um segmento) e compõe
              a mensagem. O sistema envia progressivamente para respeitar os limites do Telegram.
            </P>

            <H2 id="criar">Criar um disparo</H2>
            <Steps items={[
              <>Acesse <Bold>Automações → Disparador</Bold> e clique em <Bold>"+ Novo disparo"</Bold>.</>,
              'Selecione o bot remetente.',
              'Escreva a mensagem. Use variáveis como <strong>{{nome}}</strong> para personalizar.',
              'Defina o público-alvo e, opcionalmente, um agendamento.',
              <>Clique em <Bold>"Enviar agora"</Bold> ou <Bold>"Agendar"</Bold>.</>,
            ]} />

            <H2 id="publico">Segmentação de público</H2>
            <Ul>
              <Li><Bold>Todos os leads</Bold> — todos os contatos do bot selecionado.</Li>
              <Li><Bold>Por tag</Bold> — apenas leads com uma etiqueta específica.</Li>
              <Li><Bold>Compradores</Bold> — somente quem já realizou uma compra.</Li>
              <Li><Bold>Não compradores</Bold> — leads que ainda não converteram.</Li>
            </Ul>

            <H2 id="agend">Agendamento</H2>
            <P>
              Ative a opção "Agendar para depois" e selecione data e hora. O disparo ficará com
              status <Bold>Agendado</Bold> e será executado automaticamente no horário definido.
              É possível cancelar um disparo agendado antes da hora de execução.
            </P>
            <Warn>
              Respeite as boas práticas do Telegram para evitar que o bot seja bloqueado pelos
              usuários. Não envie mensagens para contatos que nunca interagiram com seu bot.
            </Warn>
          </>
        ),
      },
    ],
  },

  /* ── 7. Clientes ────────────────────────────────────────────── */
  {
    slug: 'clientes',
    title: 'Clientes',
    icon: '👥',
    description: 'CRM de leads e compradores.',
    articles: [
      {
        slug: 'crm',
        title: 'Gerenciar clientes',
        description: 'Veja, filtre e gerencie todos os leads e compradores da sua base.',
        toc: [
          { id: 'listagem', label: 'Listagem' },
          { id: 'filtros',  label: 'Filtros e busca' },
          { id: 'perfil',   label: 'Perfil do cliente' },
        ],
        Content: () => (
          <>
            <H2 id="listagem">Listagem</H2>
            <P>
              A tela <Bold>Clientes</Bold> exibe todos os contatos que já interagiram com algum bot
              da sua conta. Para cada contato são mostrados: nome, @username do Telegram, data do
              primeiro contato, bot de origem e status de compra.
            </P>

            <H2 id="filtros">Filtros e busca</H2>
            <Ul>
              <Li><Bold>Busca por nome</Bold> — filtra pelo nome ou username do lead.</Li>
              <Li><Bold>Status</Bold> — Todos / Compradores / Não compradores.</Li>
              <Li><Bold>Tag</Bold> — filtra por etiqueta aplicada.</Li>
              <Li><Bold>Bot</Bold> — mostra apenas leads de um bot específico.</Li>
              <Li><Bold>Período</Bold> — leads captados em um intervalo de datas.</Li>
            </Ul>

            <H2 id="perfil">Perfil do cliente</H2>
            <P>
              Clique em um contato para ver o perfil completo: histórico de compras, tags aplicadas,
              bot de origem e data de cada interação. Você pode adicionar ou remover tags diretamente
              nessa tela.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 8. Afiliados ───────────────────────────────────────────── */
  {
    slug: 'afiliados',
    title: 'Afiliados',
    icon: '🤝',
    description: 'Gerencie afiliados e acompanhe comissões.',
    articles: [
      {
        slug: 'programa',
        title: 'Programa de afiliados',
        description: 'Como cadastrar afiliados e acompanhar suas comissões.',
        toc: [
          { id: 'visao',     label: 'Visão geral' },
          { id: 'cadastro',  label: 'Cadastrar afiliado' },
          { id: 'comissoes', label: 'Comissões' },
        ],
        Content: () => (
          <>
            <H2 id="visao">Visão geral</H2>
            <P>
              O módulo de afiliados permite cadastrar parceiros que indicam vendas dos seus produtos.
              Para cada venda realizada por um link de afiliado, a comissão configurada é registrada
              automaticamente.
            </P>

            <H2 id="cadastro">Cadastrar um afiliado</H2>
            <Steps items={[
              <>Acesse <Bold>Afiliados</Bold> e clique em <Bold>"+ Novo afiliado"</Bold>.</>,
              'Informe nome e e-mail do afiliado.',
              'Defina o percentual de comissão.',
              <>O sistema gera um link de rastreamento único para o afiliado.</>,
            ]} />

            <H2 id="comissoes">Comissões</H2>
            <P>
              As comissões são calculadas automaticamente a cada venda aprovada via link de afiliado.
              A tela lista cada afiliado com total de indicações, vendas convertidas e valor acumulado
              de comissão.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 9. Redirecionadores ────────────────────────────────────── */
  {
    slug: 'redirecionadores',
    title: 'Redirecionadores',
    icon: '🔗',
    description: 'Links curtos com rastreamento de cliques.',
    articles: [
      {
        slug: 'criar',
        title: 'Criar redirecionadores',
        description: 'Crie links curtos que rastreiam cliques e conversões.',
        toc: [
          { id: 'criar',  label: 'Criar link' },
          { id: 'dados',  label: 'Dados de acesso' },
        ],
        Content: () => (
          <>
            <H2 id="criar">Criar um redirecionador</H2>
            <Steps items={[
              <>Acesse <Bold>Automações → Redirecionadores</Bold> e clique em <Bold>"+ Novo"</Bold>.</>,
              'Cole a URL de destino (ex.: link de um produto ou grupo VIP).',
              'Defina um apelido (slug) para o link curto.',
              <>O sistema gera o link no formato <Bold>umbra.bot/r/apelido</Bold>.</>,
            ]} />

            <H2 id="dados">Dados de acesso</H2>
            <P>
              Para cada redirecionador são registrados: total de cliques, cliques únicos,
              origem (UTM source) e conversões vinculadas. O gráfico de barras exibe a
              evolução de cliques ao longo do tempo.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 10. Trackeamento ───────────────────────────────────────── */
  {
    slug: 'trackeamento',
    title: 'Trackeamento',
    icon: '📡',
    description: 'Pixels de conversão e parâmetros UTM.',
    articles: [
      {
        slug: 'pixels',
        title: 'Configurar pixels',
        description: 'Integre pixels de rastreamento e parâmetros UTM às suas campanhas.',
        toc: [
          { id: 'pixels', label: 'Tipos de pixel' },
          { id: 'utm',    label: 'Parâmetros UTM' },
          { id: 'evento', label: 'Eventos disparados' },
        ],
        Content: () => (
          <>
            <H2 id="pixels">Tipos de pixel suportados</H2>
            <P>
              Na tela <Bold>Trackeamento</Bold> você configura os pixels de conversão para medir
              o desempenho das suas campanhas pagas. Os tipos de pixel disponíveis estão listados
              em <Bold>Integrações → Trackeamento</Bold> no painel.
            </P>
            <Note>[PIXELS — listar os pixels reais quando as integrações estiverem ativas]</Note>

            <H2 id="utm">Parâmetros UTM</H2>
            <P>
              Adicione parâmetros UTM nos links de entrada para identificar a origem de cada lead.
              O painel registra <Bold>utm_source</Bold>, <Bold>utm_medium</Bold> e{' '}
              <Bold>utm_campaign</Bold> por lead automaticamente quando o link é clicado.
            </P>

            <H2 id="evento">Eventos disparados</H2>
            <Ul>
              <Li><Bold>Lead captado</Bold> — disparado quando o lead inicia o bot pela primeira vez.</Li>
              <Li><Bold>Compra iniciada</Bold> — quando o PIX é gerado.</Li>
              <Li><Bold>Compra confirmada</Bold> — quando o pagamento é aprovado.</Li>
            </Ul>
          </>
        ),
      },
    ],
  },

  /* ── 11. Checkout ───────────────────────────────────────────── */
  {
    slug: 'checkout',
    title: 'Checkout',
    icon: '🛒',
    description: 'Páginas de checkout personalizadas para seus produtos.',
    articles: [
      {
        slug: 'editor',
        title: 'Editor de checkout',
        description: 'Crie páginas de venda personalizadas com o editor visual.',
        toc: [
          { id: 'criar', label: 'Criar checkout' },
          { id: 'pub',   label: 'Publicar' },
        ],
        Content: () => (
          <>
            <H2 id="criar">Criar um checkout</H2>
            <Steps items={[
              <>Acesse <Bold>Integrações → Checkout</Bold> e clique em <Bold>"+ Novo checkout"</Bold>.</>,
              'Defina nome, produto, preço e gateway de pagamento.',
              'Personalize o visual: cores, logo, texto do botão e campos de formulário.',
              <>Use a aba <Bold>Pré-visualizar</Bold> para ver como o comprador verá a página.</>,
            ]} />

            <H2 id="pub">Publicar</H2>
            <P>
              Após salvar, o checkout recebe uma URL única. Compartilhe esse link nas suas campanhas
              ou incorpore em um site. Checkouts publicados ficam acessíveis 24/7.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 12. Bio Link ───────────────────────────────────────────── */
  {
    slug: 'biolink',
    title: 'Bio Link',
    icon: '🔖',
    description: 'Crie uma página de bio link com todos os seus links.',
    articles: [
      {
        slug: 'configurar',
        title: 'Configurar Bio Link',
        description: 'Monte uma página de links simples para usar na bio do Instagram ou Telegram.',
        toc: [
          { id: 'editar', label: 'Editar página' },
          { id: 'pub',    label: 'Publicar e compartilhar' },
        ],
        Content: () => (
          <>
            <H2 id="editar">Editar a página</H2>
            <P>
              Em <Bold>Integrações → Bio Link</Bold> você edita sua página de links: foto de perfil,
              nome, descrição e a lista de links (com ícone, título e URL de destino). Arraste os
              itens para reordenar.
            </P>

            <H2 id="pub">Publicar e compartilhar</H2>
            <P>
              Clique em <Bold>"Publicar"</Bold> para gerar a URL pública da sua página de bio link.
              Use essa URL na bio do Instagram, Telegram ou qualquer outra plataforma. Cada clique
              em um link é registrado para análise.
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 13. Webhooks ───────────────────────────────────────────── */
  {
    slug: 'webhooks',
    title: 'Webhooks',
    icon: '🔌',
    description: 'Receba notificações de eventos em sistemas externos.',
    articles: [
      {
        slug: 'configurar',
        title: 'Configurar webhooks',
        description: 'Como cadastrar endpoints e os eventos disponíveis.',
        toc: [
          { id: 'criar',    label: 'Criar endpoint' },
          { id: 'eventos',  label: 'Eventos disponíveis' },
          { id: 'payload',  label: 'Exemplo de payload' },
        ],
        Content: () => (
          <>
            <H2 id="criar">Criar um endpoint</H2>
            <Steps items={[
              <>Acesse <Bold>Integrações → Webhooks</Bold> e clique em <Bold>"+ Novo webhook"</Bold>.</>,
              'Cole a URL do seu servidor que receberá as notificações.',
              'Selecione os eventos que deseja receber.',
              <>Clique em <Bold>"Salvar"</Bold>. O Umbra Bot enviará um evento de teste imediatamente.</>,
            ]} />

            <H2 id="eventos">Eventos disponíveis</H2>
            <Ul>
              <Li><Bold>lead.created</Bold> — novo lead captado.</Li>
              <Li><Bold>payment.approved</Bold> — pagamento confirmado.</Li>
              <Li><Bold>payment.refunded</Bold> — reembolso processado.</Li>
              <Li><Bold>bot.disconnected</Bold> — bot saiu do ar.</Li>
            </Ul>

            <H2 id="payload">Exemplo de payload</H2>
            <Code>{`{
  "event":      "payment.approved",
  "created_at": "2026-05-18T14:32:00Z",
  "data": {
    "order_id":  "ord_abc123",
    "amount":    9700,
    "currency":  "BRL",
    "customer": {
      "telegram_id": 123456789,
      "first_name":  "Maria"
    }
  }
}`}</Code>
            <Note>
              O campo <Bold>amount</Bold> é expresso em centavos (R$ 97,00 = 9700).
            </Note>
          </>
        ),
      },
    ],
  },

  /* ── 14. Conta e configurações ──────────────────────────────── */
  {
    slug: 'conta',
    title: 'Conta e configurações',
    icon: '⚙️',
    description: 'Gerencie seu perfil, senha e preferências de notificação.',
    articles: [
      {
        slug: 'perfil',
        title: 'Editar perfil',
        description: 'Atualize seus dados pessoais, foto e senha.',
        toc: [
          { id: 'dados', label: 'Dados pessoais' },
          { id: 'senha', label: 'Alterar senha' },
          { id: '2fa',   label: 'Autenticação em 2 fatores' },
        ],
        Content: () => (
          <>
            <H2 id="dados">Dados pessoais</H2>
            <P>
              Em <Bold>Configurações → Perfil</Bold> você atualiza: nome de exibição, e-mail,
              telefone e foto de perfil (upload de imagem PNG/JPG até 2 MB).
            </P>

            <H2 id="senha">Alterar senha</H2>
            <Steps items={[
              'Clique em "Alterar senha" na seção Segurança.',
              'Digite a senha atual para confirmar sua identidade.',
              'Digite a nova senha (mínimo 8 caracteres).',
              'Confirme a nova senha e clique em "Salvar".',
            ]} />

            <H2 id="2fa">Autenticação em 2 fatores</H2>
            <P>
              A tela de perfil exibe a opção de ativar 2FA via aplicativo autenticador (TOTP).
              Siga as instruções do QR Code exibido e confirme com o código gerado pelo app.
            </P>
          </>
        ),
      },
      {
        slug: 'notificacoes',
        title: 'Notificações',
        description: 'Configure quais alertas você deseja receber e por qual canal.',
        toc: [
          { id: 'tipos',   label: 'Tipos de notificação' },
          { id: 'canais',  label: 'Canais de entrega' },
        ],
        Content: () => (
          <>
            <H2 id="tipos">Tipos de notificação</H2>
            <Ul>
              <Li><Bold>Nova venda</Bold> — aviso a cada pagamento aprovado.</Li>
              <Li><Bold>Novo lead</Bold> — quando um novo contato inicia o bot.</Li>
              <Li><Bold>Reembolso</Bold> — pagamento devolvido ao comprador.</Li>
              <Li><Bold>Bot offline</Bold> — bot desconectado da plataforma.</Li>
              <Li><Bold>Alertas de limite</Bold> — avisos de taxa acima do esperado.</Li>
            </Ul>

            <H2 id="canais">Canais de entrega</H2>
            <P>
              Em <Bold>Configurações → Notificações</Bold> você ativa ou desativa cada tipo de
              notificação individualmente. Os canais disponíveis são: notificação no painel e,
              opcionalmente, via Telegram (para sua conta pessoal).
            </P>
          </>
        ),
      },
    ],
  },

  /* ── 15. FAQ ────────────────────────────────────────────────── */
  {
    slug: 'faq',
    title: 'FAQ',
    icon: '❓',
    description: 'Perguntas frequentes e solução de problemas comuns.',
    articles: [
      {
        slug: 'faq',
        title: 'Perguntas frequentes',
        description: 'Respostas para as dúvidas mais comuns sobre a plataforma.',
        toc: [
          { id: 'bot-offline',  label: 'Bot aparece offline' },
          { id: 'sem-webhook',  label: 'Webhook não disparando' },
          { id: 'taxa',         label: 'Qual a taxa por venda?' },
          { id: 'limite',       label: 'Limite de bots/leads?' },
          { id: 'suporte',      label: 'Como falar com suporte?' },
        ],
        Content: () => (
          <>
            <H2 id="bot-offline">Bot aparece offline, o que fazer?</H2>
            <Steps items={[
              <>Verifique se o token inserido está correto em <Bold>Gerenciar bots → Editar</Bold>.</>,
              'Acesse o BotFather e confirme que o token não foi revogado.',
              <>Se o token foi revogado, gere um novo com <Bold>/revoke</Bold> e atualize no painel.</>,
              'Aguarde até 60 segundos após salvar para o status atualizar.',
            ]} />

            <H2 id="sem-webhook">Webhook não está disparando</H2>
            <Steps items={[
              'Verifique se o endpoint cadastrado em Webhooks responde com HTTP 200.',
              'Confirme que o evento desejado está selecionado na configuração do webhook.',
              <>Use o botão <Bold>"Testar"</Bold> no painel para enviar um evento de teste manualmente.</>,
              'Verifique os logs de entrega na mesma tela — são exibidos os últimos 50 disparos.',
            ]} />

            <H2 id="taxa">Qual é a taxa por venda?</H2>
            <P>
              A taxa atualizada está na página de <Bold>Preços</Bold> do site. O Umbra Bot não
              cobra mensalidade — o único custo é a taxa percentual por venda aprovada.
            </P>

            <H2 id="limite">Existe limite de bots ou leads?</H2>
            <P>
              Não. Você pode conectar quantos bots quiser e captар qualquer quantidade de leads.
              Não há plano com limitação de contatos ou automações.
            </P>

            <H2 id="suporte">Como falar com o suporte?</H2>
            <P>
              Acesse a página de <Bold>Contato</Bold> para ver todos os canais disponíveis: suporte
              via Telegram (resposta em até 4 horas) e e-mail (até 2 dias úteis).
            </P>
          </>
        ),
      },
    ],
  },
]

/* ─── Helpers ───────────────────────────────────────────────────── */

export function findArticle(category: string, slug: string) {
  const cat = DOCS_CATEGORIES.find((c) => c.slug === category)
  if (!cat) return null
  const art = cat.articles.find((a) => a.slug === slug)
  if (!art) return null
  return { cat, art }
}

export function toMeta(categories: DocCategory[]) {
  return categories.map((c) => ({
    slug:     c.slug,
    title:    c.title,
    icon:     c.icon,
    articles: c.articles.map((a) => ({ slug: a.slug, title: a.title })),
  }))
}
