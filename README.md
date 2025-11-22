[![Spec-Kit Validation](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/spec-kit.yml/badge.svg?branch=main)](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/spec-kit.yml)  
**Branch Purpose:** The `main` branch is the stable baseline representing production-ready code. All changes integrated through the CI/CD pipeline eventually land here.
# Spec-Bootstrap  
[![Spec-Kit Validation](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/spec-kit.yml/badge.svg)](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/spec-kit.yml)  

Spec-Bootstrap is a language agnostic template repository built on the Spec Kit specification-driven development framework. It provides a ready to use structure to capture your project’s constitution, specifications, implementation plans and tasks. This template ensures that your development process remains transparent, well‑documented, and consistent across projects.  

## Usage  
### Use as a Template  
Click **Use this template** on the repository’s main page to scaffold a new project. GitHub will clone the files from this template (including the `.specify` directory and GitHub Actions workflows) into your new repository, so you can start specifying and planning your project immediately.  

### Integrate into an Existing Project  
To adopt Spec Kit in an existing repository, merge this repository into your project (via `git pull` or by copying files). Make sure to copy the `.specify` directory and `.github/workflows` folder into your project root. Adapt the `constitution.md`, `spec.md`, and `plan.md` files to match your project’s goals and update the tasks accordingly.  

## Run Status Indicator  
The badge above reflects the current status of the Spec Kit validation workflow on the `main` branch. It runs checks on required files, markdown syntax and link validation, and summarises tasks. A passing badge means the template structure is intact.  

## Branching Strategy  
This repository implements a comprehensive branching scheme to support specification-driven development. See [BRANCHING.md](BRANCHING.md) for detailed documentation on:  
- Purpose and usage of each branch (spec, plan, design, impl, dev, main, test, stage, prod, pages, gh-pages, codex)  
- Automated pull request workflows between branches  
- Branch protection rules and best practices  
- Development lifecycle flow from specifications through production  

## AI Driven Development  
This repository is designed to be used not only by humans but also by AI coding agents. When using an AI agent to scaffold or extend your project:  
- **Start with the spec** – Agents should read and, if necessary, refine the documents in `.specify/constitution.md`, `.specify/spec.md` and `.specify/plan.md` before writing any code.  
- **Follow the phases** – Agents must honor the Spec Kit workflow: specify, plan, create tasks and then implement. This prevents "vibe coding" and ensures work is grounded in agreed requirements.  
- **Update as you go** – If the AI agent makes design decisions or adds features, it should update the spec and plan documents to keep them living and reflective of the code.  
- **Respect the Constitution** – The project’s constitution defines non‑negotiable rules (coding standards, testing expectations, security requirements). AI agents should adhere to these guidelines when generating code or documentation.  

## License  
This project will be released under the [MIT License](LICENSE).  

## Quick Start  
1. **Clone or Fork this repository**  
  ```bash  
  git clone https://github.com/PR-CYBR/spec-bootstrap.git  
  cd spec-bootstrap  
  ```  

2. **Review the Constitution**  
  ```bash  
  cat .specify/constitution.md  
  ```  

3. **Explore the Specifications**  
  ```bash  
  cat .specify/spec.md  
  ```  

4. **Check the Implementation Plan**  
  ```bash  
  cat .specify/plan.md  
  ```  

5. **View Tasks**  
  ```bash  
  ls -la .specify/tasks/  
  ```  

6. **Initialize Terraform Infrastructure** (Optional)  
  All repositories derived from this template include a baseline Terraform configuration for PR-CYBR agent standardization:
  ```bash
  cd infra
  terraform init -backend=false
  terraform validate
  terraform plan -input=false -var-file=variables.tfvars
  ```
  
  Before running these commands:
  - Update `infra/variables.tfvars` with your agent-specific values
  - Set sensitive values via environment variables (e.g., `export TF_VAR_dockerhub_user="username"`)
  - See `.specify/tasks/infra-bootstrap.md` for detailed instructions
  
  **Note**: Derived projects inherit this baseline automatically for PR-CYBR agent alignment.

## Automated Provisioning  
During initial provisioning of a new repository derived from this template, multiple draft pull requests are created to add the specification, plan and workflow files. Normally these PRs require manual review because branch protection rules on the default branch prevent automation from merging. To support fully autonomous initialization while preserving safety, this template includes an initial provisioning workflow (`initial-provision.yml`).  
This workflow runs only once — when the repository has no prior commits or when triggered with `is_initial_provision` set to `true`. It will:  
- Detect that the repository is in a bootstrap state.  
- Temporarily disable branch protection on the default branch using the GitHub API.  
- Mark any draft bootstrap pull requests as ready for review and merge them automatically.  
- Reapply the previous branch protection settings immediately after the merges.  
- Provision Terraform Cloud workspace (if `TFC_TOKEN` is configured).
- Add a `bootstrap-complete` tag or commit annotation for auditability.  
If automation is disabled or fails, you may still perform the first merge manually by approving the draft PRs. After the initial provisioning completes, the regular CI/CD workflows and branch protections govern subsequent development as usual. 

### Terraform Cloud Auto-Setup
When you create a new repository from this template:
- The Spec-Bootstrap system automatically provisions a TFC workspace during initial provisioning.
- It synchronizes baseline variables from `/infra` to Terraform Cloud.
- The workspace is tagged with "spec-bootstrap" and the repository name.
- Secrets and API tokens are never stored in code — only injected via TFC or GitHub Secrets.

**Setup Requirements:**
1. Add a `TFC_TOKEN` secret to your repository (Settings → Secrets and variables → Actions).
2. Generate the token from Terraform Cloud: User Settings → Tokens → Create an API token.
3. The initial provisioning workflow will automatically create and configure your workspace.

**Note:** If `TFC_TOKEN` is not configured, the TFC bootstrap step will be skipped with a warning. You can add the token later and manually trigger the `tfc-bootstrap.yml` workflow.
2. **Review the Constitution**  
  ```bash  
  cat .specify/constitution.md  
  ```  
3. **Explore the Specifications**  
  ```bash  
  cat .specify/spec.md  
  ```  
4. **Check the Implementation Plan**  
  ```bash  
  cat .specify/plan.md  
  ```  
5. **View Tasks**  
  ```bash  
  ls -la .specify/tasks/  
  ```

## Spec Kit Commands  
The Spec Kit framework has a set of conceptual commands that are represented by files in this template:  
- `/speckit.constitution` – defines project rules and non‑negotiables.  
- `/speckit.specify` – describes what to build and why.  
- `/speckit.plan` – outlines how to build it.  
- `/speckit.tasks` – breaks the plan into actionable tasks.
