"use strict";

const main = document.querySelector("main");
const criterionNames = {
  necessary: "Необходимость", appropriate: "Уместность", unambiguous: "Однозначность",
  complete: "Полнота", singular: "Единичность", feasible: "Реализуемость",
  verifiable: "Проверяемость", correct: "Корректность", conforming: "Соответствие форме",
  consistent: "Согласованность", comprehensible: "Понятность", able_to_be_validated: "Валидируемость",
  ranked_importance_stability: "Приоритет и стабильность", modifiable: "Модифицируемость", traceable: "Трассируемость"
};
const verdictNames = {ok: "OK", violation: "Нарушение", "n.a.": "Н/П"};
const severityNames = {critical: "Критический", major: "Существенный", minor: "Незначительный"};
const steps = ["Загрузка", "Сегментация", "Проверка требований", "Проверка набора и цитат", "Отчёт"];

function e(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"}[char]));
}
function formatDate(value) { return value ? new Intl.DateTimeFormat("ru-RU", {dateStyle:"medium", timeStyle:"short"}).format(new Date(value)) : "—"; }
function linkId(id) { return `<a href="#req-${e(id)}">${e(id)}</a>`; }
async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Ошибка HTTP ${response.status}`;
    try { message = (await response.json()).detail || message; } catch (_) {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
function showError(error) { main.innerHTML = `<div class="panel error-box" role="alert"><h2>Не удалось загрузить страницу</h2><p>${e(error.message)}</p><a href="/">Вернуться на главную</a></div>`; }

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
}

async function home() {
  const config = await api("/api/config");
  main.innerHTML = `
    <section class="hero"><div class="eyebrow">Статическое ревью до разработки</div>
      <h1>Требования, которым можно доверять</h1>
      <p class="lede">Агент выделяет атомарные требования, проверяет каждое и весь набор по ISO/IEC/IEEE 29148 и IEEE 830, затем формирует доказательный отчёт на русском.</p>
    </section>
    <section class="panel" aria-labelledby="upload-title">
      <h2 id="upload-title">Новая проверка</h2>
      ${config.api_key_configured ? "" : `<div class="banner" role="alert"><strong>API-ключ не настроен.</strong> Добавьте ключ выбранного провайдера в локальную конфигурацию или выберите mock для проверки интерфейса.</div>`}
      <p class="config-line">Текущая конфигурация: <strong>${e(config.provider)}</strong> · <strong>${e(config.model)}</strong></p>
      <form id="upload-form">
        <label class="upload-zone" id="drop-zone">
          <input id="file" name="file" type="file" accept=".pdf,.docx,.md,.txt" required>
          <div class="upload-icon" aria-hidden="true">⇧</div><strong>Перетащите документ сюда</strong>
          <div class="muted">или нажмите для выбора · PDF, DOCX, MD, TXT · до 10 МБ</div>
          <div class="file-name" id="file-name" aria-live="polite"></div>
        </label>
        <div class="form-grid">
          <label><span>Провайдер</span><select name="provider" id="provider">
            ${["gemini","openai","mock"].map(p => `<option value="${p}" ${p === config.provider ? "selected" : ""}>${p}</option>`).join("")}
          </select></label>
          <label><span>Модель</span><input type="text" name="model" value="${e(config.model)}" aria-label="Модель"></label>
          <label><span>Контекст проекта (несколько файлов)</span><input type="file" name="context" accept=".pdf,.docx,.md,.txt" multiple></label>
          <label><span>Формат отчёта</span><select name="report_format"><option value="md">Markdown</option><option value="html">HTML</option><option value="docx">DOCX</option><option value="json">JSON</option></select></label>
        </div>
        <div class="option-row"><label><input type="checkbox" name="generate_tests" value="true"> Тест-кейсы</label><label><input type="checkbox" name="domain_check" value="true" checked> Доменная проверка</label></div>
        <div class="actions"><button class="button" type="submit">Проверить документ</button>
          <button class="button secondary demo" type="button" data-context="false">Демо без контекста</button>
          <button class="button secondary demo" type="button" data-context="true">Демо с контекстом проекта</button></div>
      </form>
    </section>`;
  const form = document.querySelector("#upload-form");
  const input = document.querySelector("#file");
  const zone = document.querySelector("#drop-zone");
  const name = document.querySelector("#file-name");
  const updateName = () => { name.textContent = input.files[0]?.name || ""; };
  input.addEventListener("change", updateName);
  ["dragenter","dragover"].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", event => { input.files = event.dataTransfer.files; updateName(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!input.files.length) return input.focus();
    const button = form.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Отправка…";
    try {
      const data = new FormData(form);
      data.set("generate_tests", form.generate_tests.checked ? "true" : "false");
      data.set("domain_check", form.domain_check.checked ? "true" : "false");
      const result = await api("/api/runs", {method:"POST", body:data});
      location.href = `/runs/${result.run_id}`;
    } catch (error) { button.disabled = false; button.textContent = "Проверить документ"; alert(error.message); }
  });
  document.querySelectorAll(".demo").forEach(button => button.addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    try {
      const query = new URLSearchParams({provider: form.provider.value, model: form.model.value,
        with_context: event.currentTarget.dataset.context, generate_tests: form.generate_tests.checked,
        domain_check: form.domain_check.checked});
      const result = await api(`/api/demo?${query}`, {method:"POST"}); location.href = `/runs/${result.run_id}`;
    } catch (error) { event.currentTarget.disabled = false; alert(error.message); }
  }));
}

let pollTimer;
function progressView(run) {
  const started = run.started_at ? new Date(run.started_at) : null;
  const elapsed = started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
  main.innerHTML = `<section class="progress-page panel" aria-live="polite">
    <div class="progress-head"><div><div class="eyebrow">Запуск ${e(run.run_id.slice(0,8))}</div><h1>${e(run.title)}</h1></div><span class="status-pill">${e(run.status === "queued" ? "В очереди" : "Выполняется")}</span></div>
    <p><strong>${e(run.current_label)}</strong> · <span id="elapsed">${elapsed} с</span></p>
    <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${run.progress}"><div class="progress-fill" style="width:${run.progress}%"></div></div>
    <ol class="stepper">${steps.map((label, i) => `<li data-step="${i+1}" class="${i+1 < run.current_step ? "done" : i+1 === run.current_step ? "active" : ""}">${label}</li>`).join("")}</ol>
    <p class="muted">Можно закрыть страницу: запуск продолжится на сервере и останется в истории.</p></section>`;
}
async function runPage(id) {
  const run = await api(`/api/runs/${id}`);
  if (run.status === "done") return reportPage(id);
  if (run.status === "error") {
    main.innerHTML = `<section class="panel error-box" role="alert"><h1>Проверка завершилась ошибкой</h1><p>${e(run.error)}</p><div class="actions"><a class="button secondary" href="/">Новый запуск</a><a href="/history">История</a></div></section>`;
    return;
  }
  progressView(run);
  clearTimeout(pollTimer); pollTimer = setTimeout(() => runPage(id).catch(showError), 2000);
}

function findingHtml(finding) {
  return `<article class="finding ${e(finding.severity)}">
    <div class="actions"><span class="badge ${e(finding.severity)}">${e(severityNames[finding.severity] || finding.severity)}</span><strong>${e(criterionNames[finding.criterion] || finding.criterion)}</strong></div>
    <dl><dt>Цитата</dt><dd>«${e(finding.quote)}»</dd><dt>Место</dt><dd>${e(finding.location)}</dd>
      <dt>Объяснение</dt><dd>${e(finding.explanation)}</dd><dt>Исправление</dt><dd>${e(finding.fix)}</dd>
      <dt>Проверка</dt><dd>${finding.quote_verified ? `<span class="badge ok">Цитата подтверждена</span>` : `<span class="badge unverified">Цитата не подтверждена</span>`}
      ${finding.confidence ? `<span class="badge minor">Уверенность: ${e(finding.confidence)}</span>` : ""}
      ${finding.expert_confirmation ? `<span class="badge major">Требует подтверждения экспертом</span>` : ""}</dd></dl>
  </article>`;
}
function criterionTable(verdicts) {
  return `<div class="chips">${Object.entries(verdicts).map(([key,value]) => `<span class="chip ${value === "ok" ? "ok" : value === "violation" ? "violation" : "na"}" title="${e(criterionNames[key] || key)}">${e(criterionNames[key] || key)}: ${e(verdictNames[value] || value)}</span>`).join("")}</div>`;
}

async function reportPage(id) {
  clearTimeout(pollTimer);
  const data = await api(`/api/runs/${id}/report`);
  const m = data.metadata, s = data.summary, set = data.set_check;
  const checks = new Map(data.requirement_checks.map(item => [item.requirement_id, item]));
  const sections = [...new Set(data.requirements.map(item => item.section))].sort();
  main.innerHTML = `<header class="report-header"><div><div class="eyebrow">Отчёт о проверке</div><h1>${e(m.title)}</h1></div>
    <div class="actions"><a class="button secondary" href="/api/runs/${id}/report.md">Скачать .md</a><a class="button secondary" href="/api/runs/${id}/report.json">Скачать .json</a>${["html","docx","pdf"].map(x => `<a class="button secondary optional-download" data-format="${x}" href="/api/runs/${id}/files/report.${x}">.${x}</a>`).join("")}<button class="button secondary" onclick="print()">Печать</button></div></header>
    <nav class="report-nav" aria-label="Разделы отчёта">${["Паспорт","Нарезка","Требования","Набор","Сводка","Итог","Контекст","Тест-кейсы","Изменения"].map((x,i) => `<a href="#section-${i+1}">${i+1}. ${x}</a>`).join("")}</nav>
    <section id="section-1" class="report-section"><h2>1. Паспорт прогона</h2><dl class="metadata">
      <div><dt>Документ</dt><dd>${e(m.title)}</dd></div><div><dt>Дата</dt><dd>${formatDate(m.run_at)}</dd></div>
      <div><dt>Провайдер / модель</dt><dd>${e(m.provider)} / ${e(m.model)}</dd></div><div><dt>Версия агента</dt><dd>${e(m.agent_version)}</dd></div>
      <div><dt>Покрытие фрагментов</dt><dd>${m.coverage_percent == null ? "—" : `${e(m.coverage_percent)}%`}</dd></div>
      <div><dt>LLM / кэш</dt><dd>${e(m.llm_calls ?? "—")} / ${e(m.cache_hits ?? "—")}</dd></div><div><dt>Длительность</dt><dd>${e(m.duration_seconds ?? "—")} с</dd></div>
      <div><dt>Модели по шагам</dt><dd>${e(JSON.stringify(m.models_by_step || {}))}</dd></div></dl></section>
    <section id="section-2" class="report-section"><h2>2. Как агент нарезал требования</h2>
      <div class="table-tools"><label><span>Поиск</span><input id="slice-search" type="search" placeholder="ID, раздел, текст…"></label></div>
      <div class="table-wrap"><table><thead><tr>${[["report_id","ID в отчёте"],["source_id","ID в документе"],["section","Раздел"],["line_number","Строка"],["short_text","Краткая формулировка"],["quote","Цитата"]].map(([key,label]) => `<th><button type="button" data-sort="${key}">${label} ↕</button></th>`).join("")}</tr></thead><tbody id="slice-body"></tbody></table></div></section>
    <section id="section-3" class="report-section"><h2>3. Проверка каждого требования</h2>
      <div class="filters"><label><span>Поиск</span><input id="req-search" type="search" placeholder="ID, текст, объяснение…"></label>
        <label><span>Серьёзность</span><select id="severity-filter"><option value="">Все</option><option value="critical">Критические</option><option value="major">Существенные</option><option value="minor">Незначительные</option></select></label>
        <label><span>Критерий</span><select id="criterion-filter"><option value="">Все</option>${Object.entries(criterionNames).map(([k,v]) => `<option value="${k}">${e(v)}</option>`).join("")}</select></label>
        <label><span>Часть / раздел</span><select id="section-filter"><option value="">Все</option>${sections.map(x => `<option>${e(x)}</option>`).join("")}</select></label>
        <label><span>Показывать</span><select id="violations-filter"><option value="">Все требования</option><option value="yes">Только с нарушениями</option></select></label></div>
      <div id="requirement-cards" class="cards"></div></section>
    <section id="section-4" class="report-section"><h2>4. Проверка всего набора требований</h2>${criterionTable(set.verdicts)}
      <h3>Трассируемость</h3><p>${e(set.traceability || "Оценка не предоставлена.")}</p>
      <h3>Отсутствующие разделы</h3>${set.missing_sections.length ? `<ul>${set.missing_sections.map(x => `<li>${e(x)}</li>`).join("")}</ul>` : `<p class="muted">Не отмечены.</p>`}
      <h3>Нарушения набора</h3><div class="findings">${set.findings.length ? set.findings.map(f => {
        const ids = (f.requirement_ids || []).map(linkId).join(" ↔ ");
        const quotes = f.related_quotes || [];
        return `<div>${ids}${quotes.length >= 2 ? `<div class="contradiction"><blockquote>«${e(quotes[0])}»</blockquote><blockquote>«${e(quotes[1])}»</blockquote></div>` : ""}${findingHtml(f)}</div>`;
      }).join("") : `<p class="muted">Нарушений на уровне набора не обнаружено.</p>`}</div></section>
    <section id="section-5" class="report-section"><h2>5. Сводка</h2><div class="counters">
      <div class="counter"><strong>${s.requirement_count}</strong><span>требований</span></div><div class="counter"><strong>${s.finding_count}</strong><span>нарушений</span></div>
      <div class="counter"><strong>${s.by_severity.critical}</strong><span>критических</span></div><div class="counter"><strong>${s.by_severity.major}</strong><span>существенных</span></div><div class="counter"><strong>${s.by_severity.minor}</strong><span>незначительных</span></div></div>
      <h3>Нарушения по критериям</h3><div id="criteria-chart"></div><h3>Критические дефекты</h3>
      ${s.critical_defects.length ? `<ul>${s.critical_defects.map(f => `<li>${(f.requirement_ids || []).map(linkId).join(", ") || "Набор"}: ${e(f.explanation)}</li>`).join("")}</ul>` : `<p class="muted">Не выявлены.</p>`}</section>
    <section id="section-6" class="report-section"><h2>6. Итог</h2><div class="decision ${s.decision === "Да" ? "yes" : s.decision === "Нет" ? "no" : "maybe"}">${e(s.decision)}</div>
      <p><strong>Можно ли начинать разработку и тестирование:</strong> ${e(s.justification)}.</p><h3>Приоритетный список исправлений</h3>
      ${(s.top_fixes || s.prioritized_fixes || []).length ? `<ol>${(s.top_fixes || s.prioritized_fixes).map(x => `<li>${e(x.fix || x)}</li>`).join("")}</ol>` : `<p class="muted">Дополнительные исправления по результатам этого прогона не требуются.</p>`}</section>
    <section id="section-7" class="report-section"><h2>7. Соответствие контексту проекта и трассируемость</h2>
      ${data.context?.used ? (data.context.findings || []).map(x => `<article class="finding ${e(x.severity)}"><div class="actions"><strong>${e(x.type)}</strong><span class="badge minor">Уверенность: ${e(x.confidence || "—")}</span></div><p>${e(x.explanation)}</p><div class="contradiction"><blockquote>«${e(x.requirement_quote)}»<br><small>Строка ${e(x.requirement_line || "—")} · ${x.requirement_quote_verified ? "подтверждена" : "не подтверждена"}</small></blockquote><blockquote>«${e(x.context_quote)}»<br><small>${e(x.context_file)}, строка ${e(x.context_line || "—")} · ${x.context_quote_verified ? "подтверждена" : "не подтверждена"}</small></blockquote></div><p>${e(x.fix)}</p></article>`).join("") || `<p class="muted">Конфликты не выявлены.</p>` : `<p>Внешний контекст проекта не передан; показана внутридокументная трассируемость.</p>`}
      <div class="table-wrap"><table><thead><tr><th>Цель</th><th>Требования</th><th>Критерии</th><th>API</th><th>Покрытие</th></tr></thead><tbody>${(data.context?.traceability_matrix || set.traceability_matrix || []).map(row => `<tr><td>${e(row.goal)}</td><td>${(row.requirement_ids || []).map(linkId).join(", ")}</td><td>${e((row.acceptance_ids || []).join(", "))}</td><td>${e((row.api_ids || []).join(", "))}</td><td><span class="badge trace-${e(row.status)}">${e(row.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
    <section id="section-8" class="report-section"><h2>8. Черновик тест-кейсов</h2>${(data.test_cases || []).length ? data.test_cases.map(x => `<article class="requirement-card"><h3>${e(x.id)} — ${(x.requirement_ids || []).map(linkId).join(", ")}</h3><p><strong>Предусловия:</strong> ${e((x.preconditions || []).join("; "))}</p><ol>${(x.steps || []).map(y => `<li>${e(y)}</li>`).join("")}</ol><p><strong>Ожидаемый результат:</strong> ${e(x.expected_result)}</p><p><strong>Границы:</strong> ${e((x.boundary_values || []).join("; "))}</p></article>`).join("") : `<p class="muted">Генерация тест-кейсов не включалась.</p>`}</section>
    <section id="section-9" class="report-section"><h2>9. Изменения относительно прошлого прогона</h2>${Object.keys(data.diff || {}).length ? [["fixed","Исправлено"],["new","Новые"],["remaining","Остались"]].map(([key,title]) => `<h3>${title}</h3><ul>${(data.diff[key] || []).map(x => `<li>${e(x.criterion)}: ${e(x.explanation)}</li>`).join("") || "<li>Нет</li>"}</ul>`).join("") : `<p class="muted">Предыдущий отчёт не передан.</p>`}</section>`;

  let sortKey = "report_id", ascending = true;
  const renderSlices = () => {
    const term = document.querySelector("#slice-search").value.toLowerCase();
    const rows = data.requirements.filter(r => Object.values(r).join(" ").toLowerCase().includes(term)).sort((a,b) => String(a[sortKey]).localeCompare(String(b[sortKey]), "ru") * (ascending ? 1 : -1));
    document.querySelector("#slice-body").innerHTML = rows.map(r => `<tr><td>${linkId(r.report_id)}</td><td>${e(r.source_id)}</td><td>${e(r.section)}</td><td>${e(r.line_number || "—")}</td><td>${e(r.short_text)}</td><td>«${e(r.quote)}» ${r.quote_verified ? "" : `<span class="badge unverified">Не подтверждена</span>`}</td></tr>`).join("");
  };
  document.querySelector("#slice-search").addEventListener("input", renderSlices);
  document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { const key = button.dataset.sort; ascending = key === sortKey ? !ascending : true; sortKey = key; renderSlices(); }));
  renderSlices();

  const renderCards = () => {
    const term = document.querySelector("#req-search").value.toLowerCase(), severity = document.querySelector("#severity-filter").value;
    const criterion = document.querySelector("#criterion-filter").value, section = document.querySelector("#section-filter").value;
    const only = document.querySelector("#violations-filter").value === "yes";
    const filtered = data.requirements.filter(r => {
      const c = checks.get(r.report_id), findings = c?.findings || [];
      const text = [r.report_id,r.source_id,r.section,r.short_text,r.quote,...findings.flatMap(f => [f.explanation,f.fix])].join(" ").toLowerCase();
      return (!term || text.includes(term)) && (!severity || findings.some(f => f.severity === severity)) && (!criterion || findings.some(f => f.criterion === criterion)) && (!section || r.section === section) && (!only || findings.length);
    });
    document.querySelector("#requirement-cards").innerHTML = filtered.length ? filtered.map(r => { const c = checks.get(r.report_id); return `<article class="requirement-card" id="req-${e(r.report_id)}"><div class="card-head"><div><a href="#req-${e(r.report_id)}">${e(r.report_id)}</a> <span class="muted">${e(r.source_id)}</span><h3>${e(r.short_text)}</h3></div>${r.quote_verified ? "" : `<span class="badge unverified">Цитата не подтверждена</span>`}</div><p class="muted">${e(r.section)}, строка ${e(r.line_number || "—")}</p><blockquote>«${e(r.quote)}»</blockquote>${criterionTable(c?.verdicts || {})}<div class="findings">${c?.findings.length ? c.findings.map(findingHtml).join("") : `<p class="muted">Нарушений не обнаружено.</p>`}</div>${c?.rewrite ? `<div class="rewrite"><strong>Предлагаемая формулировка</strong><p>${e(c.rewrite)}</p><button class="button secondary copy-rewrite" type="button" data-copy="${e(c.rewrite)}">Копировать</button></div>` : ""}</article>`; }).join("") : `<p class="empty">По выбранным фильтрам ничего не найдено.</p>`;
    document.querySelectorAll(".copy-rewrite").forEach(button => button.addEventListener("click", async () => { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = "Скопировано"; }));
  };
  document.querySelectorAll("#section-3 input, #section-3 select").forEach(x => x.addEventListener("input", renderCards)); renderCards();
  const entries = Object.entries(s.by_criterion), max = Math.max(1, ...entries.map(([,v]) => v));
  document.querySelector("#criteria-chart").innerHTML = entries.length ? entries.map(([key,value]) => `<div class="chart-row"><span>${e(criterionNames[key] || key)}</span><div class="bar-track" aria-label="${e(criterionNames[key] || key)}: ${value}"><div class="bar" style="width:${value/max*100}%"></div></div><strong>${value}</strong></div>`).join("") : `<p class="muted">Нарушений нет.</p>`;
}

