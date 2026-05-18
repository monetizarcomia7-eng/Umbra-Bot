'use client'

import React from 'react'
import { LegalLayout, TocItem } from '@/components/legal/LegalLayout'

/* ── TOC ────────────────────────────────────────────────────── */

const TOC: TocItem[] = [
  { id: 'definicoes',      label: '1. Definições' },
  { id: 'natureza',        label: '2. Natureza do Serviço' },
  { id: 'cadastro',        label: '3. Cadastro e Elegibilidade' },
  { id: 'precos',          label: '4. Preços e Taxas' },
  { id: 'obrigacoes',      label: '5. Obrigações perante o Comprador' },
  { id: 'arrependimento',  label: '6. Direito de Arrependimento' },
  { id: 'propriedade',     label: '7. Propriedade Intelectual' },
  { id: 'resultados',      label: '8. Não Promessa de Resultados' },
  { id: 'proibidos',       label: '9. Condutas Proibidas' },
  { id: 'denuncias',       label: '10. Denúncias e Remoção' },
  { id: 'responsabilidade',label: '11. Limitação de Responsabilidade' },
  { id: 'indenizacao',     label: '12. Indenização' },
  { id: 'suspensao',       label: '13. Suspensão e Encerramento' },
  { id: 'autoridades',     label: '14. Cooperação com Autoridades' },
  { id: 'conflitos',       label: '15. Resolução Amigável' },
  { id: 'lei',             label: '16. Lei Aplicável e Foro' },
  { id: 'modificacoes',    label: '17. Modificações dos Termos' },
  { id: 'disposicoes',     label: '18. Disposições Gerais' },
  { id: 'tldr',            label: 'TL;DR — Resumo' },
]

/* ── Helpers ────────────────────────────────────────────────── */

function Sec({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: '72px' }} className="mb-12">
      <h2 className="flex items-baseline gap-2 text-[18px] md:text-[20px] font-semibold text-text mb-5 pb-3 border-b border-border">
        <span className="text-[14px] font-normal text-text-subtle shrink-0 tabular-nums">{num}.</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-text-muted leading-[1.85]">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 space-y-2.5 text-[14px] text-text-muted leading-[1.8] marker:text-text-subtle">
      {children}
    </ul>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}

function Ph({ t }: { t: string }) {
  return <strong className="text-primary font-semibold">[{t}]</strong>
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-text font-semibold">{children}</strong>
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-warning-soft/40 border border-warning/30 rounded-xl px-4 py-4 text-[13.5px] text-text leading-relaxed">
      <span className="text-warning text-[18px] shrink-0 leading-none mt-0.5">⚠</span>
      <div>{children}</div>
    </div>
  )
}

