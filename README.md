# Nexo Jurídico — Frontend

Portal React/TypeScript responsivo para advogados e clientes. Requer a API em https://github.com/nexosistemas0/juridico-api-main na branch `feat/portal-cliente-datajud`. Node.js 24.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Abra http://localhost:5173. Inicie a API separadamente na porta 3333 com DATABASE_URL configurada. O Vite encaminha /api para ela. Nenhuma credencial Supabase é necessária no navegador.

## Uso

Cadastre a conta de advogado, cadastre um cliente e compartilhe o link de ativação. O cliente cria a própria senha. Vincule um processo pelo número CNJ e use Consultar DataJud para importar movimentações. Cadastre audiências, envie documentos e converse na seção Mensagens.

Inclui login, cadastro, ativação, painel, clientes, processos, agenda, documentos privados, mensagens, notificações e perfil. Mensagens são consultadas a cada dez segundos enquanto a aba está visível; notificações push e assinatura eletrônica não estão implementadas. A sincronização DataJud é manual e depende da disponibilidade da base pública.

## Produção

```bash
npm run build
```

Sirva dist pela API usando FRONTEND_DIST ou por um proxy que encaminhe /api para ela. Frontend e API precisam estar na mesma origem HTTPS, inclusive para os cookies de sessão. Configure APP_ORIGIN na API. `vite preview` sozinho não substitui o servidor integrado.

Build TypeScript/Vite validado. Os testes de integração e autorização ficam no repositório da API. Não há contas ou senhas reais embutidas. A implantação pública e a validação ponta a ponta com banco real ainda estão pendentes.
