#!/bin/bash
set -euo pipefail

# Terraform Cloud Workspace Sync Script
# This script authenticates with Terraform Cloud, creates/updates workspaces,
# and synchronizes variables from infra/ directory

# Configuration
TFC_ORG="${TFC_ORG:-pr-cybr}"
TFC_TOKEN="${TFC_TOKEN:-}"
TFC_API_URL="${TFC_API_URL:-https://app.terraform.io/api/v2}"
REPO_NAME="${GITHUB_REPOSITORY##*/}"
WORKSPACE_NAME="${WORKSPACE_NAME:-$REPO_NAME}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation
validate_prerequisites() {
    if [ -z "$TFC_TOKEN" ]; then
        log_error "TFC_TOKEN environment variable is not set"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi

    log_info "Prerequisites validated"
}

# TFC API Helper Functions
tfc_api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    local curl_args=(
        -s -w "\n%{http_code}"
        -X "$method"
        -H "Authorization: Bearer $TFC_TOKEN"
        -H "Content-Type: application/vnd.api+json"
    )
    
    if [ -n "$data" ]; then
        curl_args+=(-d "$data")
    fi
    
    curl "${curl_args[@]}" "$TFC_API_URL$endpoint"
}

# Check if workspace exists
check_workspace_exists() {
    local workspace_name="$1"
    log_info "Checking if workspace '$workspace_name' exists in organization '$TFC_ORG'"
    
    local response
    response=$(tfc_api_call "GET" "/organizations/$TFC_ORG/workspaces/$workspace_name" 2>&1) || true
    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        log_info "Workspace '$workspace_name' exists"
        echo "$body" | jq -r '.data.id'
        return 0
    elif [ "$http_code" = "404" ]; then
        log_info "Workspace '$workspace_name' does not exist"
        return 1
    else
        log_error "Error checking workspace: HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 2
    fi
}

# Create workspace
create_workspace() {
    local workspace_name="$1"
    log_info "Creating workspace '$workspace_name' in organization '$TFC_ORG'"
    
    local payload
    payload=$(jq -n \
        --arg name "$workspace_name" \
        --arg repo "$GITHUB_REPOSITORY" \
        '{
            data: {
                type: "workspaces",
                attributes: {
                    name: $name,
                    "description": ("Workspace for " + $repo + " - auto-created by spec-bootstrap"),
                    "auto-apply": false,
                    "terraform-version": "~> 1.0",
                    "working-directory": "infra",
                    "execution-mode": "remote"
                }
            }
        }')
    
    local response
    response=$(tfc_api_call "POST" "/organizations/$TFC_ORG/workspaces" "$payload")
    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "201" ]; then
        log_info "Workspace created successfully"
        echo "$body" | jq -r '.data.id'
        return 0
    else
        log_error "Error creating workspace: HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Tag workspace
tag_workspace() {
    local workspace_id="$1"
    local tags=("spec-bootstrap" "$REPO_NAME")
    
    log_info "Tagging workspace with: ${tags[*]}"
    
    for tag in "${tags[@]}"; do
        local payload
        payload=$(jq -n \
            --arg tag "$tag" \
            '{
                data: [{
                    type: "tags",
                    attributes: {
                        name: $tag
                    }
                }]
            }')
        
        local response
        response=$(tfc_api_call "POST" "/workspaces/$workspace_id/relationships/tags" "$payload")
        local http_code
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "204" ] || [ "$http_code" = "200" ]; then
            log_info "Tag '$tag' applied successfully"
        else
            log_warn "Could not apply tag '$tag': HTTP $http_code"
        fi
    done
}

# Parse and sync variables from Terraform files
sync_terraform_variables() {
    local workspace_id="$1"
    local tf_dir="${2:-infra}"
    
    if [ ! -d "$tf_dir" ]; then
        log_warn "Directory '$tf_dir' does not exist, skipping variable sync"
        return 0
    fi
    
    log_info "Syncing variables from '$tf_dir'"
    
    local var_file="$tf_dir/variables.tf"
    local tfvars_file="$tf_dir/terraform.tfvars"
    
    if [ ! -f "$var_file" ]; then
        log_warn "No variables.tf found, skipping variable sync"
        return 0
    fi
    
    log_info "Found $var_file"
    
    # Parse variable names from variables.tf
    local var_names
    var_names=$(grep -E '^variable\s+"[^"]+"' "$var_file" | sed -E 's/variable\s+"([^"]+)".*/\1/' || true)
    
    if [ -z "$var_names" ]; then
        log_info "No variables found in $var_file"
        return 0
    fi
    
    # Parse values from terraform.tfvars if it exists
    local tfvars_content=""
    if [ -f "$tfvars_file" ]; then
        log_info "Found $tfvars_file"
        tfvars_content=$(cat "$tfvars_file")
    fi
    
    # Sync each variable
    while IFS= read -r var_name; do
        [ -z "$var_name" ] && continue
        
        # Try to get value from tfvars file
        local var_value=""
        if [ -n "$tfvars_content" ]; then
            # First try to extract quoted values
            var_value=$(echo "$tfvars_content" | grep -E "^\s*${var_name}\s*=" | sed -E 's/^[^=]*=\s*"([^"]*)".*/\1/' | head -1 || echo "")
            # If empty, try unquoted values
            if [ -z "$var_value" ]; then
                var_value=$(echo "$tfvars_content" | grep -E "^\s*${var_name}\s*=" | sed -E 's/^[^=]*=\s*([^#\s]+).*/\1/' | head -1 || echo "")
            fi
        fi
        
        # Check if variable is marked as sensitive in variables.tf
        local is_sensitive="false"
        if grep -A 10 "^variable \"$var_name\"" "$var_file" | grep -E "^\s*sensitive\s*=\s*true" > /dev/null 2>&1; then
            is_sensitive="true"
            log_info "Variable '$var_name' is marked as sensitive"
        fi
        
        # Only sync variables that have values in tfvars
        if [ -n "$var_value" ]; then
            sync_variable "$workspace_id" "$var_name" "$var_value" "terraform" "$is_sensitive" "Synced from $tf_dir/terraform.tfvars"
        else
            log_info "Variable '$var_name' has no value in terraform.tfvars, skipping"
        fi
    done <<< "$var_names"
    
    log_info "Variable synchronization complete"
}

