# ИИ-агент проверки требований

Агент выделяет атомарные требования, проверяет каждое и весь каталог по ISO/IEC/IEEE 29148:2018 (§5.2.5–5.2.6) и IEEE 830-1998 (§4.3), сопоставляет их с контекстом проекта и выпускает доказательный отчёт на русском. Исходное ТЗ сохранено без изменений в [docs/TASK.md](docs/TASK.md).

## Быстрый старт

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py docs/requirements.md runs/demo/report.md --provider mock
```

Для Gemini получите ключ на [aistudio.google.com](https://aistudio.google.com/), скопируйте `.env.example` в `.env` и заполните `GEMINI_API_KEY`. Реальные ключи не должны попадать в Git.

## Что проверяется

| Уровень | Критерии | Что ищет агент |
|---|---|---|
| Требование, ISO 29148 | necessary, appropriate, unambiguous, complete, singular, feasible, verifiable, correct, conforming | лишние/составные нормы, неоднозначность, пропуски условий, границ и негативных путей, непроверяемые числа и сроки |
| Набор, ISO 29148 | complete, consistent, feasible, comprehensible, able to be validated | противоречия правил и примеров, пробелы, несовместимые типы, единицы и статусы |
| SRS, IEEE 830 | correct, unambiguous, complete, consistent, ranked, verifiable, modifiable, traceable | корректность, приоритет/стабильность, модифицируемость и трассируемость |
| Контекст проекта | цели, scope, ограничения, глоссарий, системы, политики | «правильный продукт»: непокрытые цели, лишние требования, конфликты SLA, scope и политик |

Цитаты верифицируются кодом, а место дефекта вычисляется как «раздел, строка N». PDF- и DOCX-таблицы сохраняются для сегментации.

## Архитектура

```text
input + context -> loader -> segmenter -> deterministic coverage
                                      -> cached provider + fallback
               -> checker (batches) -> set consistency/completeness
               -> context check / optional tests / diff
               -> verifier + dedupe -> MD + JSON + HTML/DOCX[/PDF]
                                      -> CLI / FastAPI web UI
```

## CLI

Базовая команда неизменна:

```bash
python main.py INPUT OUTPUT
```

Расширение `OUTPUT` выбирает `.md`, `.html`, `.docx` или `.json`; JSON всегда сохраняется рядом.

| Флаг | Назначение |
|---|---|
| `--provider {gemini,openai,mock}` | Провайдер |
| `--model NAME` | Модель |
| `--batch-size N` | Требований на check-вызов (12) |
| `--context PATH [PATH ...]` | Файлы/каталоги контекста |
| `--domain-check` / `--no-domain-check` | Доменная проверка внутри completeness |
| `--tests` | Черновики тест-кейсов, +1 вызов |
| `--previous report.json` | Diff без LLM |
| `--pdf` | Дополнительный PDF при наличии PyMuPDF |
| `--no-cache` | Отключить LLM-кэш |
| `--verbose` | Прогресс и raw-ответы в `runs/debug/` |

OpenAI-совместимые Ollama/vLLM настраиваются через `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.

## Контекст проекта

Поддерживаются MD, TXT, PDF и DOCX. Рекомендуемые части: цели и KPI, scope in/out, ограничения/SLA/сроки, глоссарий, каталог систем и политики.

```markdown
# Паспорт проекта
## Цели
- Сократить измеримое время операции.
## Вне scope
- Клиентское приложение не изменяется.
## Ограничения
- Внешний сервис имеет документированный SLA.
```

Готовый пакет: `examples/context/`.

```bash
python main.py docs/requirements.md runs/context/report.html --context examples/context --tests
```

Контекстный дефект содержит две проверяемые цитаты — из каталога и из контекстного файла.

## Веб-интерфейс

```bash
python -m webapp
# либо: uvicorn webapp.app:app --host 127.0.0.1 --port 8000
```

Откройте <http://127.0.0.1:8000>. Offline UI без build-step принимает основной и несколько контекстных файлов, ставит запуски в последовательную очередь, показывает прогресс, трассируемость, переписывания, тест-кейсы, diff и историю.

| Endpoint | Назначение |
|---|---|
| `POST /api/runs` | Документ до 10 МБ, контекст и параметры |
| `GET /api/runs/{id}` | Статус и прогресс |
| `GET /api/runs/{id}/report` | Структурированный отчёт |
| `GET /api/runs/{id}/report.md`, `.json` | Обязательные файлы |
| `GET /api/runs/{id}/files/{name}` | HTML/DOCX/PDF, если сформированы |
| `GET /api/runs`, `DELETE /api/runs/{id}` | История / удаление |
| `POST /api/demo?with_context=true` | Демо с sample context |
| `GET /api/config` | Provider/model и boolean наличия ключа |

## Платформа (веб)

