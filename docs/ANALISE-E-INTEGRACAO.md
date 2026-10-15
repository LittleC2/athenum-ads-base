# Análise do negócio e guia de integração

Documento para quem vai ler este código e levar partes dele para outro sistema. Direto ao ponto.

## 1. O que isso é, de verdade

Uma ferramenta **interna de agência de tráfego pago (Meta Ads)** com duas telas:

- **Portal do cliente** (`/painel`): o dono do negócio vê, em linguagem simples, quanto investiu, quanto voltou, se a
  conta está saudável, e informa quantos contatos viraram venda.
- **Painel do gestor** (`/admin`): visão de todas as contas, alertas, relatórios escritos pelo Claude, criação de
  campanha pausada, fila de ações com aprovação humana, copiloto de chat.

Não é um SaaS multi-agência: é **uma agência, vários clientes**. Não gera receita direta; gera **retenção** (o cliente
enxerga o trabalho) e **capacidade** (um gestor opera mais contas com análise e rascunhos feitos pela IA).

## 2. Onde está o valor (e onde não está)

| Peça                                                                           | Valor real                                                                                                            | Observação                                                                                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Retorno de vendas informado pelo cliente (`ResultFeedback`)                    | **Alto.** CPL sozinho não prova lucro; fechar lead → venda é o que justifica o contrato.                              | Hoje é digitação manual do cliente: adesão tende a ser baixa. O salto de valor é puxar isso do CRM/WhatsApp por webhook. |
| Alertas + "precisa de você agora" (`alertRules`, `story`, `portfolio`)         | **Alto.** Transforma 20 contas em uma fila de prioridades.                                                            | Lógica pura e testada; é a parte mais fácil de reaproveitar.                                                             |
| Trava de escrita (tudo nasce pausado, aprovação, teto de orçamento, auditoria) | **Alto para confiança.** Permite pôr IA perto de dinheiro sem risco de gasto surpresa.                                | Padrão a copiar em qualquer integração com IA que escreva em plataforma de anúncio.                                      |
| Relatório com Claude (rascunho → gestor edita → publica)                       | Médio. Economiza tempo, mas o gate humano é obrigatório.                                                              | Nunca publicar texto de IA direto ao cliente.                                                                            |
| Construtor de campanha (22 objetivos)                                          | Médio. Útil, porém frágil: a Meta muda exigências (anunciante verificado, termos de formulário, app em modo Ao vivo). | Vários objetivos estão marcados como beta/não testados.                                                                  |
| Copiloto de chat                                                               | Baixo a médio. Só propõe; não executa.                                                                                | Bom para consulta, não é o diferencial.                                                                                  |

## 3. Riscos do negócio, em ordem de gravidade

1. **Ponto único de falha no token da Meta.** Um token (ou um por cliente) alimenta tudo. Token de usuário expira; o
   correto é _System User_ sem expiração. Se vencer, todos os painéis ficam desatualizados sem o cliente saber.
   O app já mostra os dias restantes (Ajustes) e tem `npm run ads -- token`.
2. **Dependência de política da Meta.** App precisa estar "Ao vivo" para criar criativos; algumas contas exigem
   anunciante verificado; formulários de lead exigem termos aceitos na Página. Detalhes em `docs/setup-meta.md`.
3. **Só Meta.** Cliente que investe também em Google Ads fica com visão pela metade. Não há camada de abstração de
   plataforma: `src/lib/server/meta/*` é chamado direto.
4. **Qualidade do dado de resultado.** O app soma "resultados" por tipo de conta (`resultType`: WhatsApp, formulário,
   compra). Escolher o tipo errado distorce todo o painel; é configuração manual por conta.
5. **Cobertura de testes desigual.** As regras puras têm 104 testes. A camada de servidor (autenticação, guardas,
   fila de ações) só é coberta pelo script e2e manual (`scripts/e2e.cjs`) e pelos `*-live-test.js` contra a Meta.
   Vale ter testes automatizados dessa camada antes de levar para produção em outro sistema.
6. **Escala.** Sincronização por cron de hora em hora, no processo (`scheduler.js`) ou por GitHub Actions. Funciona
   para dezenas de contas; centenas pedem fila de jobs e controle de limite de taxa da Meta.
7. **LGPD.** O banco guarda métricas agregadas e contagens informadas, **não** dados pessoais de leads. Manter assim.
   Há um `AuditLog` de tudo que escreve na Meta.

## 4. Segurança: o que foi verificado

Resultado da varredura antes de publicar este repositório:

