"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function test(name, action) {
  try {
    action();
    process.stdout.write(`OK  ${name}\n`);
  } catch (error) {
    process.stderr.write(`ERRO ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

test("carrega a configuração do agente antes da aplicação", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('src="agent-config.js"') < html.indexOf('src="app.js"'));
});

test("restringe conexões da interface à própria origem", () => {
  assert.match(read("index.html"), /connect-src 'self'/);
});

test("mantém o modo remoto desabilitado sem agente", () => {
  assert.match(read("index.html"), /id="remoteModeOption"[^>]+disabled/);
  assert.match(read("agent-config.js"), /available:\s*false/);
});

test("agente escuta apenas no loopback", () => {
  const agent = read("escriba-agent.ps1");
  assert.match(agent, /http:\/\/127\.0\.0\.1:/);
  assert.doesNotMatch(agent, /http:\/\/\*:/);
});

test("agente valida processo, janela e cancelamento", () => {
  const agent = read("escriba-agent.ps1");
  assert.match(agent, /msedge.*chrome.*firefox/);
  assert.match(agent, /GetForegroundWindow/);
  assert.match(agent, /GetWindowTitle/);
  assert.match(agent, /EscapePressed/);
  assert.match(agent, /PauseRequested/);
});

test("estrutura Win32 contempla o tamanho nativo de 64 bits", () => {
  const agent = read("escriba-agent.ps1");
  assert.match(agent, /struct MOUSEINPUT/);
  assert.match(agent, /struct HARDWAREINPUT/);
  assert.match(agent, /expectedInputSize.*40.*28/);
  assert.match(agent, /GetInputStructureSize/);
  assert.match(agent, /GetLastError/);
});

test("interface e agente usam UTF-8 explicitamente", () => {
  assert.match(read("app.js"), /application\/json; charset=utf-8/);
  assert.match(read("escriba-agent.ps1"), /StreamReader.*Text\.Encoding\]::UTF8/);
  assert.doesNotMatch(read("escriba-agent.ps1"), /StreamReader.*ContentEncoding/);
});

test("não lê o clipboard nem persiste o conteúdo digitado", () => {
  const source = [read("app.js"), read("escriba-agent.ps1")].join("\n");
  assert.doesNotMatch(source, /sessionStorage|readText\s*\(|Get-Clipboard/i);
  const app = read("app.js");
  const fields = app.match(/persistedFields = \[([^\]]+)\]/)[1];
  assert.doesNotMatch(fields, /sourceText|testTarget/);
});

test("agente em PowerShell 5.1 tem BOM UTF-8 para preservar acentos", () => {
  const bytes = fs.readFileSync(path.join(root, "escriba-agent.ps1"));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("limpeza de recuo automático é enviada ao agente", () => {
  assert.match(read("app.js"), /clearAutoIndent/);
  assert.match(read("escriba-agent.ps1"), /SelectToLineStart/);
});

if (process.exitCode) process.exit(process.exitCode);