async function historyPage() {
  const runs = await api("/api/runs");
  main.innerHTML = `<section><div class="report-header"><div><div class="eyebrow">Сохранено на сервере</div><h1>История запусков</h1></div><a class="button" href="/">Новая проверка</a></div>
    <div class="panel table-wrap">${runs.length ? `<table><thead><tr><th>Документ</th><th>Дата</th><th>Модель</th><th>Контекст</th><th>Требования</th><th>Нарушения</th><th>Итог</th><th>Действия</th></tr></thead><tbody>${runs.map(r => `<tr><td>${e(r.title)}</td><td>${formatDate(r.created_at)}</td><td>${e(r.provider)} / ${e(r.model)}</td><td>${r.context_used ? "Да" : "Нет"}</td><td>${e(r.requirement_count)}</td><td>${e(r.finding_count)}</td><td>${e(r.decision || r.current_label)}</td><td><div class="history-actions"><a class="button secondary" href="/runs/${r.run_id}">Открыть</a><button class="button danger delete-run" data-id="${r.run_id}" ${r.status === "running" ? "disabled" : ""}>Удалить</button></div></td></tr>`).join("")}</tbody></table>` : `<p class="empty">Запусков пока нет.</p>`}</div></section>`;
  document.querySelectorAll(".delete-run").forEach(button => button.addEventListener("click", async () => { if (!confirm("Удалить этот запуск и его файлы?")) return; try { await api(`/api/runs/${button.dataset.id}`, {method:"DELETE"}); historyPage(); } catch (error) { alert(error.message); } }));
}

async function route() {
  const match = location.pathname.match(/^\/runs\/([0-9a-f]{32})$/);
  if (match) return runPage(match[1]);
  if (location.pathname === "/history") return historyPage();
  return home();
}

initTheme();
route().catch(showError);
