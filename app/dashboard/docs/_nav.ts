export interface DocArticle {
  title: string
  slug: string
}

export interface DocSection {
  title: string
  folder: string
  articles: DocArticle[]
}

export const DOC_NAV: DocSection[] = [
  {
    title: 'Começando',
    folder: '01-comecando',
    articles: [
      { title: 'O que é o Umbra Bot', slug: 'introducao' },
      { title: 'Criar sua conta', slug: 'criar-conta' },
      { title: 'Criar e conectar seu primeiro bot', slug: 'primeiro-bot' },
      { title: 'Do zero ao primeiro PIX', slug: 'primeiro-pix' },
    ],
  },
  {
    title: 'Bots',
    folder: '02-bots',
    articles: [
      { title: 'Criar um bot no BotFather', slug: 'como-criar-bot-botfather' },
      { title: 'Conectar o bot ao Umbra Bot', slug: 'conectar-bot-umbra' },
      { title: 'Gerenciar múltiplos bots', slug: 'gerenciar-multiplos-bots' },
      { title: 'Bot desconectado — o que fazer', slug: 'desconectar-bot' },
    ],
  },
  {
    title: 'Financeiro',
    folder: '03-financeiro',
    articles: [
      { title: 'Entender o painel financeiro', slug: 'entender-painel-financeiro' },
      { title: 'Transações — status e detalhes', slug: 'transacoes' },
      { title: 'Solicitar saque', slug: 'solicitar-saque' },
      { title: 'Adicionar conta bancária', slug: 'adicionar-conta-bancaria' },
    ],
  },
  {
    title: 'Clientes',
    folder: '04-clientes',
    articles: [
      { title: 'Entender a lista de clientes', slug: 'entender-lista-clientes' },
      { title: 'Filtrar e ordenar clientes', slug: 'filtrar-clientes' },
      { title: 'Adicionar cliente manualmente', slug: 'adicionar-cliente-manual' },
      { title: 'Importar clientes por planilha', slug: 'importar-clientes-csv' },
    ],
  },
  {
    title: 'Atividade',
    folder: '05-atividade',
    articles: [
      { title: 'O feed de atividade', slug: 'feed-atividade' },
      { title: 'Filtrar o histórico', slug: 'filtros-atividade' },
      { title: 'Exportar histórico', slug: 'exportar-atividade' },
    ],
  },
  {
    title: 'Alertas',
    folder: '06-alertas',
    articles: [
      { title: 'Entender os alertas', slug: 'entender-alertas' },
      { title: 'Resolver e gerenciar alertas', slug: 'resolver-alertas' },
    ],
  },
  {
    title: 'Análises',
    folder: '07-analytics',
    articles: [
      { title: 'Visão geral das análises', slug: 'visao-geral-analytics' },
      { title: 'Entender o funil de conversão', slug: 'funil-conversao' },
      { title: 'Relatórios por bot e produto', slug: 'relatorios-por-bot' },
    ],
  },
  {
    title: 'Afiliados',
    folder: '08-afiliados',
    articles: [
      { title: 'Criar e configurar o programa', slug: 'programa-afiliados' },
      { title: 'Aprovar e gerenciar afiliados', slug: 'aprovar-afiliados' },
      { title: 'Pagar comissões', slug: 'pagar-afiliados' },
    ],
  },
  {
    title: 'Notificações',
    folder: '09-notificacoes',
    articles: [
      { title: 'Configurar notificações', slug: 'configurar-notificacoes' },
    ],
  },
  {
    title: 'Perfil',
    folder: '10-perfil',
    articles: [
      { title: 'Editar seu perfil', slug: 'editar-perfil' },
    ],
  },
  {
    title: 'Fluxos de venda',
    folder: '12-fluxos',
    articles: [
      { title: 'O que é um fluxo de venda',           slug: 'introducao-fluxos' },
      { title: 'Criar seu primeiro fluxo em 5 min',   slug: 'criar-primeiro-fluxo' },
      { title: 'Tipos de nós — o que cada bloco faz', slug: 'tipos-de-nos' },
      { title: 'Variáveis — personalizar mensagens',  slug: 'variaveis' },
      { title: 'Gatilhos — quando o fluxo dispara',   slug: 'triggers-keyword' },
      { title: 'Conectar o fluxo ao bot',             slug: 'conectar-fluxo-bot' },
      { title: 'Templates prontos',                   slug: 'templates' },
      { title: 'Modo de teste',                       slug: 'modo-de-teste' },
      { title: 'Versionamento e rollback',            slug: 'versionamento' },
      { title: 'Atalhos do editor',                   slug: 'atalhos-de-teclado' },
      { title: 'Exportar e importar (JSON)',          slug: 'exportar-importar' },
      { title: 'Debugar um fluxo que não funciona',   slug: 'debugar-fluxo' },
    ],
  },
  {
    title: 'Perguntas frequentes',
    folder: '11-faq',
    articles: [
      { title: 'Perguntas frequentes', slug: 'perguntas-frequentes' },
    ],
  },
]