- **Sem segredos no código ou no histórico**; `.env` fora do git; token da Meta nunca em URL (vai em cabeçalho) e
  mensagens de erro passam por `redact.js`.
- **Isolamento entre clientes:** o portal filtra sempre por `clientId` da **sessão**, nunca por parâmetro de URL;
  recurso de outro cliente responde 404. Todos os handlers de `/admin` e `/api/admin` chamam `requireAdmin`.
- **Sem XSS** (nenhum `{@html}`; texto de IA vira nós de texto), **sem SQL cru**, **sem execução dinâmica**.
- **Sessões** em cookie `httpOnly` + `sameSite=lax` + `secure` em produção; senha com scrypt + comparação em tempo
  constante; bloqueio de 15 min após 5 erros; troca de senha encerra as outras sessões.
- Corrigidos na varredura: arquivo de criativo ficava no disco após excluir; o tempo de resposta do login revelava se
  o e-mail existia; faltava HSTS em produção.
- **Pontos conhecidos, não corrigidos** (escolha de quem integrar): sem limite de tentativas por IP (só por conta);
  sem CSP; troca de senha não pede a senha atual; upload confia no tipo MIME enviado (só admin envia, e o tipo servido
  vem de uma lista fixa); vídeos de até 300 MB são lidos inteiros em memória; `npm audit` aponta avisos de severidade
  alta em dependências **de desenvolvimento do Prisma** (`mysql2` dentro do CLI), que não entram em runtime.

## 5. Como encaixar no sistema do seu amigo

Do mais fácil de reaproveitar ao mais acoplado:

1. **Lógica pura (copiar quase sem mudar):** `src/lib/metrics.js`, `alertRules.js`, `story.js`, `portfolio.js`,
   `campaignSpec.js`, `copyLint.js`, `reportTemplate.js`, `money.js`, `dates.js`. Sem dependência de framework, com testes.
2. **Cliente da Meta:** `src/lib/server/meta/client.js` (fetch cru, retry em limite de taxa, token por conta via
   `AsyncLocalStorage`), `insights.js`, `entities.js`, `builder.js`.
3. **Camada de IA:** `src/lib/server/ai/*` (relatório, copys, planejador, copiloto com ferramentas de leitura +
   proposta). Troque o modelo em `ANTHROPIC_MODEL`.
4. **Fila de ações com aprovação:** `src/lib/server/actions.js` (executa uma vez só, valida teto, audita). É o padrão a
   replicar se ele já tiver outro fluxo de aprovação.
5. **Telas:** SvelteKit 2 + Svelte 5. Só reaproveitável se ele usar o mesmo stack.

Acoplamentos que ele vai precisar resolver:

- **Autenticação própria** (`auth.js`, tabelas `User`/`Session`, dois papéis). Se o sistema dele já tem login, troque
  `getSessionUser` e mantenha `requireAdmin`/`requireClientUser` (`guards.js`) como contrato.
- **Modelo de dados:** Prisma + Postgres (`prisma/schema.prisma`). Tudo gira em `Client → AdAccount → MetaEntity /
InsightDaily`. Valores em **centavos** (inteiros) e datas de calendário em `America/Sao_Paulo`.
- **Idioma e moeda:** pt-BR e BRL fixos em `format.js` e `dates.js`.
- **Marca:** nome "Athenum" e paleta no `app.css`/componentes.
- **Agendador:** `scheduler.js` (cron no processo; precisa servidor sempre ligado) ou `docs/sync-github-actions.yml.example` (copie para `.github/workflows/sync.yml`)
  (para hospedagem serverless, com `DISABLE_SCHEDULER=1`).
- **Modo `DASHBOARD_ONLY=1`:** desliga campanhas, biblioteca, fila de ações e copiloto; deixa só dashboards,
  alertas e relatórios. Bom ponto de partida seguro se ele só quer a parte de acompanhamento.

## 6. Primeiros passos

```bash
cp .env.example .env     # preencha DATABASE_URL, SEED_ADMIN_*; META_ADS_ACCESS_TOKEN e ANTHROPIC_API_KEY quando for usar
npm install
npx prisma migrate deploy
SEED_EXAMPLE_CLIENTS=1 npm run db:seed   # admin + 2 clientes fictícios (as contas de exemplo não existem na Meta)
npm run dev                              # http://localhost:5190
npm test
```

Para dados reais, cadastre clientes e contas pelo painel (Clientes → Novo) e siga `docs/setup-meta.md`.
