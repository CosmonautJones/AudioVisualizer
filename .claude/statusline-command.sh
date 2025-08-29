#!/bin/bash

# Claude Code Comprehensive Status Line
# Chill & Fun Color Scheme

# Read JSON input from stdin
input=$(cat)

# Extract values from JSON
session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
model_id=$(echo "$input" | jq -r '.model.id // "unknown"')
model_name=$(echo "$input" | jq -r '.model.display_name // "Claude"')
current_dir=$(echo "$input" | jq -r '.workspace.current_dir // "unknown"')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir // "unknown"')
version=$(echo "$input" | jq -r '.version // "unknown"')
output_style=$(echo "$input" | jq -r '.output_style.name // "default"')

# Get current time and date
current_time=$(date '+%H:%M:%S')
current_date=$(date '+%a %b %d, %Y')

# Get git information (skip locks for safety)
git_branch="unknown"
git_status="unknown"
git_commits=""
git_dirty=""

if git rev-parse --git-dir > /dev/null 2>&1; then
    git_branch=$(git branch --show-current 2>/dev/null || echo "detached")
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        git_dirty="●"
    else
        git_dirty="○"
    fi
    
    # Get ahead/behind info
    git_commits=$(git rev-list --count --left-right @{upstream}...HEAD 2>/dev/null | tr '\t' '/' || echo "")
    
    # Get short status
    git_status=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
fi

# Color definitions - Chill & Fun theme
# Using ANSI escape codes with vibrant but readable colors
reset='\033[0m'
bold='\033[1m'
dim='\033[2m'

# Fun gradient colors
cyan_bright='\033[96m'      # Bright cyan for time
purple='\033[95m'           # Purple for session info
green_bright='\033[92m'     # Bright green for git clean
yellow_bright='\033[93m'    # Bright yellow for git changes
blue_bright='\033[94m'      # Bright blue for directories
magenta='\033[35m'          # Magenta for model info
orange='\033[38;5;208m'     # Orange (256-color)
pink='\033[38;5;206m'       # Pink (256-color)
lime='\033[38;5;154m'       # Lime green (256-color)
teal='\033[38;5;51m'        # Bright teal (256-color)
lavender='\033[38;5;183m'   # Lavender (256-color)

# Build the comprehensive status line
printf "${bold}${teal}╭─ Claude Code Status ─╮${reset}\n"

# Time & Date Line
printf "${cyan_bright}⏰ ${current_time} ${dim}│${reset} ${lavender}📅 ${current_date}${reset}\n"

# Session & Model Info Line  
printf "${purple}🎯 Session: ${dim}${session_id:0:8}...${reset} ${dim}│${reset} ${magenta}🤖 ${model_name} ${dim}(${model_id})${reset}\n"

# Version & Output Style Line
printf "${pink}⚡ v${version} ${dim}│${reset} ${orange}🎨 Style: ${output_style}${reset}\n"

# Directory Info Line
current_basename=$(basename "$current_dir")
project_basename=$(basename "$project_dir")

if [ "$current_dir" = "$project_dir" ]; then
    printf "${blue_bright}📂 ${project_basename} ${dim}(project root)${reset}\n"
else
    printf "${blue_bright}📂 ${current_basename} ${dim}in ${project_basename}${reset}\n"
fi

# Git Status Line (most detailed)
if [ "$git_branch" != "unknown" ]; then
    if [ "$git_dirty" = "●" ]; then
        git_color="${yellow_bright}"
        git_icon="⚡"
        status_text="dirty"
    else
        git_color="${green_bright}"
        git_icon="✨"
        status_text="clean"
    fi
    
    printf "${git_color}${git_icon} ${git_branch}${reset}"
    
    if [ -n "$git_commits" ] && [ "$git_commits" != "0/0" ]; then
        printf " ${dim}[±${git_commits}]${reset}"
    fi
    
    if [ "$git_status" != "0" ]; then
        printf " ${yellow_bright}(${git_status} changes)${reset}"
    fi
    
    printf " ${dim}│${reset} ${git_color}${status_text}${reset}\n"
else
    printf "${dim}📝 No git repository${reset}\n"
fi

# Path Details Line
printf "${lime}🗂️  ${dim}$(pwd)${reset}\n"

# Footer
printf "${bold}${teal}╰─────────────────────╯${reset}\n"