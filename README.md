# Solicitação de NF - Pontes Máquinas

Aplicação web para solicitar, aprovar e acompanhar Notas Fiscais.

## 1. Supabase

Execute `supabase/migration.sql` no **SQL Editor** do Supabase.

No Supabase, habilite **Authentication > Providers > Email** e crie o usuário:

- E-mail: `financeiro@pontesmaquinas.com.br`
- Senha: `pontes`
- Marque **Auto Confirm User**

O perfil administrador é atribuído automaticamente pelo gatilho da migration.

## 2. Aplicação

```bash
npm install
npm run dev
```

Para produção, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
