# Specification

## Overview
This document contains the technical specifications for projects built using this Spec-Kit template.

## Template Specifications

### Directory Structure
```
/
├── .specify/
│   ├── constitution.md    # Project principles and governance
│   ├── spec.md           # This file - technical specifications
│   ├── plan.md           # Implementation planning
│   └── tasks/            # Individual task specifications
├── .github/
│   └── workflows/
│       └── spec-kit.yml  # Automation workflow
├── infra/                # Terraform infrastructure configuration
│   ├── main.tf           # Main Terraform configuration
│   ├── variables.tf      # Variable definitions
│   ├── variables.tfvars  # Variable values template
│   ├── providers.tf      # Provider configurations
│   └── outputs.tf        # Output definitions
└── README.md             # Project documentation
```

### Spec-Kit Commands

The following commands should be available for managing specifications:

#### /speckit.constitution
- **Purpose**: Review or update the project constitution
- **Usage**: Displays constitution principles and governance rules
- **Implementation**: Read and display `.specify/constitution.md`

#### /speckit.specify
- **Purpose**: Review or update technical specifications
- **Usage**: Displays current specifications
- **Implementation**: Read and display `.specify/spec.md`

#### /speckit.plan
- **Purpose**: Review or update the implementation plan
- **Usage**: Displays high-level project plan
- **Implementation**: Read and display `.specify/plan.md`

#### /speckit.tasks
- **Purpose**: List and manage individual tasks
- **Usage**: Displays all tasks from the tasks directory
- **Implementation**: List and display files in `.specify/tasks/`

### Workflow Requirements

The `.github/workflows/spec-kit.yml` workflow should:
1. Validate markdown syntax in specification files
2. Check for broken links in documentation
3. Ensure required files exist
4. Run on pull requests and pushes to main branch

### Branch-Specific Workflows

Each branch in the comprehensive branching scheme has dedicated workflows:

#### Specification and Planning Workflows
- `spec.yml`: Validates specification documents in the `spec` branch
- `plan.yml`: Validates planning documents in the `plan` branch
- `design.yml`: Validates design artifacts in the `design` branch

#### Development Workflows
- `impl.yml`: Runs implementation-specific validation in the `impl` branch
- `dev.yml`: Executes development tasks in the `dev` branch
- `test.yml`: Runs comprehensive test suites in the `test` branch

#### Deployment Workflows
- `stage.yml`: Deploys to staging environment from the `stage` branch
- `prod.yml`: Handles production deployment from the `prod` branch
- `pages.yml`: Builds and deploys documentation from the `pages` branch
- `gh-pages.yml`: Alternative GitHub Pages deployment from the `gh-pages` branch
- `codex.yml`: Validates knowledge base content in the `codex` branch

#### Automated Pull Request Workflows
- `auto-pr-spec-to-plan.yml`: Promotes specifications to planning
- `auto-pr-plan-to-impl.yml`: Promotes plans to implementation
- `auto-pr-design-to-impl.yml`: Integrates design into implementation
- `auto-pr-impl-to-dev.yml`: Integrates implementation into development
- `auto-pr-dev-to-main.yml`: Promotes development to stable baseline
- `auto-pr-main-to-stage.yml`: Promotes stable code to staging
- `auto-pr-main-to-test.yml`: Synchronizes testing with stable code
- `auto-pr-stage-to-prod.yml`: Promotes staging to production
- `auto-pr-prod-to-pages.yml`: Updates documentation from production
- `auto-pr-codex-to-pages.yml`: Publishes knowledge base to documentation

### Infrastructure as Code

All repositories derived from this template include a baseline Terraform configuration in the `infra/` directory. This provides:

#### PR-CYBR Agent Standardization
- Consistent variable schema across all PR-CYBR agents
- Standard variables: `agent_id`, `agent_role`, `environment`, `dockerhub_user`, `notion_page_id`
- Alignment with PR-CYBR `agent-variables.tf` specification

#### Terraform Configuration Structure
- **main.tf**: Core infrastructure configuration with commented backend block
- **variables.tf**: Variable definitions with validation rules
- **variables.tfvars**: Template with placeholder values (safe to commit)
- **providers.tf**: Provider configurations (Terraform Cloud, GitHub) ready for initialization
- **outputs.tf**: Standardized outputs for agent identification and connection info

#### Security and Best Practices
- Sensitive values injected via environment variables (`TF_VAR_*`)
- No secrets or environment-specific data in version control
- Backend configuration commented out by default for safe initialization
- Validation rules ensure data consistency

#### Initialization Workflow
```bash
cd infra
terraform init -backend=false
terraform fmt
terraform validate
terraform plan -input=false -var-file=variables.tfvars
```

See `.specify/tasks/infra-bootstrap.md` for detailed initialization instructions.

### Extensibility

This template is designed to be extended with:
- Technology-specific tooling (linters, build systems, test frameworks)
- Additional automation workflows
- Custom task management integrations
- Project-specific specifications
- Infrastructure resources in `infra/main.tf` based on agent requirements

## Non-Functional Requirements

### Maintainability
- All specification files use Markdown format
- Clear, hierarchical organization
- Version controlled alongside code

### Portability
- No technology-specific dependencies in the template
- Cross-platform compatibility
- Standard file formats

### Usability
- Clear documentation in README
- Self-explanatory directory structure
- Minimal learning curve for new users
