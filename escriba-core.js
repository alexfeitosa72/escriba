(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.EscribaCore = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROFILE_NAMES = Object.freeze({
    zeppelin: "Zeppelin",
    qlik: "Qlik Sense",
    sas: "SAS",
    generic: "Genérico"
  });

  function normalizeNewlines(text) {
    return String(text || "").replace(/\r\n?/g, "\n");
  }

  function countMatches(text, expression) {
    const matches = text.match(expression);
    return matches ? matches.length : 0;
  }

  function analyzeText(rawText) {
    const text = normalizeNewlines(rawText);
    const alerts = [];
    const addAlert = (id, label, count, severity) => {
      if (count > 0) alerts.push({ id, label, count, severity });
    };

    addAlert("tabs", "tabulações", countMatches(text, /\t/g), "warning");
    addAlert("nbsp", "espaços não separáveis", countMatches(text, /\u00a0/g), "warning");
    addAlert("zero-width", "caracteres invisíveis", countMatches(text, /[\u200b-\u200d\ufeff]/g), "danger");
    addAlert("smart-quotes", "aspas tipográficas", countMatches(text, /[\u2018\u2019\u201c\u201d]/g), "warning");
    addAlert("special-dashes", "traços especiais", countMatches(text, /[\u2013\u2014]/g), "warning");

    const possibleSecret = /\b(password|passwd|senha|token|api[_-]?key|secret)\b\s*[:=]/gi;
    const destructiveCommand = /\b(drop\s+(table|database)|truncate\s+table|delete\s+from)\b|\brm\s+-rf\b/gi;
    addAlert("possible-secret", "possíveis segredos", countMatches(text, possibleSecret), "danger");
    addAlert("destructive", "comandos sensíveis", countMatches(text, destructiveCommand), "danger");

    return {
      text,
      lines: text.length ? text.split("\n").length : 0,
      characters: Array.from(text).length,
      alerts
    };
  }

  function isPreferredBoundary(line, profile) {
    const trimmed = line.trim();
    if (trimmed === "") return true;
    if (profile === "qlik" || profile === "sas") return trimmed.endsWith(";");
    if (profile === "zeppelin") return /^%[a-zA-Z]+\b/.test(trimmed);
    return false;
  }

  function chooseEnd(lines, start, maximumEnd, profile) {
    if (maximumEnd >= lines.length) return lines.length;
    const minimumUsefulEnd = Math.min(start + 2, maximumEnd);

    for (let candidate = maximumEnd; candidate >= minimumUsefulEnd; candidate -= 1) {
      if (isPreferredBoundary(lines[candidate - 1], profile)) return candidate;
    }

    return maximumEnd;
  }

  function splitIntoBlocks(rawText, profile, requestedMaxLines) {
    const text = normalizeNewlines(rawText);
    if (!text.length) return [];

    const selectedProfile = Object.prototype.hasOwnProperty.call(PROFILE_NAMES, profile) ? profile : "generic";
    const maxLines = Math.max(2, Math.min(200, Number(requestedMaxLines) || 12));
    const lines = text.split("\n");
    const blocks = [];
    let start = 0;

    while (start < lines.length) {
      let maximumEnd = Math.min(start + maxLines, lines.length);

      if (selectedProfile === "zeppelin" && start === 0 && /^%[a-zA-Z]+\b/.test(lines[0].trim()) && maximumEnd === 1 && lines.length > 1) {
        maximumEnd = 2;
      }

      const end = chooseEnd(lines, start, maximumEnd, selectedProfile);
      const hasFollowingBlock = end < lines.length;
      const blockText = lines.slice(start, end).join("\n") + (hasFollowingBlock ? "\n" : "");

      blocks.push({
        id: blocks.length + 1,
        startLine: start + 1,
        endLine: end,
        lineCount: end - start,
        characterCount: Array.from(blockText).length,
        text: blockText
      });

      start = end;
    }

    return blocks;
  }

  function transformForTyping(rawText, tabMode) {
    const text = normalizeNewlines(rawText);
    if (tabMode === "keep") return text;
    const spaceCount = [2, 4, 8].includes(Number(tabMode)) ? Number(tabMode) : 4;
    return text.replace(/\t/g, " ".repeat(spaceCount));
  }

  function getProfileName(profile) {
    return PROFILE_NAMES[profile] || PROFILE_NAMES.generic;
  }

  return Object.freeze({
    analyzeText,
    getProfileName,
    normalizeNewlines,
    splitIntoBlocks,
    transformForTyping
  });
}));
