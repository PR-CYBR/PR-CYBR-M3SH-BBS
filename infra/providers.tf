# Terraform Providers Configuration
# Configure providers needed for PR-CYBR agent infrastructure

terraform {
  required_version = ">= 1.0"

  required_providers {
    # Terraform Cloud provider for remote state and workspace management
    # Uncomment when ready to use Terraform Cloud
    # tfe = {
    #   source  = "hashicorp/tfe"
    #   version = "~> 0.51"
    # }

    # GitHub provider for repository and workflow management
    # Uncomment and configure when needed
    # github = {
    #   source  = "integrations/github"
    #   version = "~> 5.0"
    # }

    # Null provider for testing and placeholder resources
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Terraform Cloud Provider Configuration
# Uncomment and configure when ready to use remote backend
# provider "tfe" {
#   # Token can be set via TFE_TOKEN environment variable
#   # hostname = "app.terraform.io"  # Default, can be omitted
# }

# GitHub Provider Configuration
# Uncomment and configure when managing GitHub resources
# provider "github" {
#   # Token can be set via GITHUB_TOKEN environment variable
#   # owner = "PR-CYBR"
# }

# Null Provider - Used for local provisioners and testing
provider "null" {
  # No configuration required
}
