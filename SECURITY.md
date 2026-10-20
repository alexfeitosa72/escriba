# Segurança do Escriba 0.3.0

## Escopo autorizado

Esta versão é um protótipo de homologação. Ela pode gerar eventos de teclado para uma sessão remota aberta em Edge, Chrome ou Firefox, somente após comando explícito do usuário.

O protótipo não deve ser usado com dados reais antes da aprovação do checklist de homologação e das exigências institucionais aplicáveis.

## Fronteira de funcionamento

O agente é executado na estação Windows externa. Ele envia teclas à janela do navegador em primeiro plano. O gateway remoto é responsável por encaminhá-las à máquina virtual.

O agente não se autentica no portal, não lê credenciais, não acessa o conteúdo da tela e não interage com APIs internas do ambiente seguro.

## Controles implementados

- servidor vinculado exclusivamente a `127.0.0.1`;
- token aleatório de 256 bits gerado a cada execução;
- rejeição de origens diferentes da interface local;
- lista fixa de processos autorizados: Edge, Chrome e Firefox;
- rejeição da janela cujo título contenha `Escriba`;
- bloqueio do identificador e do título da janela selecionada;
- pausa automática quando foco ou título mudam;
- contagem regressiva mínima de três segundos;
- cancelamento por `Esc` e pela interface;
- limites de tamanho e velocidade;
- privilégios comuns de usuário;
- nenhuma leitura automática do clipboard;
- nenhuma persistência do código, telemetria ou analytics;
- nenhuma execução ou interpretação do conteúdo;
- nenhuma captura de tela, senha ou conteúdo da sessão remota.

## Comportamento seguro

- Se o Windows recusar um evento de teclado, o bloco é interrompido.
- Se o destino não for um navegador autorizado, o bloco não começa.
- Se a janela mudar durante a digitação, o agente pausa.
- Se a janela original não estiver ativa na retomada, o agente encerra com erro.
- Se `Esc` for pressionado, o agente cancela o bloco.

A tecla `Esc` pode também ser recebida pela aplicação remota antes da interrupção. Por isso, a primeira homologação deve ocorrer em um editor sem dados sensíveis.

## Restrições operacionais

- Não executar o Escriba como administrador.
- Não executar o navegador como administrador.
- Não adicionar outros processos à lista autorizada sem nova revisão.
- Não desabilitar verificações de foco ou título.
- Não alterar a política do PowerShell para executar o protótipo.
- Não utilizar o protótipo para inserir credenciais, segredos ou dados pessoais.
- Não prosseguir se o gateway bloquear eventos sintéticos.

## Limites

- Os alertas de segredo e comandos sensíveis são heurísticos.
- A limpeza da interface não garante eliminação forense da memória.
- O protótipo não confirma que o texto recebido no destino é idêntico ao original.
- Mudanças legítimas no título da página podem provocar pausa preventiva.
- O mapeamento de caracteres depende dos leiautes de teclado da estação e da máquina virtual.
- O agente ainda não é um binário assinado nem possui instalador corporativo.

## Evolução recomendada

Depois da homologação funcional:

1. revisão do código pela segurança;
2. assinatura do agente;
3. definição formal dos navegadores e títulos autorizados;
4. auditoria apenas de metadados aprovados, nunca do conteúdo;
5. distribuição por canal corporativo;
6. teste de regressão em atualizações do navegador e do gateway remoto.
