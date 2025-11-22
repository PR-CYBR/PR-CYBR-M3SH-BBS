# Branching Strategy

## Overview

This repository implements a comprehensive branching scheme designed to support specification-driven development with clear separation of concerns across different phases of the development lifecycle. The branching model ensures that work flows systematically from specifications through planning, implementation, testing, staging, and production.

## Branch Purposes

### Primary Development Branches

#### `main`
- **Purpose**: Stable baseline representing production-ready code
- **Usage**: All changes integrated through the CI/CD pipeline eventually land here
- **Protection**: Branch protection rules enforce code review and passing tests
- **Workflow**: `spec-kit.yml` validates specification files on every push/PR
- **Promotion**: Automatically creates PRs to `stage` and `test` branches after successful validation

#### `dev`
- **Purpose**: Active development branch where feature work occurs before stabilization
- **Usage**: Integration point for completed implementations from `impl` branch
- **Workflow**: `dev.yml` runs development-specific tasks
- **Promotion**: Automatically creates PRs to `main` after successful workflow completion

### Specification and Planning Branches

#### `spec`
- **Purpose**: Branch for maintaining project specifications and requirements
- **Usage**: Work on technical specifications, requirements documentation, and API contracts
- **Workflow**: `spec.yml` validates specification documents
- **Promotion**: Automatically creates PRs to `plan` branch to trigger planning phase

#### `plan`
- **Purpose**: Branch for planning artifacts, project planning, and tasks
- **Usage**: Implementation planning, task breakdown, and project roadmaps
- **Workflow**: `plan.yml` validates planning documents
- **Promotion**: Automatically creates PRs to `impl` branch to begin implementation

### Implementation and Design Branches

#### `impl`
- **Purpose**: Implementation branch housing detailed implementation work separate from specifications
- **Usage**: Active coding work implementing features according to specifications and plans
- **Workflow**: `impl.yml` runs implementation-specific validation
- **Promotion**: Automatically creates PRs to `dev` branch for integration testing

#### `design`
- **Purpose**: Branch for design artifacts and UI/UX work
- **Usage**: Design mockups, UI components, design systems, and user experience documentation
- **Workflow**: `design.yml` validates design artifacts
- **Promotion**: Automatically creates PRs to `impl` branch to integrate design work

### Testing and Quality Branches

#### `test`
- **Purpose**: Branch dedicated to continuous integration and automated testing pipelines
- **Usage**: Test infrastructure, test suites, and quality assurance workflows
- **Workflow**: `test.yml` runs comprehensive test suites
- **Promotion**: Synchronized with `main` branch for testing stable code

#### `stage`
- **Purpose**: Staging environment branch used for pre-production testing
- **Usage**: Final validation before production deployment
- **Workflow**: `stage.yml` deploys to staging environment
- **Promotion**: Automatically creates PRs to `prod` branch after successful staging validation

### Production and Documentation Branches

#### `prod`
- **Purpose**: Production-ready branch representing stable, released code
- **Usage**: Code actively deployed to production environments
- **Workflow**: `prod.yml` handles production deployment tasks
- **Promotion**: Automatically creates PRs to `pages` branch for documentation updates

#### `pages`
- **Purpose**: Branch used to build and deploy the GitHub Pages site for documentation or demos
- **Usage**: Documentation website, API references, and public-facing content
- **Workflow**: `pages.yml` builds and deploys the documentation site
- **Protection**: Contains built artifacts for static site hosting

#### `gh-pages`
- **Purpose**: Branch for static site hosting used by GitHub Pages (if distinct from `pages`)
- **Usage**: Alternative or complementary branch for GitHub Pages deployment
- **Workflow**: `gh-pages.yml` handles GitHub Pages-specific build and deployment
- **Note**: Some projects use `pages` and `gh-pages` interchangeably; this template supports both

#### `codex`
- **Purpose**: Branch for knowledge-base documents and code examples
- **Usage**: Code samples, tutorials, best practices, and technical knowledge articles
- **Workflow**: `codex.yml` validates and organizes knowledge base content
- **Promotion**: Automatically creates PRs to `pages` branch to publish knowledge base

## Branching Workflow

### Development Lifecycle Flow

```
spec → plan → impl → dev → main → stage → prod → pages
         ↓                   ↑
       design ──────────────┘
       codex ───────────────────────────────────→ pages
                            ↓
                          test
```

