# Caixa do Evento 🛒

App web **mobile-first** para controle de caixa de um evento/festa de vários dias.
Vendas, marcações (fiado), relatórios por dia e backup em CSV — tudo gravado num
**banco Postgres real e persistente** (nada de `localStorage`, nada some se o
navegador limpar o cache).

Feito com **Next.js (App Router) + TypeScript + Tailwind CSS**, pronto para
rodar no **Vercel** e ser instalado na tela inicial do iPhone (PWA).

---

## Funcionalidades

- **Venda** — grid de produtos com botões +/-, resumo do carrinho com total,
  formas de pagamento (Cartão, Pix, Dinheiro, Marcado). Em "Marcado" você escolhe
  uma pessoa cadastrada (com busca quando há mais de 10) ou cadastra na hora.
  A confirmação de sucesso **só aparece quando o banco confirma a gravação**.
  Ao escolher **Dinheiro**, aparece uma **calculadora de troco**: digite (ou toque
  na nota) o valor recebido e o troco é calculado na hora.
- **Relatório** — total do dia, nº de vendas, total por forma de pagamento,
  total por produto, últimas vendas e **seletor de dia** (evento de vários dias).
  Cada venda da lista tem um botão **Desfazer**: cancela a venda (com confirmação),
  tirando-a dos totais e das marcações. A venda cancelada não é apagada de vez —
  fica marcada como `cancelada` no backup, para manter o histórico.
- **Marcações** — cadastro direto de pessoas, lista "Em aberto" com itens e valor
  e botão "Marcar como pago", e lista separada de pessoas sem conta em aberto.
- **Produtos** — adicionar, editar e remover (nome e preço).
- **Backup CSV** — botão na tela de Relatório baixa um CSV com todas as vendas e
  marcações, para guardar como segurança extra.

### Confiabilidade

- Cada venda é gravada dentro de uma **transação** (venda + itens juntos, ou nada).
- Os **preços são sempre lidos do banco** no momento da venda (o total nunca
  depende de valores enviados pelo navegador).
- Toda falha de gravação mostra um **aviso vermelho claro** na tela — você nunca
  vê "sucesso" sem o dado ter sido salvo de verdade.
- **Teste de persistência já validado**: lançar venda → reiniciar o banco e o app
  → os dados continuam lá.

---

## Rodar localmente

Pré-requisitos: **Node.js 18+** e uma string de conexão de um Postgres.
O jeito mais rápido de ter um Postgres é criar um banco grátis no **Supabase** ou
no **Vercel Postgres** (veja a seção de deploy) e usar a mesma string aqui.

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env.local` (copie de `.env.example`) e preencha a conexão:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   DATABASE_URL="postgres://usuario:senha@host:5432/banco?sslmode=require"
   EVENT_TZ=America/Sao_Paulo
   ```

3. Rode em desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra <http://localhost:3000>. As tabelas e os produtos padrão
   (Água R$3,00, Refri R$5,00, Antarctica R$6,00, Heineken R$12,00) são criados
   **automaticamente** na primeira vez que o app acessa o banco.

> Não é preciso rodar nenhuma migration à mão: o schema é criado sozinho.

---

## Deploy no Vercel

### Opção A — Vercel Postgres (mais integrado)

1. Suba este repositório para o GitHub.
2. Em <https://vercel.com>, clique em **Add New → Project** e importe o repositório.
3. Antes (ou depois) do primeiro deploy, vá em **Storage → Create Database →
   Postgres**, dê um nome e conecte ao projeto. O Vercel cria automaticamente as
   variáveis `POSTGRES_URL`, `DATABASE_URL`, etc.
4. Em **Settings → Environment Variables**, garanta que exista uma variável
   **`DATABASE_URL`** (o Vercel Postgres já cria; se só existir `POSTGRES_URL`,
   crie `DATABASE_URL` com o mesmo valor). Opcionalmente adicione
   `EVENT_TZ=America/Sao_Paulo`.
5. Clique em **Deploy**. Pronto — acesse o link `.vercel.app` pelo iPhone.

### Opção B — Supabase (banco grátis, simples)

1. Crie um projeto em <https://supabase.com> (guarde a senha do banco).
2. No painel do Supabase: **Project Settings → Database → Connection string →
   "Transaction pooler"**. Copie a URI (algo como
   `postgres://postgres.xxxx:SENHA@aws-0-...pooler.supabase.com:6543/postgres`).
3. No Vercel, importe o repositório e em **Settings → Environment Variables**
   adicione:
   - `DATABASE_URL` = a string do passo 2
   - `EVENT_TZ` = `America/Sao_Paulo`
4. Clique em **Deploy**.

> O app usa a biblioteca `postgres` com `prepare: false`, compatível com os
> _poolers_ em modo transação do Supabase e do Vercel Postgres.

---

## Instalar no iPhone (PWA)

1. Abra o link do app no **Safari**.
2. Toque no botão **Compartilhar** → **Adicionar à Tela de Início**.
3. O app abre em tela cheia, com ícone próprio, como um aplicativo.

> Como os dados ficam no banco (nuvem), você pode abrir de vários celulares ao
> mesmo tempo e todos veem as mesmas vendas e marcações.

---

## Backup

Na tela **Relatório**, o botão **⬇︎ Backup CSV** baixa um arquivo com **todas** as
vendas e marcações (uma linha por item, com data/hora, forma de pagamento, pessoa,
produto, quantidade e valores). Recomendado baixar de tempos em tempos durante o
evento como segurança extra. O CSV abre direto no Excel/Google Sheets.

---

## Estrutura

```
src/
  app/
    page.tsx            # Tela de Venda
    relatorio/          # Tela de Relatório (+ botão de backup)
    marcacoes/          # Tela de Marcações (fiado)
    produtos/           # Tela de Produtos
    api/                # Rotas de API (products, people, sales, report, marcacoes, backup)
  components/           # BottomNav, PersonPicker
  lib/                  # db (Postgres + schema), money, types, client
public/                 # manifest.json e ícones do PWA
```

Valores monetários são armazenados em **centavos (inteiros)** para evitar erros de
arredondamento.
