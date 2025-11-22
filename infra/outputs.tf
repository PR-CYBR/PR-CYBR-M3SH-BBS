# Terraform Outputs for PR-CYBR Agent Infrastructure
# These outputs provide key information about the deployed infrastructure

output "agent_id" {
  description = "The unique identifier for this PR-CYBR agent"
  value       = var.agent_id
}

output "agent_role" {
  description = "The role or function of this agent"
  value       = var.agent_role
}

output "environment" {
  description = "The deployment environment for this agent"
  value       = var.environment
}

output "agent_config" {
  description = "Combined agent configuration summary"
  value = {
    agent_id    = var.agent_id
    agent_role  = var.agent_role
    environment = var.environment
  }
}

# Add additional outputs as needed for your agent infrastructure
# Examples:
# output "service_url" {
#   description = "URL of the deployed agent service"
#   value       = "https://${var.agent_id}.${var.environment}.pr-cybr.com"
# }
