# Conectar a Meta (acesso de parceiro, token único)

O Athenum Ads fala com a Meta com **um token só**, guardado no servidor (`META_ADS_ACCESS_TOKEN`). Cada cliente
só enxerga a conta dele no portal; o token nunca chega ao navegador.

## 1. Token que não expira (System User)

Hoje o token em uso é de **usuário** e expira (a tela Ajustes mostra a data). Troque por um System User. Como cada
cliente tem a sua própria BM, o caminho é compartilhar as contas com a sua BM (agência) e gerar um token só nela:

**A. Em cada BM de cliente** (uma BM por cliente):

1. Configurações do negócio, Usuários, **Parceiros**, Adicionar, "Dar a um parceiro acesso aos seus ativos".
2. Informe o ID da sua BM (agência) (`<ID_DA_SUA_BM>`).
3. Marque a **conta de anúncios** (controle total) e a **Página** do cliente (criar anúncios), e confirme.

**B. Na sua BM (agência):**

1. Configurações do negócio, Usuários, **Usuários do sistema**, Adicionar, função Admin.
2. "Adicionar ativos": as contas de anúncios e páginas compartilhadas (aparecem como ativos de parceiros).
3. "Gerar token": app Athenum, validade **Nunca**, permissões `ads_read`, `ads_management`,
   `business_management` e `pages_show_list`.
4. Cole o token em `META_ADS_ACCESS_TOKEN` (no `.env` local e no Railway) e reinicie. Nunca cole em chat.
5. Confira com `npx vite-node --config vitest.config.js scripts/check-meta-access.js` e na tela Ajustes.

## Plano B: um token por cliente (quando a Meta não deixa emprestar a conta)

Se a BM do cliente não consegue compartilhar a conta com a sua BM (agência) (por exemplo, pede verificação), cada
cliente passa a ter o **próprio** usuário do sistema e o próprio token, dentro da BM dele. O app guarda só o
**nome da variável** (`META_TOKEN_NOME`), nunca o token.

Em cada BM de cliente (você é admin lá):

1. Configurações do negócio, Usuários, **Usuários do sistema**, Adicionar (uma BM não verificada pode ter 1).
2. Em **Contas**, **Aplicativos**, conecte o app ATHENUM (ID `<ID_DO_SEU_APP>`). Se pedir aprovação, aprove pela sua BM (agência).
3. No usuário do sistema, "Adicionar ativos": a conta de anúncios (controle total) e a página do cliente.
4. "Gerar token": app ATHENUM, validade **Nunca**, permissões `ads_read`, `ads_management`, `business_management`.
5. Guarde o token numa variável do servidor, por exemplo `META_TOKEN_SOFTWARE_EXEMPLO` (no `.env` e no Railway).
6. No app: Clientes, aba "Contas e resultado", campo "Token deste cliente": `META_TOKEN_SOFTWARE_EXEMPLO`. A situação do token aparece ali e em Ajustes.

Cliente novo com token próprio: vincule a conta digitando o ID (campo "Ou digite o ID da conta") e o nome da variável.
Conferir tudo: `npx vite-node --config vitest.config.js scripts/check-meta-access.js`.

## 2. App em modo "Ao vivo" (necessário para criar anúncios): FEITO em 14/10/2026

O app ATHENUM foi publicado com a política de privacidade em `https://SEU-SITE/privacidade.html` e as instruções de exclusão de dados em `https://SEU-SITE/privacidade.html#exclusao-de-dados` (site da Athenum no Netlify, projeto `athenum`). Depois disso a Meta passou a aceitar criar criativos por API (verificado com validate_only nas contas da Clínica e do Software Exemplo). O texto abaixo é o histórico do problema.

Verificado na prática: com o app **em desenvolvimento** a Meta cria campanha e conjunto, mas **recusa criar o
criativo** ("o post do criativo foi criado por um app em modo de desenvolvimento"). Para o fluxo de campanhas
funcionar até o fim:

1. Meta for Developers, app Athenum, Configurações do app, Básico.
2. Preencha a **URL da política de privacidade** (página `privacidade.html` do site da Athenum), o e-mail de contato e a categoria.
3. Alterne o app para **Ao vivo**.

Ler dados (dashboards, relatórios, alertas) funciona sem isso.

## 3. Anúncios de formulário de leads

A Meta bloqueia anúncio de cadastro enquanto a **Página do Facebook** não aceitar os Termos de Serviço de
Geração de Cadastros ("você não pode veicular anúncios de cadastros até sua Página aceitar os Termos"). Aceite
ao criar um formulário de cadastro na Página (Gerenciador de Anúncios, Formulários). O ID do formulário vai no
passo 1 do editor de campanha.

## 4. Cadastro de cada conta

Em Clientes, aba "Contas e resultado": vincule a conta (a lista vem do que o token enxerga), escolha o que conta
como resultado (lead de formulário, conversa no WhatsApp...), orçamento mensal, custo alvo, **teto de orçamento
diário** (trava de segurança do fluxo de campanhas) e o ID da Página do Facebook (obrigatório para criar anúncios).
Depois use "Sincronizar agora".

## Limites conhecidos da Meta (já tratados no app)

- Interesses de procedimento de saúde (botox, harmonização, dermatologia) não existem mais na segmentação.
- Com Advantage+ audience ligado, gênero e idade viram só sugestão. O editor avisa e permite desligar.
- A quebra por estado não traz leads, só gasto. Perguntas dos formulários não são legíveis com este token.
- O campo `amount_spent` da conta não bate com a soma dos insights: o app usa a soma dos insights.
- A atribuição muda depois: a sincronização regrava os últimos 4 dias a cada hora.

## Conta que exige anunciante verificado

Algumas contas (a primeira foi uma loja de e-commerce) recusam criar conjunto com "Forneça um anunciante verificado...".
Não adianta mandar o nome do anunciante: a Meta quer o **ID da identidade verificada** do anunciante. Onde achar:
Configurações do negócio, Autorizações e verificações, "Fazer verificação individual ou de uma organização",
aba Contas de anúncios, a conta, e o número em "Identificação" de cada verificação "bem-sucedida". Teste a identificação em
modo validação, porque nem toda serve (em um caso real, a marcada como "padrão" foi recusada e a outra, aceita).
Informe o número no campo "ID do anunciante verificado" da conta; o app passa a enviar
`regional_regulation_identities` em todo conjunto novo dela.
