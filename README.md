# Martins Advogados — aplicativo React Native

Aplicativo nativo Android/iOS com Expo SDK 58, React Native 0.88 e TypeScript. A raiz agora é o app para celular. O portal React/Vite anterior permanece em `web/`, também com a marca Martins Advogados. O aplicativo não é um WebView.

## Requisitos

- Node.js 24, npm e a API `nexosistemas0/juridico-api-main` com a branch `feat/martins-mobile-auth` ou sua versão integrada.
- Para compilar Android localmente: Android Studio, SDK Android e JDK compatíveis com React Native 0.88. Para iOS: macOS e Xcode compatíveis com Expo SDK 58.
- Use um development build. Não dependa de compatibilidade do Expo Go instalado na loja. Configuração nativa: https://docs.expo.dev/guides/local-app-development/ e https://docs.expo.dev/develop/development-builds/create-a-build/.

## Testar no Windows / Android

1. Atualize e inicie a API na porta 3333 com seu DATABASE_URL privado. A API já escuta em 0.0.0.0.
2. Na raiz deste repositório:

```powershell
npm ci
Copy-Item .env.example .env
```

3. Edite `.env`. No celular físico, use o IPv4 do computador obtido com `ipconfig`, na mesma rede Wi-Fi:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:3333/api
```

Troque pelo seu IP. No emulador padrão do Android Studio, use `http://10.0.2.2:3333/api`. No simulador iOS, use `http://127.0.0.1:3333/api`. O localhost do celular é o próprio celular. Libere a porta 3333 no firewall apenas na rede privada de testes. Não coloque DATABASE_URL, senha Supabase, JWT_SECRET_KEY ou service_role no app. EXPO_PUBLIC_API_URL é pública e incorporada ao bundle.

4. Com emulador Android aberto ou celular conectado por USB e depuração habilitada:

```powershell
npm run android -- --device
```

Isso compila e instala um development build usando o SDK Android local. Depois de instalado, para iniciar o servidor JavaScript:

```powershell
npm start
```

Abra o development build Martins Advogados e conecte ao servidor mostrado pelo Expo. Após mudar o .env, reinicie com `npx expo start --clear`. No macOS, `npm run ios` compila para iOS. A execução iOS não é feita diretamente no Windows.

## APK e distribuição

`eas.json` contém development, preview (APK Android) e production. Com conta Expo e projeto EAS configurados, use `npx eas-cli build --platform android --profile preview`. Configure EXPO_PUBLIC_API_URL HTTPS no ambiente do build antes de compilar; trocar a URL exige novo bundle/build. Para produção iOS são necessários os dados e a assinatura Apple. Os identificadores `br.com.martinsadvogados.app` devem ser confirmados pelo proprietário antes da publicação nas lojas.

Não foi gerado APK/IPA nem executado build remoto nesta entrega. `npm run build` exporta bundles JavaScript/Hermes Android e iOS; não substitui a compilação nativa ou teste físico.

## Funcionalidades

- Login, cadastro de advogado e ativação de cliente por convite.
- Painel distinto por perfil; cliente vê somente processos vinculados.
- Cadastro e edição de clientes, geração e compartilhamento de convites.
- Consulta DataJud por número CNJ, vínculo de processo, sincronização manual, edição e arquivamento por status.
- Linha do tempo com fonte oficial/manualmente registrada e edição/exclusão de orientações manuais.
- Agenda, criação/edição/cancelamento de audiências e abertura de sala HTTPS.
- Seleção nativa de PDF/PNG/JPEG até 5 MiB; download autenticado e compartilhamento pelo sistema operacional.
- Conversas por processo, mensagens anteriores, atualização a cada 10 segundos enquanto o app está ativo.
- Notificações, leitura/exclusão, edição do perfil e alteração de senha.

## Convite e segurança

O advogado compartilha um link `martinsadvogados://ativar?token=...` e um código. Se o aparelho não abrir o link, abra o app → Sou cliente · tenho um convite e cole o código ou o link web antigo. O scheme exige app nativo instalado; não é universal link verificado.

Sessões opacas de 24h ficam no SecureStore do aparelho. O servidor armazena só o hash e autoriza os vínculos; troca de senha revoga sessões anteriores. Requisições usam Authorization: Bearer, sem cookies. A versão web continua usando cookies HttpOnly. Produção exige HTTPS. Nenhuma mudança no esquema Supabase é necessária nesta versão.

Downloads usam cache temporário, apagado ao concluir o compartilhamento; uma cópia exportada voluntariamente pelo usuário passa a ser gerenciada pelo app escolhido. Uploads usam cópia temporária do seletor. Token não é incluído em URL de documento, logs ou AsyncStorage.

## Validação e limites

```bash
npm run typecheck
npm test
npm run build
```

CI executa TypeScript, testes de convite/configuração, exportação Android/iOS e build do portal web. A API tem testes de sessão mobile, rotação, revogação e compatibilidade web. Validação no aparelho físico, teclado, permissões, download/compartilhamento e deep links ainda é necessária. O ambiente de desenvolvimento desta entrega não tem emulador Android/iOS.

Sem assinatura eletrônica, push, monitoramento DataJud automático ou recuperação de senha por e-mail. A consulta real DataJud permanece pendente. Sem dados fictícios nas telas do aplicativo.

## Portal web anterior

```bash
cd web
npm ci
npm run dev
```

A API precisa permitir a origem web em APP_ORIGIN. App nativo não envia Origin de navegador; não é necessário desabilitar CORS. Para servir o portal compilado pela API, FRONTEND_DIST agora aponta para `../juridico-app/web/dist`.
