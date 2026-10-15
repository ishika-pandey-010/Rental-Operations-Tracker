.PHONY: help docs docs-check

help:
	@echo "make docs        rebuild docs/traceability.md and check every ID links up"
	@echo "make docs-check  check links only (used in CI)"
	@echo "App targets (setup, run, test, e2e, db, seed) arrive in S1."

docs:
	python3 scripts/docs_check.py

docs-check:
	python3 scripts/docs_check.py --check
