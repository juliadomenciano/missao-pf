# Missão PF

App de estudos para Agente da PF com ciclo de estudos, pomodoro, aulas e treino de TAF.

Um mesmo código gera duas versões:

- **PWA** para o PC, publicado no GitHub Pages e instalável pelo Chrome ou pelo Edge.
- **APK Android**, feito com Capacitor, com notificação no fim de cada etapa do pomodoro mesmo com a tela bloqueada.

Os dados ficam no Supabase, na tabela `mpf_docs`. Ela pode ficar no mesmo projeto Supabase que você já usa, porque tem prefixo próprio e RLS por usuário. Sem configuração ou sem internet, o app funciona e guarda tudo no aparelho. Quando a conexão volta, ele sincroniza.

## 1. Supabase

1. Abra o SQL Editor do projeto e rode o arquivo `supabase/schema.sql`. Ele cria a tabela, as políticas de RLS e liga o realtime.
2. O login é feito com e-mail e senha. Na primeira vez, o Supabase envia um e-mail com um link de confirmação: é só clicar nele uma vez. Não precisa mudar nenhum template.
3. Se quiser pular a confirmação por e-mail, desligue **Authentication > Sign In / Providers > Email > Confirm email**.
4. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.

> No plano grátis, o Supabase pausa o projeto depois de cerca de 1 semana sem nenhum acesso. Usando o app no dia a dia, isso não acontece.
>
> O limite padrão de e-mails do Supabase é baixo, de poucos por hora. Para uso pessoal é suficiente.

## 2. Rodar no PC

```bash
cp .env.example .env
npm install
npm run dev
```

Preencha o `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Para desenvolver, deixe `VITE_AULAS_URL` vazio.

## 3. GitHub

1. Crie um repositório chamado `missao-pf`. Ele pode ser privado, mas o GitHub Pages em repositório privado exige um plano pago. Se o seu plano for grátis, deixe o repositório público. A chave anon do Supabase é pública por natureza, porque quem protege os dados é o RLS.
2. Em **Settings > Secrets and variables > Actions**, crie:
   - **Secrets:** `ANDROID_KEYSTORE_B64` e `ANDROID_KEYSTORE_PASSWORD`, conforme o passo 4.
   - A URL do Supabase, a chave publishable e a URL das aulas ficam em `.env.production`. Esses valores são públicos por natureza.
3. Em **Settings > Pages**, escolha **Source: GitHub Actions**.
4. Faça o push para `main`. Dois workflows rodam:
   - **PWA no GitHub Pages** publica o site;
   - **APK Android** gera o APK, que fica em *Actions > (execução) > Artifacts > missao-pf-apk*.

## 4. Assinatura do APK (recomendado)

Sem keystore, o workflow gera um APK de debug com uma assinatura diferente a cada build. Nesse caso, para atualizar o app, você precisa desinstalar a versão antiga primeiro. Com uma keystore fixa, as atualizações instalam por cima.

Crie a keystore uma vez e guarde o arquivo e a senha em um lugar seguro:

```bash
keytool -genkeypair -v -keystore missao-pf.keystore -alias missaopf \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 missao-pf.keystore
```

Use a mesma senha para a store e para a chave. Depois, crie os secrets:

- `ANDROID_KEYSTORE_B64`: a saída do comando `base64`;
- `ANDROID_KEYSTORE_PASSWORD`: a senha.

## 5. Instalar no Android

1. Baixe o zip do artifact `missao-pf-apk` no celular e extraia o `.apk`.
2. Abra o arquivo e permita instalar de fontes desconhecidas quando o Android pedir.
3. Na primeira vez que iniciar o pomodoro, permita as notificações.

Se o aviso do timer atrasar com o celular parado, desative a otimização de bateria para o app em **Configurações > Apps > Missão PF > Bateria > Sem restrições**.

## 6. Aulas novas

As aulas não ficam presas no APK. Para publicar uma aula nova:

1. Crie o arquivo `public/aulas/<id>.html` seguindo o formato de `public/aulas/dc-01.html`:
   - seções `<section data-sec="Nome">` dentro de `<article>`;
   - flashcards e questões no `<script type="application/json" class="aula-data">`.
2. Adicione a aula em `public/aulas/index.json`.
3. Faça commit e push.

O GitHub Pages atualiza, e tanto o PC quanto o APK buscam as aulas de lá. Cada aula aberta fica guardada para uso offline. A cópia embutida no APK serve de reserva.

## Estrutura

```
index.html            markup das telas
src/main.js           lógica do app (ciclo, pomodoro, aulas, TAF, login)
src/sync.js           sincronização com o Supabase (offline-first, realtime)
src/native.js         notificações, status bar e botão voltar no Android
src/lessons.js        carregamento das aulas (remoto → embutido → cache)
src/style.css         tema escuro
public/aulas/         catálogo e aulas
supabase/schema.sql   tabela + RLS + realtime
android/              projeto Android (Capacitor)
```

Para gerar o APK localmente com Android Studio, rode `npm run build:android` e depois `npx cap open android`.
