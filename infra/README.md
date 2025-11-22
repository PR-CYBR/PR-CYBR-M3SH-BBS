# Infrastructure Configuration

This directory contains Terraform configuration files for infrastructure provisioning.

## Structure

- `variables.tf` - Variable definitions
- `terraform.tfvars` - Variable values (template)
- `main.tf` - Main infrastructure configuration
- `outputs.tf` - Output values

## Terraform Cloud Integration

When this repository is created from the spec-bootstrap template, the initial provisioning workflow automatically:

1. Creates a Terraform Cloud workspace for this repository (same name as the repo)
2. Synchronizes variables defined in `variables.tf` and `terraform.tfvars`
3. Tags the workspace with "spec-bootstrap" and the repository name
4. Links the workspace to the PR-CYBR organization

**Important:** After the TFC workspace is created, update the workspace name in `main.tf`:

```hcl
cloud {
  organization = "pr-cybr"
  workspaces {
    name = "your-repo-name"  # Update this to match your repository name
  }
}
```

## Usage

### Local Development

```bash
# Initialize Terraform
terraform init

# Plan changes
terraform plan

# Apply changes (only in TFC remote execution)
# Use TFC UI or API to trigger runs
```

### Variables

Variables are synchronized to Terraform Cloud with proper categories:
- `TF_VAR_*` environment variables → `env` category in TFC
- Regular Terraform variables → `terraform` category in TFC

Sensitive variables are marked appropriately based on the `sensitive` attribute in `variables.tf`.

## Security

- Never commit sensitive values to version control
- Use Terraform Cloud for secure variable storage
- Sensitive values are injected at runtime via TFC or GitHub Secrets
