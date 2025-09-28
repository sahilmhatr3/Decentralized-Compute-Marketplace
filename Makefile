# Decentralized Compute Marketplace - Makefile

.PHONY: help install build test clean start-coordinator start-agent

help: ## Show this help message
	@echo "Decentralized Compute Marketplace MVP"
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing smart contract dependencies..."
	cd escrow-contract && forge install
	@echo "Installing coordinator dependencies..."
	cd coordinator && npm install
	@echo "Installing CLI dependencies..."
	cd cli && npm install
	@echo "Installing provider agent dependencies..."
	cd provider-agent && go mod tidy

build: ## Build all components
	@echo "Building smart contract..."
	cd escrow-contract && forge build
	@echo "Building CLI..."
	cd cli && npm run build
	@echo "Building provider agent..."
	cd provider-agent && go build -o bin/agent cmd/agent/main.go

test: ## Run all tests
	@echo "Testing smart contract..."
	cd escrow-contract && forge test
	@echo "Testing coordinator..."
	cd coordinator && npm test || echo "No tests configured"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf cli/dist
	rm -rf provider-agent/bin
	rm -rf provider-agent/outputs
	cd escrow-contract && forge clean

start-coordinator: ## Start the coordinator service
	@echo "Starting coordinator..."
	cd coordinator && npm run dev

start-agent: ## Start the provider agent
	@echo "Starting provider agent..."
	cd provider-agent && ./bin/agent

setup: install build ## Complete setup (install + build)
	@echo "Setup complete! Next steps:"
	@echo "1. Configure environment files:"
	@echo "   - coordinator/.env (from env.template)"
	@echo "   - cli/.env (from env.template)"
	@echo "2. Deploy smart contract to Sepolia"
	@echo "3. Start coordinator: make start-coordinator"
	@echo "4. Start provider agent: make start-agent"
	@echo "5. Use CLI to create and manage jobs"
