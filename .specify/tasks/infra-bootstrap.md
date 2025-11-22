# Task: Infrastructure Bootstrap with Terraform

## Objective

Initialize and validate the Terraform infrastructure baseline for PR-CYBR agent deployment. This task ensures that the Terraform configuration is properly set up and ready for customization.

## Requirements

- [ ] Review the Terraform configuration files in `infra/`
- [ ] Update `infra/variables.tfvars` with agent-specific values
- [ ] Initialize Terraform without remote backend
- [ ] Format and validate Terraform configuration
- [ ] Generate and review Terraform execution plan

## Implementation Steps

### 1. Navigate to Infrastructure Directory

```bash
cd infra
```

### 2. Initialize Terraform

Initialize Terraform without configuring the remote backend (backend configuration is commented out by default):

```bash
terraform init -backend=false
```

This command:
- Downloads required provider plugins (null provider by default)
- Prepares the local working directory
- Does not configure remote state (suitable for initial testing)

### 3. Format Terraform Files

Ensure consistent formatting across all Terraform files:

```bash
terraform fmt
```

This command automatically formats `.tf` files according to Terraform style conventions.

### 4. Validate Configuration

Check that the Terraform configuration is syntactically valid:

```bash
terraform validate
```

This command verifies:
- Correct HCL syntax
- Valid resource configurations
- Proper variable references

### 5. Generate Execution Plan

Create a plan to see what changes Terraform would make:

```bash
terraform plan -input=false -no-color -var-file=variables.tfvars
```

This command:
- Reads variable values from `variables.tfvars`
- Shows what resources would be created/modified
- Does not apply any changes
- Outputs plan in plain text format

## Configuration Customization

Before running the commands, update `infra/variables.tfvars`:

1. **agent_id**: Replace `"my-agent-id"` with your agent's unique identifier (lowercase, hyphens allowed)
2. **agent_role**: Set to the agent's role (e.g., "coordinator", "executor", "monitor")
3. **environment**: Set to "dev", "staging", or "prod" as appropriate
4. **dockerhub_user**: Configure via environment variable `TF_VAR_dockerhub_user` for security
5. **notion_page_id**: Add if using Notion for agent documentation (32-character hex string)

### Using Environment Variables for Secrets

For sensitive values, use environment variables instead of storing them in `.tfvars`:

```bash
export TF_VAR_dockerhub_user="your-dockerhub-username"
terraform plan -var-file=variables.tfvars
```

## Provider Configuration

The default configuration includes:
- **Null provider**: For testing and placeholder resources (enabled by default)
- **Terraform Cloud (tfe)**: Commented out, uncomment when ready for remote state
- **GitHub provider**: Commented out, uncomment when managing GitHub resources

To enable additional providers:
1. Edit `infra/providers.tf`
2. Uncomment the desired provider block
3. Configure authentication (typically via environment variables)
4. Run `terraform init` again to download the provider

## Remote Backend Configuration

When ready to use Terraform Cloud for remote state:

1. Edit `infra/main.tf`
2. Uncomment the `terraform.backend` block
3. Replace the workspace name placeholder with your actual workspace name (e.g., `agent-my-agent-id-dev`)
   - Note: Backend configuration does not support variable interpolation
4. Run `terraform init` (without `-backend=false`)
5. Authenticate with Terraform Cloud when prompted

## Acceptance Criteria

- [x] Terraform configuration files exist in `infra/` directory
- [ ] `terraform init -backend=false` completes successfully
- [ ] `terraform fmt` shows no formatting changes needed (or formats files correctly)
- [ ] `terraform validate` passes with no errors
- [ ] `terraform plan` generates a valid execution plan
- [ ] All variables in `variables.tfvars` are customized for the agent
- [ ] No sensitive values are committed to version control

## Status

**Ready for Implementation** - Follow the steps above to bootstrap your agent's infrastructure.

---

## Notes

- This task should be completed early in the agent development lifecycle
- The Terraform configuration serves as infrastructure-as-code documentation
- Keep the configuration minimal initially, expanding as infrastructure needs grow
- Always use `terraform plan` before `terraform apply` to preview changes
- Store sensitive credentials in environment variables or secret management systems
- The CI/CD pipeline automatically validates Terraform syntax on every push

## Integration with CI/CD

The GitHub Actions workflow automatically runs:
- `terraform fmt -check` to verify formatting
- `terraform validate` to check configuration validity
- `terraform plan` to ensure the configuration is executable

These checks run on every pull request to catch infrastructure issues early.
