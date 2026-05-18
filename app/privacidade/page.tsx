'use client'

import React from 'react'
import { LegalLayout, TocItem } from '@/components/legal/LegalLayout'

const toc: TocItem[] = [
  { id: 'escopo',           label: '1. Escopo e LGPD' },
  { id: 'controlador',      label: '2. Quem Somos' },
  { id: 'encarregado',      label: '3. Encarregado (DPO)' },
  { id: 'definicoes',       label: '4. Definições' },
  { id: 'dados',            label: '5. Dados que Coletamos' },
  { id: 'fontes',           label: '6. Origem dos Dados' },
  { id: 'sensiveis',        label: '7. Dados Sensíveis' },
  { id: 'criancas',         label: '8. Crianças e Adolescentes' },
  { id: 'finalidades',      label: '9. Finalidades e Bases Legais' },
  { id: 'compartilhamento', label: '10. Compartilhamento' },
  { id: 'cookies',          label: '11. Cookies' },
  { id: 'transferencia',    label: '12. Transferência Internacional' },
  { id: 'seguranca',        label: '13. Segurança' },
  { id: 'incidentes',       label: '14. Incidentes' },
  { id: 'retencao',         label: '15. Retenção de Dados' },
  { id: 'direitos',         label: '16. Direitos do Titular' },
  { id: 'marketing',        label: '17. Marketing e Opt-out' },
  { id: 'exclusoes',        label: '18. Quando Não se Aplica' },
  { id: 'anpd',             label: '19. Reclamação à ANPD' },
  { id: 'alteracoes',       label: '20. Alterações' },
  { id: 'contato-pp',       label: '21. Contato' },
  { id: 'tldr',             label: 'Resumo Rápido' },
]

function Sec({ id, num, title, children }: { id: string; num: number | string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: '72px' }} className="mb-10">
      <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-4 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary text-[12px] font-bold shrink-0">
          {num}
        </span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-text-muted leading-[1.85]">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5 ml-1">{children}</ul>
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] text-text-muted leading-[1.75]">
      <span className="text-primary mt-[5px] shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

function Ph({ t }: { t: string }) {
  return <strong className="text-primary font-semibold">[{t}]</strong>
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-text font-semibold">{children}</strong>
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-warning-soft/30 border border-warning/25 rounded-xl px-4 py-3 text-[13px] text-text leading-relaxed">
      <span className="text-warning shrink-0 text-[15px] mt-px">⚠</span>
      <span>{children}</span>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-primary-soft/30 border border-primary/20 rounded-xl px-4 py-3 text-[13px] text-text leading-relaxed">
      <span className="text-primary shrink-0 text-[15px] mt-px">ℹ</span>
      <span>{children}</span>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-2 border-b border-border">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 font-semibold text-text whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? 'bg-surface-2/40' : ''}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-text-muted align-top leading-[1.65]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DefBox({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl px-4 py-3 flex gap-3 items-start">
      <span className="font-semibold text-text text-[13px] shrink-0 min-w-[120px]">{term}</span>
      <span className="text-[13px] text-text-muted leading-[1.7]">{children}</span>
    </div>
  )
}

