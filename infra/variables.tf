# PR-CYBR Agent Standard Variables
# These variables align with the PR-CYBR agent-variables.tf standard
# Values can be provided via variables.tfvars or environment variables (TF_VAR_*)

variable "agent_id" {
  description = "Unique identifier for the PR-CYBR agent"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.agent_id))
    error_message = "Agent ID must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "agent_role" {
  description = "Role or function of the PR-CYBR agent (e.g., coordinator, executor, monitor)"
  type        = string
  default     = "agent"

  validation {
    condition     = length(var.agent_role) > 0
    error_message = "Agent role must not be empty."
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "dockerhub_user" {
  description = "DockerHub username for container registry access"
  type        = string
  sensitive   = true
  default     = ""
}

variable "notion_page_id" {
  description = "Notion page ID for agent documentation and tracking"
  type        = string
  default     = ""

  validation {
    condition     = var.notion_page_id == "" || can(regex("^[a-f0-9]{32}$", var.notion_page_id))
    error_message = "Notion page ID must be a 32-character hexadecimal string or empty."
  }
}

# Additional agent-specific variables can be added below
# Follow the PR-CYBR naming conventions and include appropriate validation