function DefBox({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl px-4 py-3.5 bg-surface-2/30">
      <p className="text-[14px] text-text leading-[1.8]">
        <strong className="text-text font-semibold">{term}</strong>{' — '}{children}
      </p>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────── */

export default function TermosPage() {
  return (
    <LegalLayout
      title="Termos de Uso"
      badge="Documento Jurídico"
      lastUpdated="[DATA DE ÚLTIMA ATUALIZAÇÃO]"
      toc={TOC}
    >

      {/* 1 */}
      <Sec id="definicoes" num="1" title="Definições">
        <P>Para os fins destes Termos de Uso, os termos abaixo têm os significados que se seguem, no singular ou no plural:</P>
        <div className="space-y-2.5 mt-2">
          <DefBox term="Plataforma">
            o software Umbra Bot, disponibilizado no modelo Software as a Service (SaaS) por meio do domínio <Ph t="DOMÍNIO DO SITE" />, compreendendo todas as interfaces, APIs, funcionalidades, fluxos automatizados, dashboards e demais componentes disponibilizados ao Usuário.
          </DefBox>
          <DefBox term="Usuário">
            pessoa física com 18 anos completos ou pessoa jurídica, devidamente cadastrada na Plataforma, que a utiliza para configurar bots do Telegram e comercializar seus Produtos de forma automatizada.
          </DefBox>
          <DefBox term="Comprador">
            o consumidor final que adquire o Produto diretamente do Usuário por meio dos bots do Telegram configurados na Plataforma. O Comprador não é parte nestes Termos; sua relação jurídica é exclusivamente com o Usuário.
          </DefBox>
          <DefBox term="Gateway de Pagamento">
            solução de processamento de pagamentos escolhida e contratada de forma autônoma e exclusiva pelo Usuário, sem intervenção da Plataforma, para receber os valores das transações realizadas pelos Compradores.
          </DefBox>
          <DefBox term="Produto">
            qualquer bem digital, curso, e-book, mentoria, assinatura, acesso a grupo ou canal VIP no Telegram, serviço ou outra oferta criada, configurada, precificada e disponibilizada pelo Usuário por meio da Plataforma.
          </DefBox>
          <DefBox term="Split">
            mecanismo técnico pelo qual o Gateway de Pagamento, no ato de aprovação de cada transação, segrega automaticamente e repassa diretamente à Plataforma a taxa devida, sem que esses valores transitem pela custódia da Plataforma ou do Usuário de forma conjunta.
          </DefBox>
          <DefBox term="Termos">
            o presente instrumento e todos os documentos nele incorporados por referência, incluindo a Política de Privacidade e eventuais políticas específicas publicadas na Plataforma.
          </DefBox>
        </div>
      </Sec>

      {/* 2 */}
      <Sec id="natureza" num="2" title="Natureza do Serviço">
        <P><Bold>2.1 Provedora de intermediação técnica.</Bold> A Plataforma atua exclusivamente como provedora de aplicação de internet e de intermediação técnica, nos exatos termos do art. 19 da Lei nº 12.965/2014 (Marco Civil da Internet). A Umbra Bot disponibiliza infraestrutura de software que permite ao Usuário gerenciar bots do Telegram, construir fluxos de venda, segmentar contatos, realizar disparos em massa, configurar programas de afiliados, rastrear conversões e acessar relatórios analíticos. A Plataforma não fabrica, revende, distribui, armazena nem comercializa Produtos.</P>
        <P><Bold>2.2 Ausência de curadoria e moderação prévia.</Bold> A Plataforma não cria, não edita, não modera preventivamente, não monitora de forma proativa, não endossa e não aprova o conteúdo, os Produtos, as ofertas, os preços, as condições comerciais nem as mensagens publicadas, transmitidas ou comercializadas pelo Usuário. A responsabilidade civil, criminal, tributária e consumerista pelo conteúdo e pelos Produtos é exclusiva do Usuário que os criou, publicou ou comercializou, nos termos do art. 19, caput, do Marco Civil da Internet.</P>
        <P><Bold>2.3 Neutralidade de nicho.</Bold> A Plataforma mantém postura de neutralidade técnica em relação ao segmento de mercado do Usuário, desde que este opere em estrita conformidade com a legislação vigente e com estes Termos. Essa neutralidade não implica aprovação, validação, recomendação nem endosso de qualquer Produto, nicho, discurso ou prática comercial.</P>
        <P><Bold>2.4 Gateway de Pagamento — responsabilidade exclusiva do Usuário.</Bold> A escolha, contratação, configuração e manutenção do Gateway de Pagamento são de responsabilidade exclusiva do Usuário. A Plataforma não integra nativamente nenhum Gateway específico, limitando-se a suportar tecnicamente o mecanismo de Split compatível com os Gateways que oferecem tal funcionalidade. A Plataforma não recebe, retém, custodia, movimenta nem possui acesso aos recursos financeiros das vendas; os valores transitam diretamente entre o Comprador, o Gateway de Pagamento e o Usuário.</P>
        <P><Bold>2.5 Isenção quanto a disputas entre Usuário e Comprador.</Bold> Eventuais conflitos entre o Usuário e o Comprador — incluindo, sem limitação, chargebacks, reclamações por produto não entregue, qualidade insatisfatória, reembolsos e litígios no âmbito do Código de Defesa do Consumidor — são de responsabilidade exclusiva do Usuário. A Plataforma não é parte nessas relações e não presta suporte direto ao Comprador.</P>
      </Sec>

      {/* 3 */}
      <Sec id="cadastro" num="3" title="Cadastro e Elegibilidade">
        <P><Bold>3.1 Maioridade.</Bold> O uso da Plataforma é restrito a pessoas físicas com 18 anos completos ou a pessoas jurídicas representadas por seus representantes legais maiores de 18 anos. Ao se cadastrar, o Usuário declara e garante atender a este requisito. É expressamente vedado o cadastro ou o uso da Plataforma por menores de 18 anos.</P>
        <P><Bold>3.2 Conta única.</Bold> Cada titular — pessoa física ou jurídica — pode manter uma única conta ativa. A criação de contas múltiplas para contornar suspensões, limitações ou demais medidas aplicadas pela Plataforma é expressamente vedada e sujeita ao encerramento imediato de todas as contas envolvidas.</P>
        <P><Bold>3.3 Sigilo de credenciais.</Bold> O Usuário é o único responsável pela confidencialidade de suas credenciais de acesso (login, senha e tokens de API). Toda e qualquer ação praticada por meio da conta do Usuário — mesmo que sem sua autorização — é de sua responsabilidade, salvo comunicação formal de acesso não autorizado feita à Plataforma tão logo constatada.</P>
        <P><Bold>3.4 Veracidade das informações.</Bold> O Usuário compromete-se a fornecer informações verídicas, completas e atualizadas no cadastro e durante toda a vigência da relação contratual. A prestação de informações falsas ou desatualizadas pode ensejar suspensão ou encerramento da conta, sem prejuízo das demais sanções legais aplicáveis.</P>
        <P><Bold>3.5 Verificação de identidade.</Bold> A Plataforma pode, a qualquer tempo, solicitar documentos para verificação da identidade do Usuário ou da autenticidade das informações fornecidas. A recusa injustificada em fornecê-los pode resultar em suspensão temporária ou encerramento definitivo da conta.</P>
      </Sec>

      {/* 4 */}
      <Sec id="precos" num="4" title="Preços e Taxas">
        <P><Bold>4.1 Modelo de cobrança por transação.</Bold> A Plataforma adota modelo de cobrança exclusivamente por venda concluída e aprovada pelo Gateway de Pagamento, sem mensalidade fixa, sem taxa de cadastro e sem cobrança durante períodos sem vendas.</P>
        <P><Bold>4.2 Valor da taxa.</Bold> A taxa vigente é de <Ph t="TAXA POR VENDA" /> sobre o valor bruto de cada transação aprovada. A Plataforma se reserva o direito de alterá-la mediante aviso prévio mínimo de 30 (trinta) dias, nos termos da Cláusula 17.</P>
        <P><Bold>4.3 Mecanismo de Split.</Bold> A cobrança da taxa é operacionalizada por meio do Split configurado pelo Usuário no Gateway de Pagamento. O Split é executado automaticamente pelo Gateway no momento de aprovação de cada transação, sem intervenção da Plataforma no fluxo financeiro.</P>
        <P><Bold>4.4 Não custódia de valores.</Bold> A Plataforma não recebe, custodia, retém nem movimenta valores oriundos das vendas do Usuário. Os fundos transitam diretamente entre o Comprador, o Gateway de Pagamento e o Usuário, conforme os prazos de repasse definidos pelo próprio Gateway, pelos quais a Plataforma não se responsabiliza.</P>
        <P><Bold>4.5 Impostos sobre as vendas do Usuário.</Bold> Todos os tributos incidentes sobre os valores recebidos pelo Usuário em razão de suas vendas são de sua exclusiva responsabilidade. A Plataforma não atua como substituta tributária do Usuário em nenhuma hipótese.</P>
      </Sec>

      {/* 5 */}
      <Sec id="obrigacoes" num="5" title="Obrigações do Usuário perante o Comprador">
        <P><Bold>5.1 Fornecedor nos termos do CDC.</Bold> Para todos os efeitos do Código de Defesa do Consumidor (Lei nº 8.078/1990), o Usuário é o único fornecedor do Produto ao Comprador. A Plataforma não é parte na relação de consumo e não assume qualquer responsabilidade perante o Comprador.</P>
        <P><Bold>5.2 Obrigações legais do Usuário como fornecedor:</Bold></P>
        <Ul>
          <Li>Entregar o Produto conforme ofertado, no prazo e nas condições anunciadas;</Li>
          <Li>Prestar suporte adequado e em prazo razoável ao Comprador;</Li>
          <Li>Cumprir as garantias legais previstas no CDC;</Li>
          <Li>Exibir preços e condições comerciais de forma clara, sem práticas abusivas;</Li>
          <Li>Emitir nota fiscal ou documento fiscal equivalente, quando exigido pela legislação;</Li>
          <Li>Recolher, declarar e repassar todos os tributos incidentes sobre a operação comercial;</Li>
          <Li>Respeitar e fazer cumprir todos os direitos do consumidor previstos no CDC e na legislação correlata;</Li>
          <Li>Não realizar publicidade enganosa ou abusiva ao Comprador.</Li>
        </Ul>
        <P><Bold>5.3 Suporte ao Comprador.</Bold> A Plataforma não oferece suporte técnico nem de atendimento ao Comprador. Todo o atendimento pós-venda é de responsabilidade exclusiva do Usuário.</P>
        <P><Bold>5.4 Chargebacks e reembolsos.</Bold> Chargebacks, estornos, reembolsos e disputas financeiras iniciados pelo Comprador junto ao Gateway de Pagamento ou à operadora de cartão são de responsabilidade exclusiva do Usuário, que responde pelos valores correspondentes e pelas taxas cobradas pelo Gateway. A Plataforma não é responsável por tais disputas financeiras.</P>
      </Sec>

      {/* 6 */}
      <Sec id="arrependimento" num="6" title="Direito de Arrependimento">
        <Warn>
          <strong>[DECISÃO JURÍDICA — revisar com advogado antes de publicar]</strong>
          {' '}A aplicação do direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor a produtos digitais adquiridos com acesso imediato é tema juridicamente controvertido no Brasil. A posição mais conservadora — adotada neste rascunho — é a de aplicar o prazo de 7 dias. Há, entretanto, entendimentos que excluem o arrependimento quando o Produto foi disponibilizado de forma imediata e o Comprador iniciou a fruição do conteúdo, desde que expressamente informado e que haja consentimento prévio. Recomenda-se fortemente a revisão desta cláusula por advogado especializado em direito do consumidor e direito digital.
        </Warn>
        <P><Bold>6.1 Exercício do direito.</Bold> O Comprador que adquirir Produto do Usuário por meio da Plataforma pode, em regra, exercer o direito de arrependimento no prazo de 7 (sete) dias corridos contados da data da aquisição, nos termos do art. 49 do CDC, aplicável às contratações realizadas por meios eletrônicos.</P>
        <P><Bold>6.2 Responsabilidade pelo reembolso.</Bold> A efetivação do reembolso decorrente do exercício do direito de arrependimento é obrigação exclusiva do Usuário, que deve verificar junto ao seu Gateway de Pagamento o procedimento e os prazos para o estorno.</P>
        <P><Bold>6.3 Produtos com acesso imediato.</Bold> O Usuário que desejar estabelecer condições diferenciadas para o exercício do direito de arrependimento em Produtos digitais com acesso imediato deverá fazê-lo com fundamento jurídico sólido, mediante aconselhamento profissional, e obter consentimento expresso e informado do Comprador previamente ao início do fornecimento do Produto, em conformidade com as orientações do CDC e do Poder Judiciário.</P>
      </Sec>

      {/* 7 */}
      <Sec id="propriedade" num="7" title="Propriedade Intelectual">
        <P><Bold>7.1 Direitos da Plataforma.</Bold> A Plataforma, incluindo seu software, código-fonte, algoritmos, interfaces gráficas, logotipos, marcas, nomes comerciais, identidade visual, documentação técnica e demais elementos constitutivos, é de propriedade exclusiva de <Ph t="RAZÃO SOCIAL" /> ou de seus licenciantes, sendo protegida pela Lei nº 9.279/1996 (Propriedade Industrial), pela Lei nº 9.610/1998 (Direitos Autorais) e pela legislação internacional aplicável. Nenhuma disposição destes Termos transfere ao Usuário qualquer direito de propriedade intelectual sobre a Plataforma.</P>
        <P><Bold>7.2 Licença de uso.</Bold> A Plataforma concede ao Usuário uma licença pessoal, não exclusiva, intransferível, revogável e limitada para acessar e utilizar a Plataforma exclusivamente para os fins previstos nestes Termos, durante a vigência da relação contratual.</P>
        <P><Bold>7.3 Conteúdo do Usuário.</Bold> O Usuário declara e garante que possui todos os direitos de propriedade intelectual — incluindo direitos autorais, de marca, de patente e de imagem — sobre os Produtos e conteúdos que disponibiliza por meio da Plataforma, e que esses conteúdos não infringem direitos de terceiros.</P>
        <P><Bold>7.4 Direitos de imagem e voz de terceiros.</Bold> O Usuário é o único responsável por obter todas as autorizações necessárias para o uso de imagem, voz, nome e likeness de terceiros em seus Produtos e campanhas. A Plataforma não assume qualquer responsabilidade por violações de direitos de imagem ou de personalidade.</P>
        <P><Bold>7.5 Vedação ao uso indevido da marca.</Bold> É expressamente vedado ao Usuário utilizar a marca, o logotipo, o nome comercial ou qualquer elemento da identidade visual do Umbra Bot sem autorização prévia e escrita. Em especial, é proibido sugerir ou criar a falsa impressão de que os Produtos do Usuário são criados, aprovados, endossados ou associados à Plataforma.</P>
      </Sec>

      {/* 8 */}
      <Sec id="resultados" num="8" title="Não Promessa de Resultados">
        <P><Bold>8.1 Ausência de garantia de ganhos.</Bold> A Plataforma é uma ferramenta tecnológica. Seu uso não garante, em nenhuma hipótese, resultados financeiros, aumento de faturamento, geração de leads, volume de conversões nem qualquer outro resultado econômico ao Usuário. Os resultados dependem exclusivamente das estratégias, do esforço, do produto, do público-alvo e das condições de mercado do próprio Usuário.</P>
        <P><Bold>8.2 Proibição de promessas irreais ao Comprador.</Bold> O Usuário é proibido de realizar, por meio da Plataforma ou de qualquer outro canal, promessas de ganho fácil, resultados financeiros garantidos ou projeções irrealistas a Compradores. Tais condutas configuram infração ao CDC, à Lei nº 14.181/2021 (combate ao superendividamento) e ao Código de Ética e Autorregulamentação do CONAR, podendo caracterizar, em determinadas circunstâncias, o crime de estelionato. A responsabilidade pelas consequências jurídicas dessas práticas é exclusiva do Usuário.</P>
      </Sec>

      {/* 9 */}
      <Sec id="proibidos" num="9" title="Conteúdos e Condutas Proibidas">
        <P>É expressamente vedado ao Usuário utilizar a Plataforma para criar, armazenar, transmitir, vender, divulgar, facilitar ou de qualquer forma intermediar:</P>
        <Ul>
          <Li><Bold>Material de abuso sexual infantil (CSAM):</Bold> qualquer conteúdo que retrate, sugira, promova ou facilite o abuso sexual ou a exploração sexual de crianças e adolescentes, em qualquer formato, incluindo material gerado por inteligência artificial (deepfakes). Violações serão denunciadas imediatamente às autoridades competentes e à Safernet Brasil;</Li>
          <Li><Bold>Conteúdo íntimo não consensual:</Bold> imagens, vídeos ou áudios de natureza íntima ou sexual divulgados sem o consentimento do representado (revenge porn, deepfakes íntimos não consentidos), nos termos da Lei nº 13.718/2018;</Li>
          <Li><Bold>Violação de direitos de propriedade intelectual:</Bold> conteúdo que infrinja direitos autorais, marcas registradas, direitos de imagem, segredos comerciais ou qualquer outro direito de propriedade intelectual ou de personalidade de terceiros;</Li>
          <Li><Bold>Drogas e substâncias controladas:</Bold> venda, facilitação ou instrução relacionada a entorpecentes ilícitos, medicamentos sujeitos a controle especial sem receita médica, substâncias análogas ou produtos proibidos pela ANVISA;</Li>
          <Li><Bold>Armas e munições:</Bold> venda, permuta, facilitação ou instrução para aquisição de armas de fogo, munições, acessórios de uso proibido, explosivos ou quaisquer outros itens enquadrados como ilegais pela legislação brasileira;</Li>
          <Li><Bold>Tráfico de pessoas e exploração:</Bold> qualquer conteúdo ou serviço que facilite, promova ou lucre com o tráfico de pessoas, o trabalho análogo à escravidão ou a exploração sexual de qualquer natureza;</Li>
          <Li><Bold>Crimes em geral:</Bold> uso da Plataforma para praticar ou facilitar estelionato, fraude, lavagem de dinheiro, extorsão, ameaças, crimes de informática (Lei nº 12.737/2012) ou qualquer outra conduta tipificada como crime ou contravenção pela legislação brasileira;</Li>
          <Li><Bold>Discurso de ódio e discriminação:</Bold> conteúdo que incite ou promova violência, discriminação ou preconceito motivados por raça, cor, etnia, religião, procedência nacional, gênero, orientação sexual, deficiência ou qualquer outra condição protegida pela legislação;</Li>
          <Li><Bold>Malware, phishing, golpes e pirâmides:</Bold> distribuição de software malicioso, prática de phishing, engenharia social, criação de esquemas de pirâmide financeira (Ponzi), marketing multinível não regulamentado, redes de afiliados fraudulentas ou qualquer modalidade de fraude eletrônica;</Li>
          <Li><Bold>Pirataria e violação de direitos autorais:</Bold> rateios de cursos, distribuição não autorizada de conteúdo protegido por direitos autorais, IPTV pirata, crack de software, key generators, ativadores e similares;</Li>
          <Li><Bold>Violação das políticas do Gateway de Pagamento:</Bold> qualquer atividade expressamente vetada pelos termos de serviço do Gateway de Pagamento contratado pelo Usuário, incluindo categorias de negócio de alto risco não autorizadas pelo Gateway.</Li>
        </Ul>
        <P>A constatação de qualquer das condutas acima sujeitará o Usuário à suspensão ou encerramento imediato da conta, sem direito a reembolso de taxas, além de eventual comunicação às autoridades competentes.</P>
      </Sec>

      {/* 10 */}
      <Sec id="denuncias" num="10" title="Denúncias e Remoção de Conteúdo">
        <P><Bold>10.1 Canal de denúncias.</Bold> Qualquer pessoa que identifique conteúdo ou conduta vedada por estes Termos pode enviar denúncia ao endereço eletrônico <Ph t="E-MAIL DE DENÚNCIAS" />, informando, na medida do possível, link, captura de tela ou descrição detalhada do material.</P>
        <P><Bold>10.2 Prazo de análise.</Bold> A Plataforma se compromete a analisar as denúncias recebidas em até 48 (quarenta e oito) horas úteis e, constatada a violação, a adotar as medidas cabíveis, que poderão incluir a remoção de conteúdo, a suspensão ou o encerramento definitivo da conta do Usuário infrator.</P>
        <P><Bold>10.3 Cooperação com entidades de proteção.</Bold> A Plataforma coopera com a Safernet Brasil e com demais organizações dedicadas ao combate a crimes digitais. Denúncias de material de abuso sexual infantil (CSAM) serão encaminhadas imediatamente ao canal competente da Safernet Brasil e às autoridades policiais, nos termos da Lei nº 8.069/1990 (ECA).</P>
        <P><Bold>10.4 Proteção do denunciante.</Bold> A identidade do denunciante será preservada em sigilo nos limites estabelecidos pela legislação, a fim de protegê-lo de eventuais retaliações.</P>
      </Sec>

      {/* 11 */}
      <Sec id="responsabilidade" num="11" title="Limitação de Responsabilidade">
        <P><Bold>11.1 Disponibilidade do serviço.</Bold> A Plataforma empenha-se em manter a disponibilidade contínua dos seus serviços, mas não garante a ausência de interrupções, falhas técnicas, erros ou períodos de manutenção programada ou emergencial. A Plataforma não se responsabiliza por eventuais prejuízos decorrentes de indisponibilidade, salvo na hipótese de dolo ou culpa grave comprovados.</P>
        <P><Bold>11.2 Exclusão de danos indiretos.</Bold> Nos limites máximos permitidos pela legislação aplicável, a Plataforma não se responsabiliza por danos indiretos, incidentais, especiais, punitivos ou consequenciais, incluindo, sem limitação, lucros cessantes, perda de dados, perda de receita, perda de clientes ou interrupção de atividade empresarial, decorrentes do uso ou da impossibilidade de uso da Plataforma.</P>
        <P><Bold>11.3 Teto de responsabilidade.</Bold> Nas hipóteses em que a responsabilidade da Plataforma for reconhecida por autoridade competente, o valor total da indenização devida ao Usuário fica limitado ao montante das taxas por transação efetivamente pagas pelo Usuário à Plataforma nos 12 (doze) meses imediatamente anteriores ao evento gerador do dano.</P>
        <P><Bold>11.4 Serviços de terceiros.</Bold> A Plataforma não se responsabiliza pelo funcionamento, pelas políticas, pelos conteúdos nem pelas falhas de serviços de terceiros, incluindo o Telegram, os Gateways de Pagamento e demais integrações.</P>
      </Sec>

      {/* 12 */}
      <Sec id="indenizacao" num="12" title="Indenização">
        <P>O Usuário concorda em defender, indenizar e manter indene <Ph t="RAZÃO SOCIAL" />, seus sócios, administradores, colaboradores, prestadores de serviço e parceiros, de e contra quaisquer reclamações, ações judiciais, processos administrativos, perdas, danos, custas processuais e despesas (incluindo honorários advocatícios razoáveis) decorrentes de ou relacionados a:</P>
        <Ul>
          <Li>O conteúdo, os Produtos e as atividades do Usuário na Plataforma;</Li>
          <Li>Violação de qualquer disposição destes Termos ou de legislação aplicável;</Li>
          <Li>Infração a direitos de terceiros, incluindo direitos de propriedade intelectual, privacidade, imagem e direitos do consumidor;</Li>
          <Li>Uso não autorizado das credenciais de acesso do Usuário;</Li>
          <Li>Quaisquer disputas entre o Usuário e Compradores ou outros terceiros.</Li>
        </Ul>
      </Sec>

      {/* 13 */}
      <Sec id="suspensao" num="13" title="Suspensão e Encerramento de Conta">
        <P><Bold>13.1 Encerramento pelo Usuário.</Bold> O Usuário pode solicitar o encerramento da sua conta a qualquer tempo pelo canal de suporte da Plataforma. O encerramento não gera direito a reembolso de taxas já incidentes sobre transações concluídas.</P>
        <P><Bold>13.2 Suspensão ou encerramento pela Plataforma.</Bold> A Plataforma pode, a seu exclusivo critério, suspender ou encerrar a conta do Usuário, com ou sem aviso prévio, nas seguintes situações:</P>
        <Ul>
          <Li>Violação de qualquer disposição destes Termos ou da Política de Privacidade;</Li>
          <Li>Prática de qualquer conduta proibida listada na Cláusula 9;</Li>
          <Li>Determinação de autoridade judicial, policial ou administrativa competente;</Li>
          <Li>Constatação de fraude, uso de informações falsas ou condutas prejudiciais à Plataforma, a outros Usuários ou a terceiros;</Li>
          <Li>Inatividade prolongada da conta, mediante comunicação prévia de 30 (trinta) dias.</Li>
        </Ul>
        <P><Bold>13.3 Efeitos do encerramento.</Bold> O encerramento implica a cessação imediata do acesso à Plataforma. Em caso de encerramento por violação dos Termos, não será concedido reembolso de nenhuma natureza. Os dados do Usuário serão tratados conforme a Política de Privacidade.</P>
        <P><Bold>13.4 Titularidade dos bots.</Bold> Os bots do Telegram conectados à Plataforma pertencem ao Usuário, que mantém o acesso a eles junto ao Telegram independentemente do status da conta na Plataforma.</P>
      </Sec>

      {/* 14 */}
      <Sec id="autoridades" num="14" title="Cooperação com Autoridades">
        <P><Bold>14.1 Guarda de registros de acesso.</Bold> A Plataforma mantém registros de acesso e de atividade dos Usuários pelo período mínimo de 6 (seis) meses, conforme determinado pelo art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet).</P>
        <P><Bold>14.2 Fornecimento de dados mediante ordem judicial.</Bold> A Plataforma divulgará registros e dados de Usuários às autoridades exclusivamente mediante ordem judicial específica, nos termos dos arts. 10 e 22 do Marco Civil da Internet e da legislação processual em vigor, preservando o sigilo das informações não alcançadas pela ordem.</P>
        <P><Bold>14.3 Comunicação proativa em situações de risco.</Bold> Em situações que envolvam risco iminente à vida, à segurança pública ou crimes contra crianças e adolescentes (ECA, Lei nº 8.069/1990), a Plataforma poderá, sem necessidade de ordem judicial prévia, comunicar as autoridades competentes e fornecer as informações mínimas necessárias à proteção das vítimas.</P>
      </Sec>

      {/* 15 */}
      <Sec id="conflitos" num="15" title="Resolução Amigável de Conflitos">
        <P>Antes de ajuizar qualquer ação judicial ou iniciar procedimento arbitral, as partes comprometem-se a buscar de boa-fé a resolução amigável da controvérsia. Para tanto, a parte interessada deve enviar notificação formal à outra descrevendo a natureza do conflito e a solução pretendida, concedendo prazo de 30 (trinta) dias corridos para resposta e eventual tratativa. Somente após o esgotamento dessa etapa sem solução satisfatória as partes poderão recorrer às vias judiciais.</P>
      </Sec>

      {/* 16 */}
      <Sec id="lei" num="16" title="Lei Aplicável e Foro">
        <P>Estes Termos são regidos e interpretados exclusivamente pelas leis da República Federativa do Brasil. Para a solução de litígios dele decorrentes, fica eleito o foro da Comarca de <Ph t="FORO/COMARCA" />, com expressa renúncia a qualquer outro, por mais privilegiado que seja, ressalvada a competência de juizados especiais e foros definidos por lei em favor do consumidor.</P>
      </Sec>

      {/* 17 */}
      <Sec id="modificacoes" num="17" title="Modificações dos Termos">
        <P><Bold>17.1 Direito de alteração.</Bold> A Plataforma reserva-se o direito de modificar estes Termos a qualquer tempo, para refletir alterações na legislação, nos serviços oferecidos ou nas políticas internas.</P>
        <P><Bold>17.2 Aviso prévio.</Bold> Modificações com impacto relevante nos direitos e obrigações das partes serão comunicadas ao Usuário com antecedência mínima de 15 (quinze) dias, por meio de notificação no painel da Plataforma, pelo e-mail cadastrado ou por outro meio adequado. Alterações meramente formais ou corretivas de erros gramaticais podem ser realizadas sem aviso prévio.</P>
        <P><Bold>17.3 Aceitação tácita.</Bold> O uso continuado da Plataforma após a entrada em vigor das alterações implica aceitação integral das novas condições. Caso o Usuário discorde das modificações, deverá encerrar sua conta antes da data de vigência dos novos termos.</P>
      </Sec>

      {/* 18 */}
      <Sec id="disposicoes" num="18" title="Disposições Gerais">
        <P><Bold>18.1 Independência das cláusulas (severabilidade).</Bold> Se qualquer cláusula destes Termos for declarada inválida, ilegal ou inexequível por autoridade competente, as demais permanecerão em pleno vigor, e a cláusula inválida será substituída por disposição que, tanto quanto possível, alcance o mesmo objetivo econômico e jurídico.</P>
        <P><Bold>18.2 Não renúncia.</Bold> A tolerância de qualquer parte em relação ao descumprimento de obrigação pela outra não constitui novação nem renúncia ao direito de exigir o cumprimento integral no futuro.</P>
        <P><Bold>18.3 Cessão.</Bold> O Usuário não pode ceder, transferir ou subcontratar direitos ou obrigações destes Termos sem o consentimento prévio e escrito da Plataforma. A Plataforma pode ceder estes Termos a qualquer afiliada ou em conexão com fusão, aquisição ou venda de ativos, mediante notificação ao Usuário com antecedência mínima de 15 dias.</P>
        <P><Bold>18.4 Integralidade do acordo.</Bold> Estes Termos e a Política de Privacidade constituem o acordo integral entre as partes, substituindo quaisquer negociações, entendimentos ou acordos anteriores, verbais ou escritos, sobre o mesmo objeto.</P>
        <P><Bold>18.5 Forma das comunicações.</Bold> As comunicações da Plataforma ao Usuário serão feitas pelo e-mail cadastrado ou pelo painel da Plataforma. As comunicações formais do Usuário à Plataforma devem ser enviadas a <Ph t="RAZÃO SOCIAL" />, com sede em <Ph t="CIDADE/UF DA SEDE" />, pelo e-mail <Ph t="E-MAIL DE SUPORTE" /> ou pelo canal indicado em <Ph t="LINK DO SUPORTE NO TELEGRAM" />.</P>
      </Sec>

      {/* TL;DR */}
      <section id="tldr" style={{ scrollMarginTop: '72px' }} className="mb-12">
        <div className="bg-primary-soft/20 border border-primary/20 rounded-2xl p-6 md:p-8">
          <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">TL;DR</p>
          <h2 className="text-[18px] font-semibold text-text mb-2">Resumo em linguagem simples</h2>
          <p className="text-[12px] text-text-subtle italic mb-5">
            Este resumo é meramente informativo e não tem valor jurídico próprio. Leia o documento completo.
          </p>
          <ul className="space-y-3">
            {[
              'O Umbra Bot é uma ferramenta de software — quem vende, entrega, suporta e recolhe impostos é você (Usuário).',
              'Você conecta seu próprio gateway de pagamento. O Umbra Bot não toca no seu dinheiro em momento algum.',
              'A taxa é cobrada apenas sobre cada venda aprovada — sem mensalidade.',
              'Apenas maiores de 18 anos podem usar a plataforma.',
              'Conteúdo ilegal, pirataria, golpes, CSAM e demais condutas proibidas resultam em encerramento imediato e denúncia às autoridades.',
              'A plataforma pode ter instabilidades; não garantimos resultados financeiros de nenhum tipo.',
              'Disputas entre você e seus compradores são 100% sua responsabilidade.',
              'Conflitos são regidos pela lei brasileira, no foro de [FORO/COMARCA].',
              'Tente resolver qualquer problema amigavelmente antes de recorrer à Justiça.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-text">
                <span className="w-6 h-6 rounded-lg bg-primary text-primary-fg text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

    </LegalLayout>
  )
}
