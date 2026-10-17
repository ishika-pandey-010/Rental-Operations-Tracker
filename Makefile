.PHONY: help docs docs-check setup env run test e2e db seed check

help:
	@echo "make docs        rebuild docs/traceability.md and check every ID links up"
	@echo "make docs-check  check links only (used in CI)"
	@echo "make setup       install deps, start local Supabase, write .env.local"
	@echo "make run         next dev on http://localhost:3100"
	@echo "make db          rebuild the local database from supabase/migrations"
	@echo "make test        vitest: unit, database and API tests (needs local Supabase)"
	@echo "make e2e         playwright end-to-end tests (needs local Supabase)"
	@echo "make seed        rebuild the demo account (demo@rentalops.test / demo-pass-2026)"
	@echo "make check       everything CI runs: docs, types, tests, e2e"

docs:
	python3 scripts/docs_check.py

docs-check:
	python3 scripts/docs_check.py --check

setup:
	npm ci
	npx supabase start
	$(MAKE) env

env:
	./scripts/write-env.sh

run:
	npx next dev -p 3100

db:
	npx supabase db reset

test:
	npx vitest run

e2e:
	npx playwright test

seed:
	node scripts/seed.mjs

check: docs-check
	npx tsc --noEmit
	npx vitest run
	npx playwright test
