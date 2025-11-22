[![Pages Branch Workflow](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/pages.yml/badge.svg?branch=pages)](https://github.com/PR-CYBR/spec-bootstrap/actions/workflows/pages.yml)  
**Branch Purpose:** The `pages` branch is used for generating and deploying the project's documentation or static site via GitHub Pages.
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

## Spec Kit Commands  
The Spec Kit framework has a set of conceptual commands that are represented by files in this template:  
- `/speckit.constitution` – defines project rules and non‑negotiables.  
- `/speckit.specify` – describes what to build and why.  
- `/speckit.plan` – outlines how to build it.  
- `/speckit.tasks` – breaks the plan into actionable tasks.
