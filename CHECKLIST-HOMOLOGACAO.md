# Checklist de homologação do Escriba 0.3.0

Use somente conteúdo fictício e uma máquina virtual de teste autorizada.

## Identificação

| Item | Registro |
|---|---|
| Versão do Windows externo | |
| Navegador e versão | |
| Gateway remoto | |
| Sistema da máquina virtual | |
| Leiaute de teclado externo | |
| Leiaute de teclado remoto | |
| Data | |
| Responsável | |

## Inicialização

- [ ] Extrair o ZIP em uma pasta local.
- [ ] Executar `iniciar-escriba.bat`.
- [ ] Confirmar que o PowerShell permanece aberto sem erro.
- [ ] Confirmar abertura de `http://127.0.0.1:8765/`.
- [ ] Confirmar a indicação `Agente local disponível`.
- [ ] Confirmar que o modo remoto aparece habilitado.
- [ ] Confirmar que nenhuma permissão de clipboard é solicitada.

## Teste interno

- [ ] Selecionar `Teste no campo interno`.
- [ ] Carregar um exemplo fictício.
- [ ] Preparar a sessão.
- [ ] Confirmar contagens, blocos e alertas.
- [ ] Iniciar, pausar, retomar e cancelar o teste local.
- [ ] Confirmar que nenhuma execução do código ocorre.

## Destino remoto inicial

Use um editor de texto vazio dentro da máquina virtual.

- [ ] Abrir o editor remoto no navegador.
- [ ] Manter o Escriba e a sessão remota em abas ou janelas identificáveis.
- [ ] Selecionar `Janela remota autorizada`.
- [ ] Configurar contagem de 5 segundos e intervalo de 80 ms.
- [ ] Preparar um bloco de uma linha: `Teste Escriba 123`.
- [ ] Iniciar a digitação.
- [ ] Selecionar o editor remoto antes do fim da contagem.
- [ ] Confirmar que o texto aparece apenas no editor remoto.
- [ ] Confirmar conclusão e progresso de 100%.

## Caracteres e formatação

Validar, em blocos separados:

- [ ] letras maiúsculas e minúsculas;
- [ ] números;
- [ ] acentos e cedilha;
- [ ] sequência `ação, identificação, padrões, versão` sem caracteres corrompidos;
- [ ] aspas simples e duplas;
- [ ] parênteses, colchetes e chaves;
- [ ] barra, barra invertida e operadores;
- [ ] ponto, vírgula, dois-pontos e ponto e vírgula;
- [ ] quebras de linha;
- [ ] tabulações preservadas;
- [ ] tabulações convertidas em quatro espaços.

Compare visualmente a origem e o destino. Registre qualquer caractere divergente.

## Controles de segurança

- [ ] Iniciar sem sair da janela do Escriba e confirmar recusa do destino.
- [ ] Iniciar e selecionar uma aplicação que não seja navegador.
- [ ] Confirmar que a digitação não começa.
- [ ] Durante a digitação, mudar de janela.
- [ ] Confirmar pausa automática.
- [ ] Retomar e retornar ao destino original durante a contagem.
- [ ] Confirmar continuidade a partir do caractere correto.
- [ ] Retomar apontando para outra janela.
- [ ] Confirmar encerramento com erro.
- [ ] Pressionar `Esc` durante a contagem.
- [ ] Pressionar `Esc` durante a digitação.
- [ ] Confirmar cancelamento nos dois casos.
- [ ] Fechar o PowerShell e confirmar indisponibilidade do modo remoto.

## Aplicações corporativas

Executar apenas após a aprovação dos testes anteriores.

- [ ] Zeppelin, parágrafo fictício sem execução.
- [ ] Qlik Sense, seção fictícia sem recarga.
- [ ] SAS, programa fictício sem submissão.
- [ ] Confirmar que `Enter` não aciona execução inesperada.
- [ ] Confirmar que atalhos do editor não foram acionados.

## Resultado

| Item | Registro |
|---|---|
| Resultado geral | Aprovado / Reprovado / Aprovado com ressalvas |
| Caracteres divergentes | |
| Pausa automática | |
| Cancelamento por Esc | |
| Zeppelin | |
| Qlik Sense | |
| SAS | |
| Observações | |

O uso operacional permanece bloqueado se houver divergência de caracteres, digitação em destino incorreto, falha de cancelamento ou bloqueio do gateway.
