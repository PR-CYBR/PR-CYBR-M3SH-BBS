# PR-CYBR Agent Configuration Template
# Replace placeholder values with actual configuration for your agent
# DO NOT commit sensitive values - use environment variables (TF_VAR_*) for secrets

# Required: Unique identifier for this agent
agent_id = "my-agent-id"

# Optional: Agent role or function
agent_role = "agent"

# Required: Deployment environment
environment = "dev"

# Sensitive: DockerHub username (consider using TF_VAR_dockerhub_user instead)
# dockerhub_user = ""

# Optional: Notion page ID for documentation
# notion_page_id = ""