function TldrBox() {
  const items = [
    'Coletamos apenas os dados necessários para operar a Plataforma e prestar suporte.',
    'Nunca vendemos seus dados a terceiros.',
    'O Comprador interage com o Bot via Telegram — os dados vêm da API do Telegram e são tratados apenas para entregar o serviço.',
    'Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a qualquer momento.',
    'Guardamos logs por 6 meses (art. 15 MCI); registros fiscais por até 10 anos; demais por 5 anos (prescrição civil).',
    'Usamos cookies somente para sessão e preferências — nunca para rastreamento de terceiros sem consentimento.',
    'Em caso de incidente, notificamos a ANPD e os titulares afetados dentro de 72 horas.',
    'Dúvidas? Fale com nosso Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.',
  ]
  return (
    <section id="tldr" style={{ scrollMarginTop: '72px' }} className="mb-10">
      <div className="rounded-2xl border-2 border-primary/25 bg-primary-soft/20 px-6 py-5">
        <h2 className="text-[16px] font-bold text-text mb-4 flex items-center gap-2">
          <span className="text-primary">⚡</span> Resumo Rápido (TL;DR)
        </h2>
        <ol className="space-y-2.5 list-none">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] text-text-muted leading-[1.75]">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
              <span>{item.includes('<Ph') ? (
                <>
                  Dúvidas? Fale com nosso Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.
                </>
              ) : item}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function PrivacidadePage() {
  return (
    <LegalLayout
      title="Política de Privacidade"
      badge="LGPD"
      lastUpdated="18 de maio de 2026"
      toc={toc}
    >
      <Sec id="escopo" num={1} title="Escopo e Conformidade com a LGPD">
        <P>
          Esta Política de Privacidade descreve como <Ph t="RAZÃO SOCIAL" /> (<Bold>Umbra Bot</Bold>), inscrita
          no CNPJ <Ph t="CNPJ" />, coleta, usa, armazena, compartilha e protege dados pessoais de acordo com
          a <Bold>Lei n.º 13.709/2018 (LGPD)</Bold>, o <Bold>Marco Civil da Internet (Lei n.º 12.965/2014)</Bold> e
          demais normas aplicáveis.
        </P>
        <P>
          Ao criar uma conta, utilizar a Plataforma ou interagir com qualquer Bot criado por meio do Umbra Bot,
          você declara ter lido, compreendido e concordado com esta Política. Se não concordar, interrompa o
          uso imediatamente.
        </P>
        <InfoBox>
          Esta Política aplica-se a: <Bold>(a)</Bold> Usuários (operadores de bots, titulares da conta no
          painel); <Bold>(b)</Bold> Compradores (usuários finais que interagem com bots via Telegram);
          e <Bold>(c)</Bold> visitantes do site e do painel web.
        </InfoBox>
      </Sec>

      <Sec id="controlador" num={2} title="Quem Somos — Controlador dos Dados">
        <P>
          O controlador dos seus dados pessoais é:
        </P>
        <div className="rounded-xl border border-border bg-surface-2 px-5 py-4 space-y-1.5 text-[13.5px]">
          <div className="flex gap-2"><Bold>Razão Social:</Bold> <span className="text-text-muted"><Ph t="RAZÃO SOCIAL" /></span></div>
          <div className="flex gap-2"><Bold>CNPJ:</Bold> <span className="text-text-muted"><Ph t="CNPJ" /></span></div>
          <div className="flex gap-2"><Bold>Endereço:</Bold> <span className="text-text-muted"><Ph t="LOGRADOURO, NÚMERO, BAIRRO" />, <Ph t="CIDADE" />/<Ph t="UF" /> — CEP <Ph t="CEP" /></span></div>
          <div className="flex gap-2"><Bold>E-mail geral:</Bold> <span className="text-text-muted"><Ph t="E-MAIL DE SUPORTE" /></span></div>
        </div>
      </Sec>

      <Sec id="encarregado" num={3} title="Encarregado pelo Tratamento (DPO)">
        <P>
          Nos termos do art. 41 da LGPD, indicamos como Encarregado pelo Tratamento de Dados Pessoais:
        </P>
        <div className="rounded-xl border border-border bg-surface-2 px-5 py-4 space-y-1.5 text-[13.5px]">
          <div className="flex gap-2"><Bold>Nome:</Bold> <span className="text-text-muted"><Ph t="NOME DO ENCARREGADO" /></span></div>
          <div className="flex gap-2"><Bold>E-mail:</Bold> <span className="text-text-muted"><Ph t="E-MAIL DO ENCARREGADO" /></span></div>
        </div>
        <P>
          O Encarregado é o canal oficial para solicitações de titulares, reclamações e comunicações com a
          Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
      </Sec>

      <Sec id="definicoes" num={4} title="Definições (art. 5.º LGPD)">
        <P>Para os fins desta Política, adotam-se as definições da LGPD:</P>
        <div className="space-y-2.5">
          <DefBox term="Dado pessoal">Informação relacionada a pessoa natural identificada ou identificável.</DefBox>
          <DefBox term="Dado sensível">Dado sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, saúde, vida sexual, biometria ou dado de criança/adolescente.</DefBox>
          <DefBox term="Titular">Pessoa natural a quem se referem os dados pessoais.</DefBox>
          <DefBox term="Controlador">Quem decide as finalidades e os meios do tratamento — neste caso, o Umbra Bot.</DefBox>
          <DefBox term="Operador">Quem realiza o tratamento em nome do controlador — ex.: parceiros de infraestrutura.</DefBox>
          <DefBox term="Tratamento">Toda operação com dados pessoais: coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração.</DefBox>
          <DefBox term="Consentimento">Manifestação livre, informada e inequívoca pela qual o titular concorda com o tratamento de seus dados para finalidade determinada.</DefBox>
          <DefBox term="Base legal">Hipótese prevista no art. 7.º ou art. 11 da LGPD que autoriza o tratamento.</DefBox>
          <DefBox term="ANPD">Autoridade Nacional de Proteção de Dados — www.gov.br/anpd.</DefBox>
        </div>
      </Sec>

      <Sec id="dados" num={5} title="Quais Dados Coletamos">
        <P><Bold>5.1 Dados do Usuário (operador do bot):</Bold></P>
        <Ul>
          <Li>Nome completo ou razão social</Li>
          <Li>Endereço de e-mail</Li>
          <Li>Número de telefone (opcional, para suporte)</Li>
          <Li>Dados de faturamento: CPF/CNPJ, endereço de cobrança</Li>
          <Li>Token(s) do Telegram Bot cadastrados pelo usuário</Li>
          <Li>Dados de pagamento processados pelo gateway — o Umbra Bot <Bold>não armazena</Bold> número de cartão nem CVV</Li>
          <Li>Logs de acesso: IP de origem, user-agent, data/hora (art. 15 MCI)</Li>
          <Li>Preferências e configurações da conta</Li>
        </Ul>
        <P><Bold>5.2 Dados do Comprador (usuário final via Telegram):</Bold></P>
        <Ul>
          <Li>Telegram user ID, primeiro nome, sobrenome (se público), username (se público)</Li>
          <Li>Idioma e configurações reportadas pela API do Telegram</Li>
          <Li>Histórico de interação com o bot (mensagens, cliques em botões)</Li>
          <Li>Dados informados voluntariamente no funil (ex.: nome, e-mail, telefone)</Li>
          <Li>Status de compra, valor e gateway utilizado (via webhook do gateway)</Li>
        </Ul>
        <P><Bold>5.3 Dados de navegação (painel web):</Bold></P>
        <Ul>
          <Li>Cookies de sessão e autenticação</Li>
          <Li>Dados de desempenho (carregamento de página, erros — via ferramenta de monitoramento)</Li>
          <Li>Preferência de tema (claro/escuro)</Li>
        </Ul>
        <Warn>
          <Bold>Não coletamos</Bold> dados de localização precisa, biometria, nem dados de saúde. O Umbra Bot
          não lê o conteúdo de conversas privadas que não sejam direcionadas ao bot configurado pelo Usuário.
        </Warn>
      </Sec>

      <Sec id="fontes" num={6} title="De Onde Vêm os Dados">
        <Ul>
          <Li><Bold>Diretamente do titular</Bold> — no cadastro, configuração da conta e interação com o suporte.</Li>
          <Li><Bold>API do Telegram</Bold> — dados do Comprador enviados automaticamente pelo aplicativo Telegram quando o usuário interage com o bot.</Li>
          <Li><Bold>Gateways de pagamento</Bold> — confirmações de compra, chargebacks e reembolsos via webhook.</Li>
          <Li><Bold>Infraestrutura</Bold> — logs gerados pelos servidores durante o uso da Plataforma.</Li>
          <Li><Bold>Cookies e tecnologias similares</Bold> — conforme descrito na Seção 11.</Li>
        </Ul>
      </Sec>

      <Sec id="sensiveis" num={7} title="Dados Pessoais Sensíveis">
        <P>
          Em condições normais de operação, o Umbra Bot <Bold>não coleta nem processa dados pessoais
          sensíveis</Bold> (art. 5.º, II, LGPD), tais como dados de saúde, biometria, origem racial ou étnica,
          convicções religiosas ou políticas.
        </P>
        <P>
          Se um Usuário configurar seu bot de modo que Compradores insiram espontaneamente dados sensíveis,
          o Usuário é responsável por obter o consentimento específico do titular (art. 11, I, LGPD) e por
          comunicar o Umbra Bot para que as medidas de proteção adequadas sejam aplicadas.
        </P>
        <Warn>
          O uso da Plataforma para coletar dados sensíveis sem base legal válida é vedado e pode resultar em
          suspensão imediata da conta.
        </Warn>
      </Sec>

      <Sec id="criancas" num={8} title="Crianças e Adolescentes">
        <P>
          A Plataforma é destinada exclusivamente a pessoas com <Bold>18 (dezoito) anos ou mais</Bold>.
          Não coletamos intencionalmente dados de menores de 18 anos.
        </P>
        <P>
          Caso identificarmos que dados de menores foram coletados sem o consentimento do responsável legal,
          procederemos à eliminação imediata, nos termos do art. 14 da LGPD.
        </P>
        <P>
          Se você é pai, mãe ou responsável e acredita que seu filho forneceu dados à Plataforma,
          entre em contato com nosso Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.
        </P>
      </Sec>

      <Sec id="finalidades" num={9} title="Finalidades e Bases Legais">
        <P>Tratamos dados pessoais com as seguintes finalidades e bases legais (art. 7.º e 11 da LGPD):</P>
        <Table
          headers={['Finalidade', 'Dados envolvidos', 'Base legal (LGPD)']}
          rows={[
            ['Criação e gestão de conta', 'Nome, e-mail, senha (hash)', 'Execução de contrato — art. 7.º, V'],
            ['Autenticação e segurança', 'IP, user-agent, cookies de sessão', 'Legítimo interesse — art. 7.º, IX'],
            ['Processamento de pagamentos', 'Dados de faturamento, CPF/CNPJ', 'Execução de contrato — art. 7.º, V'],
            ['Operação dos bots Telegram', 'Telegram ID, mensagens do bot', 'Execução de contrato — art. 7.º, V'],
            ['Entrega de produtos digitais', 'E-mail, Telegram ID do Comprador', 'Execução de contrato — art. 7.º, V'],
            ['Remarketing e disparos (quando configurado pelo Usuário)', 'Telegram ID, status de compra', 'Consentimento do Comprador — art. 7.º, I'],
            ['Suporte ao cliente', 'Nome, e-mail, histórico de chamados', 'Legítimo interesse — art. 7.º, IX'],
            ['Cumprimento de obrigações legais', 'Dados fiscais, logs de acesso', 'Obrigação legal — art. 7.º, II'],
            ['Prevenção de fraudes', 'IP, padrões de acesso', 'Legítimo interesse — art. 7.º, IX'],
            ['Comunicações de produto (changelog, manutenções)', 'E-mail', 'Legítimo interesse — art. 7.º, IX'],
            ['Marketing (newsletters, promoções)', 'E-mail', 'Consentimento — art. 7.º, I'],
          ]}
        />
        <Warn>
          <Bold>[DECISÃO JURÍDICA — revisar com advogado]:</Bold> as bases legais acima são uma sugestão
          baseada nos casos de uso típicos. Confirme cada base com seu advogado antes de publicar.
        </Warn>
      </Sec>

      <Sec id="compartilhamento" num={10} title="Compartilhamento com Terceiros">
        <P>
          Não vendemos, alugamos nem cedemos dados pessoais a terceiros para fins comerciais próprios desses
          terceiros. Compartilhamos dados apenas nas situações abaixo:
        </P>
        <Ul>
          <Li><Bold>Provedores de infraestrutura</Bold> — hospedagem, banco de dados, CDN, monitoramento (atuam como operadores sob contrato de proteção de dados).</Li>
          <Li><Bold>Gateways de pagamento</Bold> — dados de faturamento necessários para processar a transação.</Li>
          <Li><Bold>Telegram</Bold> — mensagens enviadas pelo bot transitam pela infraestrutura do Telegram conforme os Termos de Serviço do Telegram.</Li>
          <Li><Bold>Autoridades competentes</Bold> — quando exigido por lei, ordem judicial ou regulatório (ex.: ANPD, Receita Federal, Polícia Federal).</Li>
          <Li><Bold>Sucessores empresariais</Bold> — em caso de fusão, aquisição ou reestruturação, mediante aviso prévio de <Ph t="PRAZO" /> dias aos titulares.</Li>
        </Ul>
        <Warn>
          <Bold>[REVISAR COM ADVOGADO]:</Bold> liste aqui todos os subprocessadores/operadores reais
          (ex.: Supabase, Vercel, Stripe/MercadoPago, SendGrid etc.) com seus nomes e localização, e assine
          contratos de Tratamento de Dados (DPA) com cada um deles, conforme exige o art. 39 da LGPD.
        </Warn>
      </Sec>

      <Sec id="cookies" num={11} title="Cookies e Tecnologias Similares">
        <P>Utilizamos cookies e tecnologias equivalentes para as seguintes finalidades:</P>
        <Table
          headers={['Tipo', 'Finalidade', 'Duração']}
          rows={[
            ['Essenciais / Sessão', 'Autenticação, segurança CSRF, preferência de tema', 'Sessão / 30 dias'],
            ['Funcionais', 'Lembrar idioma, estado do painel (sidebar recolhido)', 'até 1 ano'],
            ['Analíticos (se habilitados)', 'Métricas de uso anônimas para melhoria do produto', 'até 2 anos'],
            ['Marketing (se habilitados)', 'Campanhas de performance — somente com consentimento', 'até 2 anos'],
          ]}
        />
        <P>
          Você pode gerenciar ou desabilitar cookies nas configurações do seu navegador. A desativação de
          cookies essenciais pode impedir o funcionamento correto da Plataforma.
        </P>
        <Warn>
          <Bold>[DECISÃO JURÍDICA]:</Bold> se você usar cookies de marketing ou analíticos de terceiros (ex.:
          Google Analytics, Meta Pixel), é obrigatório implementar um banner de consentimento (LGPD + ePrivacy)
          antes de ativá-los. Consulte seu advogado.
        </Warn>
      </Sec>

      <Sec id="transferencia" num={12} title="Transferência Internacional de Dados">
        <P>
          Parte da infraestrutura da Plataforma pode estar localizada fora do Brasil. Quando dados pessoais
          são transferidos para outros países, adotamos as seguintes garantias (art. 33 da LGPD):
        </P>
        <Ul>
          <Li>Cláusulas contratuais padrão de proteção de dados com os fornecedores.</Li>
          <Li>Seleção de provedores localizados em países com nível de proteção adequado reconhecido pela ANPD, sempre que disponível.</Li>
          <Li>Cláusulas específicas de proteção em todos os contratos com operadores internacionais.</Li>
        </Ul>
        <P>
          A lista atualizada dos países para os quais dados podem ser transferidos está disponível mediante
          solicitação ao Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.
        </P>
      </Sec>

      <Sec id="seguranca" num={13} title="Segurança da Informação">
        <P>
          Adotamos medidas técnicas e organizacionais para proteger dados pessoais contra acesso não autorizado,
          destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado:
        </P>
        <Ul>
          <Li>Criptografia em trânsito (TLS 1.2+) e em repouso</Li>
          <Li>Armazenamento de senhas com hashing seguro (bcrypt / argon2)</Li>
          <Li>Controle de acesso baseado em funções (RBAC) com princípio do menor privilégio</Li>
          <Li>Monitoramento contínuo de anomalias e tentativas de invasão</Li>
          <Li>Backups regulares com retenção cifrada</Li>
          <Li>Revisões periódicas de segurança e atualizações de dependências</Li>
          <Li>Autenticação de dois fatores (2FA) disponível para contas de Usuário</Li>
        </Ul>
        <P>
          Nenhum sistema é 100% seguro. Se você identificar uma vulnerabilidade, comunique-nos
          imediatamente em <Ph t="E-MAIL DE DENÚNCIAS" />.
        </P>
      </Sec>

      <Sec id="incidentes" num={14} title="Incidentes de Segurança">
        <P>
          Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
          seguiremos o protocolo abaixo:
        </P>
        <Ul>
          <Li>Contenção imediata e avaliação do impacto nas primeiras horas.</Li>
          <Li>Notificação à <Bold>ANPD</Bold> em prazo razoável, conforme a regulamentação vigente (referência: Resolução CD/ANPD n.º 15/2024).</Li>
          <Li>Comunicação aos <Bold>titulares afetados</Bold> por e-mail ou notificação no painel, descrevendo a natureza do incidente, os dados envolvidos e as medidas tomadas.</Li>
          <Li>Registro interno detalhado do incidente e das ações corretivas adotadas.</Li>
        </Ul>
        <P>
          Para reportar um incidente de segurança: <Ph t="E-MAIL DE DENÚNCIAS" />.
        </P>
      </Sec>

      <Sec id="retencao" num={15} title="Retenção de Dados">
        <P>Retemos dados pessoais pelos prazos necessários para cada finalidade:</P>
        <Table
          headers={['Categoria de dado', 'Prazo de retenção', 'Fundamento']}
          rows={[
            ['Logs de acesso (IP, data/hora)', '6 meses', 'Art. 15 MCI (Lei 12.965/2014)'],
            ['Dados de conta (Usuário ativo)', 'Enquanto a conta estiver ativa', 'Execução do contrato'],
            ['Dados de conta (após encerramento)', 'Até 5 anos', 'Prazo prescricional civil — art. 206 CC'],
            ['Dados fiscais e faturamento', 'Até 10 anos', 'Obrigação tributária — art. 195 CTN'],
            ['Histórico de transações', 'Até 5 anos', 'Prazo prescricional civil'],
            ['Dados de Compradores (interações)', 'Até 5 anos após última interação', 'Legítimo interesse + prazo prescricional'],
            ['Comunicações de suporte', 'Até 3 anos', 'Legítimo interesse'],
            ['Dados de consentimento (opt-in)', 'Enquanto necessário para comprovar o consentimento', 'Art. 7.º, I LGPD'],
          ]}
        />
        <P>
          Findo o prazo aplicável, os dados são eliminados de forma segura ou anonimizados, salvo se houver
          obrigação legal ou judicial de retenção por período maior.
        </P>
      </Sec>

      <Sec id="direitos" num={16} title="Direitos do Titular (art. 18 LGPD)">
        <P>
          Como titular de dados pessoais, você tem os seguintes direitos, que podem ser exercidos a qualquer
          momento pelo canal <Ph t="E-MAIL DO ENCARREGADO" />:
        </P>
        <div className="space-y-2.5">
          <DefBox term="I — Confirmação">Saber se tratamos seus dados pessoais.</DefBox>
          <DefBox term="II — Acesso">Obter cópia dos dados pessoais que mantemos sobre você.</DefBox>
          <DefBox term="III — Correção">Solicitar a atualização ou correção de dados incompletos, inexatos ou desatualizados.</DefBox>
          <DefBox term="IV — Anonimização / Bloqueio / Eliminação">Solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.</DefBox>
          <DefBox term="V — Portabilidade">Solicitar a transmissão dos seus dados a outro fornecedor de serviço, observados os segredos comercial e industrial.</DefBox>
          <DefBox term="VI — Eliminação com consentimento">Solicitar a eliminação de dados tratados com base no consentimento, exceto nos casos previstos no art. 16 da LGPD.</DefBox>
          <DefBox term="VII — Informação sobre compartilhamento">Saber com quais entidades públicas ou privadas compartilhamos seus dados.</DefBox>
          <DefBox term="VIII — Negativa de consentimento">Ser informado sobre a possibilidade de não fornecer consentimento e as consequências da negativa.</DefBox>
          <DefBox term="IX — Revogação do consentimento">Retirar o consentimento a qualquer momento, sem prejuízo da licitude do tratamento realizado anteriormente.</DefBox>
        </div>
        <InfoBox>
          Responderemos às solicitações em até <Bold>15 dias corridos</Bold>. Caso precisemos de mais tempo
          para solicitações complexas, informaremos o motivo e a previsão de conclusão.
        </InfoBox>
      </Sec>

      <Sec id="marketing" num={17} title="Comunicações de Marketing e Opt-out">
        <P>
          Enviamos comunicações de marketing (newsletters, promoções, novidades do produto) somente para
          Usuários que manifestaram consentimento expresso.
        </P>
        <P>
          Para cancelar o recebimento, você pode:
        </P>
        <Ul>
          <Li>Clicar no link de <Bold>"Cancelar inscrição"</Bold> presente em qualquer e-mail marketing.</Li>
          <Li>Ajustar suas preferências em <Bold>Painel → Configurações → Notificações</Bold>.</Li>
          <Li>Enviar solicitação ao Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.</Li>
        </Ul>
        <P>
          Comunicações transacionais (confirmação de compra, alertas de segurança, avisos de manutenção) são
          enviadas independentemente da preferência de marketing, pois são necessárias para a execução do
          contrato.
        </P>
      </Sec>

      <Sec id="exclusoes" num={18} title="Quando Esta Política Não se Aplica">
        <P>Esta Política não se aplica a:</P>
        <Ul>
          <Li>Sites, aplicativos ou serviços de terceiros vinculados por meio de links na Plataforma.</Li>
          <Li>Bots criados por Usuários que possuam Política de Privacidade própria — o Usuário é o controlador das interações com seus Compradores.</Li>
          <Li>Dados tratados exclusivamente pelo Telegram (regidos pelos Termos de Privacidade do Telegram).</Li>
          <Li>Dados anonimizados que não possam identificar uma pessoa natural.</Li>
        </Ul>
        <P>
          O Umbra Bot atua como <Bold>operador</Bold> em relação aos dados de Compradores coletados pelos bots
          dos Usuários, e o <Bold>Usuário é o controlador</Bold> dessas informações, devendo manter sua
          própria Política de Privacidade.
        </P>
      </Sec>

      <Sec id="anpd" num={19} title="Direito de Reclamação à ANPD">
        <P>
          Você tem o direito de apresentar reclamação à <Bold>Autoridade Nacional de Proteção de Dados (ANPD)</Bold>,
          caso considere que o tratamento dos seus dados viola a LGPD:
        </P>
        <div className="rounded-xl border border-border bg-surface-2 px-5 py-4 space-y-1.5 text-[13.5px]">
          <div className="flex gap-2"><Bold>ANPD:</Bold> <span className="text-text-muted">www.gov.br/anpd</span></div>
          <div className="flex gap-2"><Bold>Formulário:</Bold> <span className="text-text-muted">www.gov.br/anpd/pt-br/assuntos/peticoes</span></div>
        </div>
        <P>
          Recomendamos que você entre em contato conosco primeiro, pois a maioria das questões pode ser
          resolvida diretamente. Nosso Encarregado responderá em até 15 dias corridos.
        </P>
      </Sec>

      <Sec id="alteracoes" num={20} title="Alterações desta Política">
        <P>
          Reservamo-nos o direito de atualizar esta Política a qualquer momento. Alterações relevantes serão
          comunicadas com antecedência mínima de <Bold>15 (quinze) dias</Bold> por meio de:
        </P>
        <Ul>
          <Li>Notificação no painel do Usuário.</Li>
          <Li>E-mail para o endereço cadastrado na conta.</Li>
          <Li>Banner de aviso nesta página.</Li>
        </Ul>
        <P>
          O uso continuado da Plataforma após a vigência da nova versão constitui aceitação das alterações.
          Se você não concordar com as mudanças, deverá encerrar sua conta antes da data de entrada em vigor.
        </P>
        <P>
          Versões anteriores desta Política estão disponíveis mediante solicitação ao
          Encarregado: <Ph t="E-MAIL DO ENCARREGADO" />.
        </P>
      </Sec>

      <Sec id="contato-pp" num={21} title="Contato">
        <P>
          Para exercer seus direitos, tirar dúvidas ou reportar qualquer questão relacionada a esta Política,
          entre em contato com:
        </P>
        <div className="rounded-xl border border-border bg-surface-2 px-5 py-4 space-y-2 text-[13.5px]">
          <div className="flex gap-2"><Bold>Encarregado (DPO):</Bold> <span className="text-text-muted"><Ph t="E-MAIL DO ENCARREGADO" /></span></div>
          <div className="flex gap-2"><Bold>Suporte geral:</Bold> <span className="text-text-muted"><Ph t="E-MAIL DE SUPORTE" /></span></div>
          <div className="flex gap-2"><Bold>Suporte Telegram:</Bold> <span className="text-text-muted"><Ph t="LINK DO SUPORTE NO TELEGRAM" /></span></div>
          <div className="flex gap-2"><Bold>Denúncias:</Bold> <span className="text-text-muted"><Ph t="E-MAIL DE DENÚNCIAS" /></span></div>
        </div>
      </Sec>

      <TldrBox />
    </LegalLayout>
  )
}
