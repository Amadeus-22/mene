PY ?= .venv/bin/python

.PHONY: setup check test lint web web-test run dev demo-data real

setup: ## virtualenv with dev tools, and the web app's packages
	python3 -m venv .venv && $(PY) -m pip install -q -e '.[dev]'
	cd web && npm ci --no-audit --no-fund

check: lint test web-test ## everything CI runs

lint:
	$(PY) -m ruff check . && $(PY) -m ruff format --check . && $(PY) -m mypy

test:
	$(PY) -m pytest -q

web-test:
	cd web && npm test

web: ## build web/dist
	cd web && npm run build

run: web ## API and the built app on http://127.0.0.1:8000
	COTA_WEB_DIR=web/dist $(PY) -m uvicorn cota.api:app --port 8000

dev: ## API on :8000; run `cd web && npm run dev` for the app on :5173
	$(PY) -m uvicorn cota.api:app --port 8000 --reload

demo-data: ## regenerate data/demo
	$(PY) scripts/make_demo.py

real: ## download CVM, B3 and BCB open data and build the mirror-quota extract (~150 MB cached)
	$(PY) scripts/fetch_real.py