# Get existing workspace variables
get_workspace_variables() {
    local workspace_id="$1"
    log_info "Fetching existing variables for workspace"
    
    local response
    response=$(tfc_api_call "GET" "/workspaces/$workspace_id/vars")
    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo "$body" | jq -r '.data[] | "\(.attributes.key)|\(.id)|\(.attributes.category)"'
    else
        log_error "Error fetching variables: HTTP $http_code"
        return 1
    fi
}

# Create or update variable
sync_variable() {
    local workspace_id="$1"
    local key="$2"
    local value="$3"
    local category="${4:-terraform}"  # terraform or env
    local sensitive="${5:-false}"
    local description="${6:-}"
    
    log_info "Syncing variable '$key' (category: $category, sensitive: $sensitive)"
    
    # Check if variable exists
    local existing_vars
    existing_vars=$(get_workspace_variables "$workspace_id" 2>/dev/null || echo "")
    
    local var_id=""
    local existing_var
    existing_var=$(echo "$existing_vars" | grep "^$key|" || true)
    
    if [ -n "$existing_var" ]; then
        var_id=$(echo "$existing_var" | cut -d'|' -f2)
        log_info "Variable '$key' exists (ID: $var_id), updating..."
        
        local payload
        payload=$(jq -n \
            --arg key "$key" \
            --arg value "$value" \
            --arg category "$category" \
            --argjson sensitive "$sensitive" \
            --arg description "$description" \
            '{
                data: {
                    type: "vars",
                    attributes: {
                        key: $key,
                        value: $value,
                        category: $category,
                        sensitive: $sensitive,
                        description: $description
                    }
                }
            }')
        
        local response
        response=$(tfc_api_call "PATCH" "/workspaces/$workspace_id/vars/$var_id" "$payload")
        local http_code
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            log_info "Variable '$key' updated successfully"
        else
            log_error "Error updating variable '$key': HTTP $http_code"
        fi
    else
        log_info "Variable '$key' does not exist, creating..."
        
        local payload
        payload=$(jq -n \
            --arg key "$key" \
            --arg value "$value" \
            --arg category "$category" \
            --argjson sensitive "$sensitive" \
            --arg description "$description" \
            '{
                data: {
                    type: "vars",
                    attributes: {
                        key: $key,
                        value: $value,
                        category: $category,
                        sensitive: $sensitive,
                        description: $description
                    }
                }
            }')
        
        local response
        response=$(tfc_api_call "POST" "/workspaces/$workspace_id/vars" "$payload")
        local http_code
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "201" ]; then
            log_info "Variable '$key' created successfully"
        else
            log_error "Error creating variable '$key': HTTP $http_code"
        fi
    fi
}

# Main execution
main() {
    log_info "=== Terraform Cloud Workspace Sync ==="
    log_info "Organization: $TFC_ORG"
    log_info "Workspace: $WORKSPACE_NAME"
    log_info "Repository: ${GITHUB_REPOSITORY:-N/A}"
    
    validate_prerequisites
    
    # Check or create workspace
    local workspace_id
    workspace_id=$(check_workspace_exists "$WORKSPACE_NAME") || {
        workspace_id=$(create_workspace "$WORKSPACE_NAME") || {
            log_error "Failed to create workspace"
            exit 1
        }
    }
    
    log_info "Workspace ID: $workspace_id"
    
    # Tag the workspace
    tag_workspace "$workspace_id"
    
    # Sync variables from infra directory
    sync_terraform_variables "$workspace_id" "infra"
    
    # Generate JSON summary for Codex
    local summary
    summary=$(jq -n \
        --arg org "$TFC_ORG" \
        --arg workspace "$WORKSPACE_NAME" \
        --arg workspace_id "$workspace_id" \
        --arg repo "${GITHUB_REPOSITORY:-unknown}" \
        '{
            action: "tfc-sync",
            organization: $org,
            workspace: $workspace,
            workspace_id: $workspace_id,
            repository: $repo,
            status: "success",
            timestamp: now | strftime("%Y-%m-%dT%H:%M:%SZ")
        }')
    
    log_info "=== Sync Summary ==="
    echo "$summary" | jq '.'
    
    log_info "=== Terraform Cloud Workspace Sync Complete ==="
}

# Run main function
main "$@"
