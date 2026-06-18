SHELL := /bin/sh

-include .env

PNPM ?= pnpm
COMPOSE ?= docker compose
BLOGUS_DATA_DIR ?= ./.data

.DEFAULT_GOAL := help

.PHONY: help install dev dev-client dev-server build start build-start typecheck check clean env data-dirs services-up services-down services-restart services-ps services-logs db-logs minio-logs install-cli

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "Blogus commands:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install workspace dependencies
	$(PNPM) install

dev: ## Start client and server in development mode
	exec $(PNPM) dev

dev-client: ## Start only the Vite client
	exec $(PNPM) --filter @blogus/client dev

dev-server: ## Start only the Fastify server
	exec $(PNPM) --filter @blogus/server dev

build: ## Build all workspace packages
	$(PNPM) build

start: ## Start production server (run `make build` first)
	cd server && node --env-file=../.env dist/index.js

build-start: build start ## Build and start production server

typecheck: ## Typecheck all workspace packages
	$(PNPM) typecheck

check: typecheck ## Run the default local verification suite

clean: ## Remove local build output
	find . -type d \( -name dist -o -name coverage \) -prune -exec rm -rf {} +

env: ## Create .env from .env.example if missing
	cp -n .env.example .env

data-dirs: ## Create local service data directories
	mkdir -p $(BLOGUS_DATA_DIR)/postgres $(BLOGUS_DATA_DIR)/redis $(BLOGUS_DATA_DIR)/minio

services-up: data-dirs ## Start Postgres, Redis, and MinIO with Docker Compose
	$(COMPOSE) up -d

services-down: ## Stop Docker Compose services
	$(COMPOSE) down

services-restart: ## Restart Docker Compose services
	$(COMPOSE) restart

services-ps: ## Show Docker Compose service status
	$(COMPOSE) ps

services-logs: ## Tail all Docker Compose service logs
	$(COMPOSE) logs -f

db-logs: ## Tail Postgres logs
	$(COMPOSE) logs -f postgres

minio-logs: ## Tail MinIO logs
	$(COMPOSE) logs -f minio

# ── CLI ───────────────────────────────────────────────────────

install-cli: ## Build and install blogus-cli globally (run again to update)
	$(PNPM) --filter @blogus/cli build
	cd client/cli && npm link
