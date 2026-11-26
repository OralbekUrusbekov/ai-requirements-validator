PYTHON ?= python3
REPORT ?= runs/demo/report.md

.PHONY: install run web test eval demo-context frontend dev
install:
	$(PYTHON) -m venv .venv
	.venv/bin/python -m pip install -r requirements.txt
run:
	$(PYTHON) main.py docs/requirements.md $(REPORT)
web:
	$(PYTHON) -m webapp
frontend:
	cd frontend && npm ci && npm run build
dev:
	@echo "Терминал 1: make web"
	@echo "Терминал 2: cd frontend && npm install && npm run dev"
test:
	$(PYTHON) -m pytest -q
eval:
	$(PYTHON) -m eval $(REPORT:.md=.json) eval/cases/requirements_card_alerts.yaml
demo-context:
	$(PYTHON) main.py docs/requirements.md $(REPORT) --context examples/context
