# Relatório de validação. Escriba 0.3.0

## Escopo

Validação estática e automatizada do protótipo com agente Windows para digitação controlada em navegador.

## Verificações concluídas

- sintaxe dos arquivos JavaScript;
- testes da lógica de análise e segmentação;
- preservação integral do texto após segmentação;
- divisão preferencial por terminadores;
- identificação de caracteres invisíveis, possíveis segredos e comandos sensíveis;
- tratamento configurável de tabulações;
- unicidade dos identificadores HTML;
- modo local preservado;
- modo remoto condicionado à presença do agente;
- token aleatório por execução;
- servidor restrito a `127.0.0.1`;
- lista fixa de navegadores autorizados;
- validação de janela e título;
- pausa por mudança de destino;
- contagem mínima de três segundos;
- cancelamento por `Esc`;
- validação do tamanho nativo da estrutura Win32 `INPUT` em arquiteturas de 32 e 64 bits;
- declaração e decodificação explícitas do corpo JSON em UTF-8;
- ausência de armazenamento do conteúdo;
- ausência de leitura automática do clipboard.

## Resultado automatizado

Os testes JavaScript e as verificações estruturais executadas no ambiente de desenvolvimento foram aprovados.

## Limitação do ambiente de desenvolvimento

O ambiente de construção é Linux e não possui Windows PowerShell, `user32.dll`, navegador Windows nem acesso ao gateway remoto do usuário. Portanto, não foi possível executar o agente ou confirmar o encaminhamento real de teclas.

A implementação PowerShell e a integração com o navegador devem ser verificadas em Windows por meio de `CHECKLIST-HOMOLOGACAO.md`.

## Conclusão

O pacote está apto para homologação controlada em uma estação Windows autorizada. Ainda não está aprovado para uso operacional ou com dados reais.