Новый Jira-подобный интерфейс хранит несколько проектов, версии документов, контекст, прогоны и жизненный цикл дефектов. Собранный React SPA обслуживается FastAPI на том же адресе; прежний vanilla-интерфейс остаётся доступен по `/legacy`.

Основные экраны:

- все проекты и создание проекта;
- обзор с KPI, распределениями и динамикой прогонов;
- версии документов, очередь проверок, живой прогресс и сравнение;
- полный отчёт с восемью вкладками и экспортами;
- доска/список дефектов, фильтры, bulk-действия, комментарии и история;
- реестр требований, трассируемость, контекст и тест-кейсы;
- настройки критериев, модели и участников.

```text
React SPA  <──JSON/multipart──>  FastAPI  <──>  SQLite + data/projects/
                                      |
                                      └──> validator.pipeline ──> LLM/cache
```

Запуск production-сборки:

```bash
cd frontend
npm install
npm run typecheck
npm run build
cd ..
python -m webapp
```

Откройте <http://127.0.0.1:8000>. Для разработки запустите backend и `npm run dev` в разных терминалах (`make dev` печатает команды). Vite проксирует `/api` на порт 8000. `VITE_USE_MOCK=true npm run dev` включает браузерные fixtures без backend. База по умолчанию — `data/app.db`, путь переопределяется через `APP_DB`.

Офлайн-демо с mock-прогонами:

```bash
LLM_PROVIDER=mock python -m webapp.seed_demo
```

| Группа API | Возможности |
|---|---|
| `/api/projects` | CRUD, избранное, dashboard, настройки и участники |
| `/api/projects/{key}/documents`, `/context` | Версии каталога и контекстные файлы |
| `/api/projects/{key}/runs`, `/api/runs/{id}` | Очередь, прогресс, отчёты и сравнение |
| `/api/projects/{key}/defects`, `/api/defects/{key}` | Фильтры, workflow, bulk, комментарии и история |
| `/requirements`, `/traceability`, `/testcases` | Реестр, матрица и CSV тест-кейсов |
| `/api/search`, `/api/config` | Глобальный поиск и безопасная конфигурация |

## Квоты, кэш и fallback

Модель по умолчанию — `gemini-3-flash-preview`; альтернатива — `gemini-2.5-flash`. Free tier может давать около 20 запросов/сутки на модель/project. Формула логических вызовов:

```text
без контекста: S + C + ceil(N / batch_size) + 2 + T
с контекстом:  S + C + ceil(N / batch_size) + 4 + T
```

`S` — 1–3 сегментации, `C` — 0/1 coverage-вызов, `N` — требований, `T` — 1 с `--tests`. Пропущенные batch ID дают один дополнительный вызов; retries/fallback увеличивают физические запросы.

`LLM_CACHE=on` хранит ответы по SHA-256 provider/model/prompts/schema в `.cache/llm/`, поэтому идентичный повтор требует 0 сетевых запросов. `--no-cache` отключает кэш. Резервные модели:

```dotenv
LLM_FALLBACK=gemini:gemini-2.5-flash,openai:gpt-4o-mini
```

Fallback срабатывает на исчерпанной квоте и повторных 5xx. Агент не ждёт огромную server retry-delay; логи и web-ошибки маскируют ключи.

## Evaluation harness

Oracle-файлы никогда не подаются LLM:

```bash
python -m eval runs/demo/report.json eval/cases/requirements_card_alerts.yaml
python -m eval runs/context/report.json eval/cases/context_conflicts.yaml
```

Команда печатает recall, precision proxy подтверждённых цитат, hits/misses и пишет `eval/results.md`.

## Команды и тесты

```bash
make install
make run
make web
make test
make eval
make demo-context
```

`python -m pytest -q` работает с mock без сети.

## Как это соответствует ТЗ

| TASK.md | Где реализовано |
|---|---|
| §2 — код, README, отчёт | `validator/`, CLI/web, этот README, Markdown+JSON и дополнительные форматы |
| §3 — этапы прогона | loader → segmenter → checker → set checker → verifier → reporter |
| §4 — LLM | Gemini, OpenAI-compatible и mock; schema, repair/retry/cache/fallback |
| §5 — критерии | общие русские prompts и verdict по каждому критерию |
| §6 — отчёт | обязательные разделы 1–6; дополнительные 7–9 |
| §7 — репозиторий | Python 3.10+, requirements, `.env.example`, точная команда `python main.py <in> <out>` |

## Структура и ограничения

```text
main.py             CLI
validator/          загрузка, prompts, providers, checks, cache, context, отчёты
webapp/             FastAPI + vanilla UI
eval/               oracle и matcher
examples/context/   demo context pack
tests/              offline tests
docs/TASK.md        исходное ТЗ
```

OCR для сканов не выполняется. Статический анализ не подтверждает фактическую реализуемость. Доменные выводы без контекста помечаются как требующие эксперта. Переписывания и тест-кейсы требуют человеческого ревью.
