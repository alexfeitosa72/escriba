# Escriba 0.3.0

Protótipo portátil para preparar códigos e digitá-los, mediante comando explícito, em uma sessão remota autorizada aberta no navegador.

## Requisitos

- Windows 10 ou Windows 11.
- Windows PowerShell 5.1.
- Microsoft Edge, Google Chrome ou Mozilla Firefox.
- Escriba e navegador executados pelo mesmo usuário e com o mesmo nível de privilégio.
- Autorização institucional para homologar eventos sintéticos de teclado.

O protótipo não requer instalação de dependências nem acesso à internet.

## Executar no Windows

1. Extraia todo o conteúdo do arquivo ZIP para uma pasta local.
2. Dê dois cliques em `iniciar-escriba.bat`.
3. Mantenha aberta a janela do PowerShell iniciada pelo arquivo.
4. O navegador abrirá em `http://127.0.0.1:8765/`.
5. Confirme que a interface mostra `Agente local disponível`.

Se a política corporativa bloquear o script, não altere a política de execução. Solicite assinatura ou liberação do protótipo à equipe responsável.

Para usar apenas o teste interno, execute `iniciar-escriba-local.bat`.

## Primeira homologação

Use somente texto fictício e um editor sem dados sensíveis dentro da máquina virtual.

1. Abra a sessão remota no navegador.
2. No Escriba, escolha o perfil e o modo `Janela remota autorizada`.
3. Cole o texto, configure um bloco pequeno e selecione `Preparar sessão`.
4. Selecione `Iniciar digitação remota`.
5. Durante a contagem regressiva, ative o editor dentro da sessão remota.
6. Não troque de janela ou aba até a conclusão.
7. Pressione `Esc` para cancelar imediatamente.

O agente aceita como destino somente Edge, Chrome ou Firefox. A janela do próprio Escriba é recusada.

## Correção da versão 0.2.1

Esta versão corrige o tamanho da estrutura Win32 `INPUT` em Windows de 64 bits. Na versão 0.2.0, o agente identificava corretamente a janela remota, mas o Windows recusava a primeira tecla porque a estrutura enviada ao `SendInput` tinha tamanho incompatível.

## Correção da versão 0.3.0

Esta versão declara e decodifica explicitamente como UTF-8 o JSON enviado pela interface. A correção impede que caracteres como `ç`, `ã`, `õ` e símbolos Unicode sejam convertidos em sequências corrompidas durante a comunicação entre o navegador e o agente.

## Pausa e retomada

A digitação pausa automaticamente quando a janela ou o título de destino muda. Para retomar:

1. volte ao Escriba;
2. selecione `Retomar`;
3. durante os três segundos seguintes, retorne exatamente à janela e ao título originais.

Se o destino original não estiver ativo, o agente encerra o bloco com erro.

## Controles implementados

- colagem somente por ação explícita;
- contagem regressiva mínima de três segundos no modo remoto;
- lista fixa de navegadores autorizados;
- bloqueio pelo identificador e título da janela;
- pausa automática por mudança de foco;
- cancelamento pelo botão ou pela tecla `Esc`;
- limite de 200.000 caracteres por bloco;
- intervalos mínimos e máximos de digitação;
- servidor restrito a `127.0.0.1`;
- token aleatório por execução;
- nenhuma persistência do código;
- nenhuma leitura automática do clipboard;
- nenhuma captura de tela ou credenciais;
- nenhuma execução do código recebido.

## Compatibilidade prevista

- Microsoft Edge atual.
- Google Chrome atual.
- Mozilla Firefox atual.
- Teclado ABNT2 com o mesmo leiaute no Windows externo e na máquina virtual.

A compatibilidade com o gateway remoto deve ser confirmada pelo checklist de homologação.

## Arquivos principais

| Arquivo | Função |
|---|---|
| `index.html` | Interface do Escriba |
| `app.js` | Controle dos modos local e remoto |
| `escriba-core.js` | Análise e segmentação do texto |
| `escriba-agent.ps1` | Agente Windows e servidor local |
| `iniciar-escriba.bat` | Inicialização do modo remoto |
| `iniciar-escriba-local.bat` | Inicialização do teste interno |
| `SECURITY.md` | Controles, limites e riscos |
| `CHECKLIST-HOMOLOGACAO.md` | Roteiro de validação em ambiente autorizado |

## Limites desta versão

O envio real de teclas não pôde ser executado no ambiente Linux usado para construir o pacote. O agente deve ser homologado em Windows antes de qualquer uso operacional.

Se o navegador ou o gateway remoto rejeitar eventos sintéticos, o Escriba interromperá o processo. O protótipo não contém mecanismo para contornar esse bloqueio.
