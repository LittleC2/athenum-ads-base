# Athenum Ads

Plataforma de tráfego pago da Athenum: portal de acompanhamento para os clientes (somente leitura) e painel do
gestor para analisar contas, gerar relatórios e subir campanhas com o Claude por trás.

SvelteKit 2 (Svelte 5, JavaScript) + adapter-node, Postgres via Prisma 7, Meta Marketing API, API da Anthropic.
Mesma base e identidade visual do Athenum Hub, mas **app e banco separados**: o Hub não tem papéis, e aqui há
login de cliente.

## Duas áreas

|           | Quem    | O que faz                                                                                                                                                                                                          |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/painel` | Cliente | Dashboard da conta dele (investido, resultados, custo, alcance, ritmo do orçamento), resumo da semana, relatórios publicados, formulário de "quantos viraram cliente". Só leitura, mobile first, instalável (PWA). |
| `/admin`  | Gestor  | Visão geral de todos os clientes, alertas, relatórios com Claude, fluxo de campanha (briefing, estrutura, copys, criativos, envio pausado, ativação), biblioteca, fila de ações, copiloto Claude, ajustes.         |

## Como o Claude entra

- **Relatórios:** escreve o rascunho (texto simples pro cliente e análise técnica pro gestor). O gestor edita e publica.
- **Copys:** gera variantes por ângulo, com checagem automática (limites, saúde, travessão).
- **Campanhas:** propõe a estrutura a partir do briefing e do histórico real da conta. É só proposta.
- **Copiloto (chat):** lê os dados e **propõe** ações. Toda escrita na Meta passa pela fila de Ações e só roda com
  aprovação do gestor. O copiloto não tem como executar nada.
- Sem `ANTHROPIC_API_KEY`: relatórios saem de texto de modelo e o resto da IA fica desligado.

## Segurança

- Papéis `ADMIN` e `CLIENT`; o portal filtra tudo pelo `clientId` da sessão, nunca por parâmetro de URL.
- Token da Meta só no servidor. Tudo que escreve na Meta cai em `AuditLog`.
- Campanhas nascem **pausadas**; ativar exige confirmação de gasto. Teto de orçamento diário por conta e trava geral
  de escrita (Ajustes). Login com bloqueio após 5 erros e troca de senha obrigatória no primeiro acesso.

## Rodar local

```bash
npm install
npx prisma dev --name ads --detach        # Postgres local; use a porta TCP no DATABASE_URL
cp .env.example .env                      # preencha
npx prisma migrate dev                    # cria as tabelas
npm run db:seed                           # admin (+ 2 clientes de exemplo com SEED_EXAMPLE_CLIENTS=1)
npm run dev                               # http://localhost:5190
```

**Vai integrar isto em outro sistema? Comece por [docs/ANALISE-E-INTEGRACAO.md](docs/ANALISE-E-INTEGRACAO.md).**

Conectar a Meta: [docs/setup-meta.md](docs/setup-meta.md). Primeira sincronização: Clientes, aba "Contas e
resultado", "Sincronizar agora" (o histórico completo leva alguns minutos). Depois é automático, de hora em hora.

## Usar pelo terminal (Claude Code)

O mesmo motor do painel (mesmas regras, guardas e auditoria) está disponível pelo terminal, para operar a conta
conversando com o Claude Code:

```bash
npm run ads -- ajuda                                  # lista os comandos
npm run ads -- contas                                 # clientes e contas, últimos 7 dias
npm run ads -- resumo clinica-exemplo 30d                    # números de uma conta
npm run ads -- rascunho clinica-exemplo LEADS_WHATSAPP "Nome"  # cria rascunho de campanha (--ia pede a estrutura ao Claude)
npm run ads -- validar <id>                           # valida na Meta sem criar nada
npm run ads -- enviar <id> --confirmo                 # cria na Meta, PAUSADA
npm run ads -- ativar <id> --confirmo-gasto           # LIGA o gasto (exige a segunda confirmação)
```

Usa o banco do `DATABASE_URL` do `.env`. Apontando para o mesmo banco do Railway, painel e terminal enxergam os mesmos dados.

## Testes

```bash
npm test                                                   # unitários (regras puras: métricas, alertas, campanha, copy, relatório)
node scripts/e2e.cjs                                       # navegador: telas, isolamento entre clientes, fluxos (precisa do dev rodando)
npx vite-node --config vitest.config.js scripts/sync-check.js <act_id> <desde> <até>   # confere totais com a Meta
npx vite-node --config vitest.config.js scripts/actions-live-test.js                   # fila de ações e guardas na Meta
npx vite-node --config vitest.config.js scripts/copilot-fake-api-test.js               # laço do copiloto com API falsa
```

Os scripts `*-live-test.js` só criam objetos na conta de teste (TEST_OWN_ACT, pausados) e apagam no fim. Veja as variáveis TEST_* no .env.example.

## Deploy (Railway)

Projeto com um serviço Node (este repo) e um addon Postgres. `railway.json` já roda `prisma migrate deploy` antes
do start e usa `node build`. Variáveis: `DATABASE_URL` (injetada pelo addon), `META_ADS_ACCESS_TOKEN`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `UPLOADS_DIR` (caminho de um Volume), `BODY_SIZE_LIMIT=300M`. Depois do
primeiro deploy, rode uma vez `npm run db:seed` (via `railway run`) com `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`.
O agendador roda dentro do processo Node, então o serviço precisa ficar sempre ligado (não serverless).