### Typical Workflow Steps

1. **Specification Phase**: Work in `spec` branch to define requirements
2. **Planning Phase**: Promote to `plan` branch to break down implementation tasks
3. **Design Phase**: Create design artifacts in `design` branch (parallel to planning)
4. **Implementation Phase**: Code features in `impl` branch following the plan
5. **Development Integration**: Merge to `dev` branch for feature integration
6. **Stabilization**: Promote to `main` branch as stable baseline
7. **Testing**: Validate in `test` branch with comprehensive test suites
8. **Staging**: Deploy to `stage` branch for pre-production validation
9. **Production**: Release to `prod` branch for production deployment
10. **Documentation**: Update `pages` branch with current documentation
11. **Knowledge Sharing**: Maintain examples and tutorials in `codex` branch

## Automated Pull Requests

The repository includes automated workflows that create pull requests between branches to facilitate the promotion flow:

- `auto-pr-spec-to-plan.yml`: spec → plan
- `auto-pr-plan-to-impl.yml`: plan → impl
- `auto-pr-design-to-impl.yml`: design → impl
- `auto-pr-impl-to-dev.yml`: impl → dev
- `auto-pr-dev-to-main.yml`: dev → main
- `auto-pr-main-to-stage.yml`: main → stage
- `auto-pr-main-to-test.yml`: main → test
- `auto-pr-stage-to-prod.yml`: stage → prod
- `auto-pr-prod-to-pages.yml`: prod → pages
- `auto-pr-codex-to-pages.yml`: codex → pages

These workflows trigger after successful completion of the corresponding branch workflow, creating a pull request if one doesn't already exist.

## Branch Protection Rules

Recommended branch protection rules:

### Critical Branches (main, prod, stage)
- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators in restrictions
- Require linear history

### Integration Branches (dev, impl, test)
- Require status checks to pass before merging
- Require branches to be up to date before merging

### Documentation Branches (pages, gh-pages)
- Require status checks to pass before merging
- Allow force pushes for build artifacts (if needed)

### Working Branches (spec, plan, design, codex)
- Minimal restrictions to facilitate rapid iteration
- Optional: require status checks to pass

## Best Practices

1. **Start with Specifications**: Always begin work in the `spec` branch to define what needs to be built
2. **Plan Before Implementing**: Use the `plan` branch to break down specifications into actionable tasks
3. **Separate Concerns**: Keep design work in `design`, implementation in `impl`, and testing in `test`
4. **Follow the Flow**: Let automated PRs guide work through the pipeline
5. **Review at Each Stage**: Manual review and approval at key promotion points (dev→main, stage→prod)
6. **Document as You Go**: Keep `codex` updated with examples and `pages` with current documentation
7. **Test Thoroughly**: Validate changes in `test` and `stage` before production
8. **Maintain History**: Use merge commits for traceability across branch transitions

## Initial Repository Setup

When using this template for a new repository:

1. **Create All Branches**: Create empty commits on all branches to initialize them
2. **Configure Branch Protection**: Apply recommended protection rules
3. **Enable GitHub Pages**: Configure Pages to deploy from the `pages` or `gh-pages` branch
4. **Set Default Branch**: Keep `main` as the default branch for cloning
5. **Update Workflows**: Customize workflow steps for your specific technology stack

## Adapting the Model

This branching strategy is designed to be comprehensive but flexible:

- **Simplify**: Remove branches not needed for your project (e.g., if no design phase, remove `design`)
- **Extend**: Add additional branches for specific needs (e.g., `hotfix`, `release`)
- **Customize**: Modify auto-PR flows to match your team's workflow
- **Document**: Update this file to reflect any customizations made

## Spec-Kit Integration

This branching model integrates seamlessly with the Spec-Kit framework:

- Specifications in `.specify/` directory are validated on all branches
- Planning tasks in `.specify/tasks/` guide work in the `plan` and `impl` branches
- Constitution rules in `.specify/constitution.md` apply across all branches
- Automation workflows ensure spec-driven development practices are followed

## Questions and Support

For questions about the branching strategy or to propose modifications:

1. Open an issue in this repository
2. Reference this document in the issue description
3. Tag the issue with `branching` label
4. Propose specific changes to improve the workflow

---

**Note**: This branching strategy is designed as a template. Adapt it to your project's specific needs while maintaining the core principle of specification-driven development.
