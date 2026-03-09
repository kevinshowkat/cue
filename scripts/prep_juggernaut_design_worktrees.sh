#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"

worktrees=(
  "${parent_dir}/juggernaut-design-layout"
  "${parent_dir}/juggernaut-design-visual"
  "${parent_dir}/juggernaut-design-runtime"
  "${parent_dir}/juggernaut-design-icons"
  "${parent_dir}/juggernaut-design-native"
)

for worktree_path in "${worktrees[@]}"; do
  desktop_path="${worktree_path}/desktop"
  if [[ ! -d "${desktop_path}" ]]; then
    echo "[juggernaut-design] skip missing ${desktop_path}"
    continue
  fi

  echo "[juggernaut-design] npm install in ${desktop_path}"
  (
    cd "${desktop_path}"
    npm install
  )
done

echo "[juggernaut-design] prep complete"
