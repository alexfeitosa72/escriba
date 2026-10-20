(function () {
  "use strict";

  const core = window.EscribaCore;
  const agentConfig = window.EscribaAgentConfig || { available: false, token: "" };
  const elements = {};
  const state = {
    blocks: [],
    selectedBlock: 0,
    preparedText: "",
    status: "idle",
    timer: null,
    countdownTimer: null,
    statusTimer: null,
    typingText: "",
    typingPosition: 0,
    agentAvailable: Boolean(agentConfig.available && agentConfig.token)
  };

  const samples = {
    zeppelin: `%pyspark\nconsulta = hive.sql("""\n    SELECT id_requerimento, id_pescador\n    FROM arf_base_inicial\n    WHERE id_pescador IS NOT NULL\n""")\n\nconsulta.createOrReplaceTempView("arf_resultado")`,
    qlik: `SET DecimalSep=',';\nSET ThousandSep='.';\n\n[PAINEL_TOTAIS]:\nLOAD\n    Num#([COMPETENCIA]) AS [tot_COMPETENCIA],\n    Num#([VALOR_TOTAL], '#.##0,00') AS [tot_VALOR_TOTAL];`,
    sas: `data trabalho.resultado;\n    set trabalho.origem;\n    if valor_total > 0;\nrun;\n\nproc sql;\n    select count(*) as quantidade\n    from trabalho.resultado;\nquit;`,
    generic: `Primeira linha de teste.\nSegunda linha com acentuação: ação, código e informação.\nTerceira linha com símbolos: ( ) [ ] { } ; : / \\\.`
  };

  function cacheElements() {
    [
      "sourceText", "profile", "executionMode", "remoteModeOption", "maxLines", "keyDelay",
      "keyDelayOutput", "lineDelay", "lineDelayOutput", "countdown", "tabMode", "prepareButton",
      "sampleButton", "lineCount", "charCount", "alertCount", "blockCount", "alerts", "blockList",
      "blockPosition", "previewTitle", "codePreview", "showWhitespace", "testTarget", "clearTargetButton",
      "sessionStatus", "progressBar", "progressText", "previousButton", "nextButton", "clearSessionButton",
      "pauseButton", "cancelButton", "startButton", "agentBadge", "noticeTitle", "noticeText",
      "destinationTitle", "remoteInstructions", "targetMetadata", "autoIndent"
    ].forEach((id) => { elements[id] = document.getElementById(id); });
  }

  const SETTINGS_KEY = "escriba.settings.v1";
  const persistedFields = ["executionMode", "profile", "maxLines", "keyDelay", "lineDelay", "countdown", "tabMode", "autoIndent"];

  function loadSettings() {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY)); } catch (error) { return; }
    if (!saved || typeof saved !== "object") return;

    persistedFields.forEach((id) => {
      const element = elements[id];
      if (!element || typeof saved[id] !== "string") return;
      const previous = element.value;
      element.value = saved[id];
      // Valor inexistente nas opções de um select (ou fora do intervalo) é descartado.
      if (element.tagName === "SELECT" && element.value !== saved[id]) element.value = previous;
    });
    elements.keyDelayOutput.value = `${elements.keyDelay.value} ms`;
    elements.lineDelayOutput.value = `${elements.lineDelay.value} ms`;
  }

  function saveSettings() {
    const settings = {};
    persistedFields.forEach((id) => { settings[id] = String(elements[id].value); });
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (error) { /* armazenamento indisponível */ }
  }

  function isRemoteMode() {
    return elements.executionMode.value === "remote" && state.agentAvailable;
  }

  function setStatus(status, message) {
    state.status = status;
    elements.sessionStatus.className = `session-status ${status}`;
    elements.sessionStatus.textContent = message;
    updateControls();
  }

  function updateControls() {
    const hasBlocks = state.blocks.length > 0;
    const busy = ["typing", "preparing"].includes(state.status);
    const paused = state.status === "paused";

    elements.startButton.disabled = !hasBlocks || busy || paused;
    elements.pauseButton.disabled = !(state.status === "typing" || paused);
    elements.pauseButton.textContent = paused ? "Retomar" : "Pausar";
    elements.cancelButton.disabled = !(busy || paused);
    elements.previousButton.disabled = !hasBlocks || busy || paused || state.selectedBlock <= 0;
    elements.nextButton.disabled = !hasBlocks || busy || paused || state.selectedBlock >= state.blocks.length - 1;
    elements.prepareButton.disabled = busy || paused;
    elements.executionMode.disabled = busy || paused;
  }

  function configureAgent() {
    elements.remoteModeOption.disabled = !state.agentAvailable;
    elements.agentBadge.classList.toggle("available", state.agentAvailable);
    elements.agentBadge.lastChild.textContent = state.agentAvailable ? " Agente local disponível" : " Agente não detectado";

    if (state.agentAvailable) {
      elements.noticeTitle.textContent = "Digitação remota disponível para homologação";
      elements.noticeText.textContent = "Use somente conteúdo fictício na primeira validação. A janela ativa será bloqueada como destino ao final da contagem regressiva.";
    } else {
      elements.noticeTitle.textContent = "Destino restrito ao campo de teste";
      elements.noticeText.textContent = "Abra o Escriba pelo inicializador remoto para habilitar o agente Windows. O modo local continua disponível.";
    }
  }

  function updateModePresentation() {
    if (elements.executionMode.value === "remote" && !state.agentAvailable) {
      elements.executionMode.value = "local";
    }

    const remote = isRemoteMode();
    elements.destinationTitle.textContent = remote ? "Janela remota selecionada após a contagem" : "Campo de teste interno";
    elements.testTarget.hidden = remote;
    elements.testTarget.classList.toggle("remote-disabled", remote);
    elements.remoteInstructions.hidden = !remote;
    elements.clearTargetButton.hidden = remote;
    elements.startButton.textContent = remote ? "Iniciar digitação remota" : "Iniciar teste local";
    elements.countdown.querySelector('option[value="0"]').disabled = remote;
    if (remote && Number(elements.countdown.value) < 3) elements.countdown.value = "3";
    setStatus("idle", state.blocks.length ? "Sessão preparada" : "Inativo");
  }

  function updateLiveMetrics() {
    const analysis = core.analyzeText(elements.sourceText.value);
    elements.lineCount.textContent = analysis.lines;
    elements.charCount.textContent = analysis.characters;
    elements.alertCount.textContent = analysis.alerts.length;
    if (state.preparedText !== analysis.text) elements.blockCount.textContent = "0";
  }

  function renderAlerts(alerts) {
    elements.alerts.replaceChildren();
    if (!alerts.length) {
      const clean = document.createElement("span");
      clean.className = "alert-chip";
      clean.textContent = "Nenhum alerta visual identificado";
      elements.alerts.appendChild(clean);
      return;
    }

    alerts.forEach((alert) => {
      const chip = document.createElement("span");
      chip.className = `alert-chip ${alert.severity}`;
      chip.textContent = `${alert.count} ${alert.label}`;
      elements.alerts.appendChild(chip);
    });
  }

  function prepareSession() {
    stopLocalTimers();
    const analysis = core.analyzeText(elements.sourceText.value);
    if (!analysis.text.length) {
      renderAlerts([{ label: "conteúdo vazio", count: 1, severity: "warning" }]);
      elements.sourceText.focus();
      setStatus("idle", "Aguardando conteúdo");
      return;
    }

    state.preparedText = analysis.text;
    state.blocks = core.splitIntoBlocks(analysis.text, elements.profile.value, elements.maxLines.value);
    state.selectedBlock = 0;
    state.typingPosition = 0;
    elements.testTarget.value = "";

    elements.lineCount.textContent = analysis.lines;
    elements.charCount.textContent = analysis.characters;
    elements.alertCount.textContent = analysis.alerts.length;
    elements.blockCount.textContent = state.blocks.length;
    renderAlerts(analysis.alerts);
    renderBlockList();
    selectBlock(0);
    setStatus("idle", "Sessão preparada");
  }

  function renderBlockList() {
    elements.blockList.replaceChildren();
    state.blocks.forEach((block, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "block-item";
      button.dataset.index = String(index);

      const title = document.createElement("strong");
      title.textContent = `Bloco ${block.id}`;
      const metadata = document.createElement("small");
      metadata.textContent = `Linhas ${block.startLine} a ${block.endLine} · ${block.characterCount} caracteres`;

      button.append(title, metadata);
      button.addEventListener("click", () => {
        if (!["typing", "preparing", "paused"].includes(state.status)) selectBlock(index);
      });
      elements.blockList.appendChild(button);
    });
  }

  function selectBlock(index) {
    if (!state.blocks.length) return;
    state.selectedBlock = Math.max(0, Math.min(state.blocks.length - 1, index));
    state.typingPosition = 0;

    const block = state.blocks[state.selectedBlock];
    elements.blockPosition.textContent = `${state.selectedBlock + 1} / ${state.blocks.length}`;
    elements.previewTitle.textContent = `Bloco ${block.id} · linhas ${block.startLine} a ${block.endLine}`;

    Array.from(elements.blockList.querySelectorAll(".block-item")).forEach((item, itemIndex) => {
      item.classList.toggle("active", itemIndex === state.selectedBlock);
      if (itemIndex === state.selectedBlock) item.scrollIntoView({ block: "nearest" });
    });

    renderCodePreview();
    updateProgress(0, block.characterCount);
    updateControls();
  }

  function renderCodePreview() {
    elements.codePreview.replaceChildren();
    if (!state.blocks.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "O conteúdo preparado aparecerá aqui.";
      elements.codePreview.appendChild(empty);
      return;
    }

    const block = state.blocks[state.selectedBlock];
    const lines = block.text.replace(/\n$/, "").split("\n");
    lines.forEach((line, offset) => {
      const row = document.createElement("div");
      row.className = "code-line";
      const number = document.createElement("span");
      number.className = "line-number";
      number.textContent = String(block.startLine + offset);
      const content = document.createElement("span");
      content.className = "line-content";
      content.textContent = elements.showWhitespace.checked
        ? line.replace(/ /g, "·").replace(/\t/g, "→   ")
        : line || " ";
      row.append(number, content);
      elements.codePreview.appendChild(row);
    });
  }

  function startLocalTest() {
    if (!state.blocks.length || state.status === "typing") return;
    const block = state.blocks[state.selectedBlock];
    state.typingText = core.transformForTyping(block.text, elements.tabMode.value);
    state.typingPosition = 0;
    updateProgress(0, state.typingText.length);

    const seconds = Number(elements.countdown.value) || 0;
    if (seconds <= 0) {
      beginLocalTyping();
      return;
    }

    let remaining = seconds;
    setStatus("preparing", `Início em ${remaining}s`);
    state.countdownTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        beginLocalTyping();
      } else {
        setStatus("preparing", `Início em ${remaining}s`);
      }
    }, 1000);
  }

  function beginLocalTyping() {
    elements.testTarget.focus();
    setStatus("typing", `Digitando bloco ${state.selectedBlock + 1}`);
    typeNextLocalCharacter();
  }

  function typeNextLocalCharacter() {
    if (state.status !== "typing") return;
    if (state.typingPosition >= state.typingText.length) {
      updateProgress(state.typingText.length, state.typingText.length);
      setStatus("completed", `Bloco ${state.selectedBlock + 1} concluído`);
      return;
    }

    const character = state.typingText[state.typingPosition];
    elements.testTarget.value += character;
    state.typingPosition += 1;
    elements.testTarget.scrollTop = elements.testTarget.scrollHeight;
    updateProgress(state.typingPosition, state.typingText.length);

    const baseDelay = Number(elements.keyDelay.value) || 35;
    const delay = character === "\n" ? baseDelay + (Number(elements.lineDelay.value) || 0) : baseDelay;
    state.timer = window.setTimeout(typeNextLocalCharacter, delay);
  }

  async function agentRequest(path, method = "GET", body) {
    const options = {
      method,
      cache: "no-store",
      headers: { "X-Escriba-Token": agentConfig.token }
    };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json; charset=utf-8";
      options.body = JSON.stringify(body);
    }

    const response = await window.fetch(path, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha de comunicação com o agente local.");
    return result;
  }

  async function startRemoteTyping() {
    if (!state.agentAvailable || !state.blocks.length) return;
    const block = state.blocks[state.selectedBlock];
    state.typingText = core.transformForTyping(block.text, elements.tabMode.value);
    state.typingPosition = 0;
    updateProgress(0, state.typingText.length);
    elements.targetMetadata.textContent = "Selecione o editor remoto antes do fim da contagem.";

    try {
      const remoteState = await agentRequest("/api/start", "POST", {
        text: state.typingText,
        keyDelay: Number(elements.keyDelay.value),
        lineDelay: Number(elements.lineDelay.value),
        countdown: Math.max(3, Number(elements.countdown.value) || 3),
        clearAutoIndent: elements.autoIndent.value === "clear"
      });
      applyRemoteState(remoteState);
      beginStatusPolling();
    } catch (error) {
      setStatus("error", error.message);
    }
  }

  function beginStatusPolling() {
    stopStatusPolling();
    state.statusTimer = window.setInterval(pollAgentStatus, 250);
  }

  function stopStatusPolling() {
    if (state.statusTimer) window.clearInterval(state.statusTimer);
    state.statusTimer = null;
  }

  async function pollAgentStatus() {
    try {
      applyRemoteState(await agentRequest("/api/status"));
    } catch (error) {
      stopStatusPolling();
      setStatus("error", error.message);
    }
  }

  function applyRemoteState(remoteState) {
    const statusMap = {
      idle: "idle",
      countdown: "preparing",
      typing: "typing",
      paused: "paused",
      cancelled: "cancelled",
      completed: "completed",
      error: "error"
    };
    const status = statusMap[remoteState.status] || "error";
    state.typingPosition = Number(remoteState.position) || 0;
    updateProgress(state.typingPosition, Number(remoteState.total) || state.typingText.length);
    setStatus(status, remoteState.message || "Estado do agente desconhecido");

    if (remoteState.targetTitle) {
      elements.targetMetadata.textContent = `Destino fixado: ${remoteState.targetProcess} · ${remoteState.targetTitle}`;
    }
    if (["cancelled", "completed", "error", "idle"].includes(remoteState.status)) stopStatusPolling();
  }

  async function togglePause() {
    if (isRemoteMode()) {
      try {
        const path = state.status === "paused" ? "/api/resume" : "/api/pause";
        applyRemoteState(await agentRequest(path, "POST"));
        beginStatusPolling();
      } catch (error) {
        setStatus("error", error.message);
      }
      return;
    }

    if (state.status === "typing") {
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = null;
      setStatus("paused", `Pausado no caractere ${state.typingPosition}`);
      return;
    }
    if (state.status === "paused") {
      setStatus("typing", `Retomando bloco ${state.selectedBlock + 1}`);
      typeNextLocalCharacter();
    }
  }

  async function cancelTyping() {
    if (isRemoteMode() && state.agentAvailable) {
      try {
        applyRemoteState(await agentRequest("/api/cancel", "POST"));
        beginStatusPolling();
      } catch (error) {
        setStatus("error", error.message);
      }
      return;
    }
    stopLocalTimers();
    setStatus("cancelled", `Cancelado no caractere ${state.typingPosition}`);
  }

  function stopLocalTimers() {
    if (state.timer) window.clearTimeout(state.timer);
    if (state.countdownTimer) window.clearInterval(state.countdownTimer);
    state.timer = null;
    state.countdownTimer = null;
  }

  function updateProgress(position, total) {
    const percentage = total > 0 ? Math.min(100, Math.round((position / total) * 100)) : 0;
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressText.textContent = `${percentage}%`;
  }

  function clearSession() {
    if (isRemoteMode() && ["typing", "preparing", "paused"].includes(state.status)) {
      void agentRequest("/api/cancel", "POST").catch(() => {});
    }
    stopLocalTimers();
    stopStatusPolling();
    state.blocks = [];
    state.selectedBlock = 0;
    state.preparedText = "";
    state.typingText = "";
    state.typingPosition = 0;
    elements.sourceText.value = "";
    elements.testTarget.value = "";
    elements.alerts.replaceChildren();
    elements.blockList.innerHTML = '<p class="empty-state">Prepare uma sessão para visualizar os blocos.</p>';
    elements.codePreview.innerHTML = '<p class="empty-state">O conteúdo preparado aparecerá aqui.</p>';
    elements.blockPosition.textContent = "0 / 0";
    elements.previewTitle.textContent = "Nenhum bloco selecionado";
    elements.targetMetadata.textContent = "O destino será identificado ao final da contagem regressiva.";
    [elements.lineCount, elements.charCount, elements.alertCount, elements.blockCount].forEach((element) => { element.textContent = "0"; });
    updateProgress(0, 0);
    setStatus("idle", "Inativo");
    elements.sourceText.focus();
  }

  function bindEvents() {
    persistedFields.forEach((id) => {
      elements[id].addEventListener("change", saveSettings);
      elements[id].addEventListener("input", saveSettings);
    });
    elements.sourceText.addEventListener("input", updateLiveMetrics);
    elements.profile.addEventListener("change", () => {
      if (state.blocks.length) prepareSession();
    });
    elements.executionMode.addEventListener("change", updateModePresentation);
    elements.keyDelay.addEventListener("input", () => { elements.keyDelayOutput.value = `${elements.keyDelay.value} ms`; });
    elements.lineDelay.addEventListener("input", () => { elements.lineDelayOutput.value = `${elements.lineDelay.value} ms`; });
    elements.showWhitespace.addEventListener("change", renderCodePreview);
    elements.prepareButton.addEventListener("click", prepareSession);
    elements.sampleButton.addEventListener("click", () => {
      elements.sourceText.value = samples[elements.profile.value] || samples.generic;
      updateLiveMetrics();
      elements.sourceText.focus();
    });
    elements.startButton.addEventListener("click", () => {
      if (isRemoteMode()) void startRemoteTyping();
      else startLocalTest();
    });
    elements.pauseButton.addEventListener("click", () => { void togglePause(); });
    elements.cancelButton.addEventListener("click", () => { void cancelTyping(); });
    elements.clearSessionButton.addEventListener("click", clearSession);
    elements.clearTargetButton.addEventListener("click", () => { elements.testTarget.value = ""; });
    elements.previousButton.addEventListener("click", () => selectBlock(state.selectedBlock - 1));
    elements.nextButton.addEventListener("click", () => selectBlock(state.selectedBlock + 1));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && ["typing", "preparing", "paused"].includes(state.status)) {
        event.preventDefault();
        void cancelTyping();
      }
    });

    window.addEventListener("beforeunload", () => {
      stopLocalTimers();
      stopStatusPolling();
      if (isRemoteMode() && ["typing", "preparing", "paused"].includes(state.status)) {
        void window.fetch("/api/cancel", {
          method: "POST",
          headers: { "X-Escriba-Token": agentConfig.token },
          keepalive: true
        });
      }
    });
  }

  function initialize() {
    cacheElements();
    loadSettings();
    configureAgent();
    bindEvents();
    updateModePresentation();
    updateLiveMetrics();
    updateControls();
  }

  initialize();
}());
