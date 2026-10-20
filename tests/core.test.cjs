"use strict";

const assert = require("node:assert/strict");
const core = require("../escriba-core.js");

function test(name, action) {
  try {
    action();
    process.stdout.write(`OK  ${name}\n`);
  } catch (error) {
    process.stderr.write(`ERRO ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

test("normaliza quebras de linha", () => {
  assert.equal(core.normalizeNewlines("a\r\nb\rc"), "a\nb\nc");
});

test("mantém o conteúdo ao segmentar", () => {
  const source = "%pyspark\na = 1\n\nb = 2\nprint(a + b)\n";
  const blocks = core.splitIntoBlocks(source, "zeppelin", 3);
  assert.equal(blocks.map((block) => block.text).join(""), source);
});

test("prefere terminador no perfil Qlik", () => {
  const source = "SET A=1;\nSET B=2;\nLOAD *\nFROM origem;\nNEXT";
  const blocks = core.splitIntoBlocks(source, "qlik", 3);
  assert.equal(blocks[0].endLine, 2);
});

test("identifica caracteres e padrões de alerta", () => {
  const result = core.analyzeText("senha='teste'\t\u200b\nDROP TABLE x;");
  const ids = result.alerts.map((alert) => alert.id);
  assert.ok(ids.includes("tabs"));
  assert.ok(ids.includes("zero-width"));
  assert.ok(ids.includes("possible-secret"));
  assert.ok(ids.includes("destructive"));
});

test("converte tabulações quando configurado", () => {
  assert.equal(core.transformForTyping("a\tb", "4"), "a    b");
  assert.equal(core.transformForTyping("a\tb", "keep"), "a\tb");
});

test("usa perfil genérico quando o perfil é desconhecido", () => {
  const blocks = core.splitIntoBlocks("a\nb\nc", "desconhecido", 2);
  assert.equal(blocks.length, 2);
  assert.equal(core.getProfileName("desconhecido"), "Genérico");
});

if (process.exitCode) process.exit(process.exitCode);
