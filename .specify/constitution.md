# Constitution  
  
## Purpose  
  
This repository serves as a language‑agnostic Spec‑Kit template for spec‑driven development. It provides a foundational structure that can be adapted for any technology stack.  
  
## Principles  
  
1. **Specification‑Driven Development**  
All development begins with clear specifications. Code implements specifications, not vice versa.  
  
2. **Language Agnostic**  
This template maintains neutrality regarding programming languages, frameworks, and tooling. Teams can adopt any technology stack that suits their needs.  
  
3. **Incremental Planning**  
Work is broken down into discrete, manageable tasks that can be tracked and validated independently.  
  
4. **Automation First**  
Repetitive processes are automated through workflows and scripts, reducing manual effort and human error.  
  
5. **Documentation as Code**  
Documentation lives alongside code, versioned and reviewed through the same processes.  
  
## Structure  
  
/.specify  
Core directory containing:  
- **constitution.md** – This file, defining project principles  
- **spec.md** – Technical specifications and requirements  
- **plan.md** – High‑level implementation plan  
- **/tasks/** – Directory for individual task specifications  
  
/.github/workflows  
Automation workflows for linting, validation, and task management.  
  
## Governance  
  
Changes to the constitution require explicit review and approval. The constitution serves as the foundational agreement for how the project operates.  
  
## Adaptability  

This template is language‑agnostic; teams should make minimal changes when adapting the template to their specific tools.  

## Branching Strategy  

This repository implements a comprehensive branching scheme to support specification‑driven development:  

- **Specification Branches** (`spec`): Requirements and technical specifications  
- **Planning Branches** (`plan`): Implementation planning and task breakdown  
- **Design Branches** (`design`): UI/UX artifacts and design systems  
- **Implementation Branches** (`impl`): Active development work  
- **Development Branches** (`dev`): Feature integration and testing  
- **Main Branch** (`main`): Stable baseline for production  
- **Test Branches** (`test`): Continuous integration and automated testing  
- **Staging Branches** (`stage`): Pre‑production validation  
- **Production Branches** (`prod`): Deployed production code  
- **Documentation Branches** (`pages`, `gh-pages`): Static site hosting and documentation  
- **Knowledge Branches** (`codex`): Code examples and knowledge base  

Work flows systematically through these branches using automated pull requests. Each branch has dedicated workflows that validate changes according to the phase of development. See [BRANCHING.md](../BRANCHING.md) for complete documentation.  

## Provisioning Protocol
  
The initial bootstrap of any repository derived from this template requires special handling to allow automation while preserving security. The provisioning protocol is:  
  
- **Detection of initial provisioning**: The workflow detects the absence of prior commits on the default branch or uses a tag (for example, `bootstrap-complete`) to identify when a repository is being initialized for the first time.  
- **Temporary relaxation of branch protection**: Using GitHub’s API, branch protection rules on the default branch are temporarily relaxed, granting automation bots permission to merge PRs. These protections are re‑enabled immediately after the merge.  
- **Automated merging of bootstrap pull requests**: Bootstrap pull requests created by Copilot or other automation are automatically marked as ready for review and merged by the workflow. Each automated merge is tagged for traceability.  
- **Reinstatement of branch protection**: Immediately after merges, the workflow re‑enables the original branch protection rules to ensure the repository remains protected going forward.  
- **Safeguards and fallback**: The workflow includes safeguards to prevent recursive invocation and handles API rate limits or permission errors gracefully. If automation encounters an error or is disabled, maintainers may perform the initial merge manually. After the first merge (whether manual or automated), all subsequent merges follow the normal CI/CD rules and respect branch protections.
