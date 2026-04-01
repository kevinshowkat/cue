#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_dir="${CUE_MAGIC_SELECT_VENV:-$repo_root/.venv-magic-select}"
default_python="$venv_dir/bin/python"
default_model_path="$repo_root/.local/models/mobile_sam.pt"
helper_path="$repo_root/scripts/magic_select_mobile_sam.py"

if [[ -f "$repo_root/.env.magic-select.local" ]]; then
  set -a
  source "$repo_root/.env.magic-select.local"
  set +a
fi

export CUE_MAGIC_SELECT_PYTHON="${CUE_MAGIC_SELECT_PYTHON:-${JUGGERNAUT_MAGIC_SELECT_PYTHON:-$default_python}}"
export CUE_MAGIC_SELECT_HELPER="${CUE_MAGIC_SELECT_HELPER:-${JUGGERNAUT_MAGIC_SELECT_HELPER:-$helper_path}}"
export CUE_MAGIC_SELECT_MODEL_PATH="${CUE_MAGIC_SELECT_MODEL_PATH:-${JUGGERNAUT_MAGIC_SELECT_MODEL_PATH:-$default_model_path}}"
export CUE_MAGIC_SELECT_MODEL_ID="${CUE_MAGIC_SELECT_MODEL_ID:-${JUGGERNAUT_MAGIC_SELECT_MODEL_ID:-mobile_sam_vit_t}}"
export CUE_MAGIC_SELECT_MODEL_REVISION="${CUE_MAGIC_SELECT_MODEL_REVISION:-${JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION:-unknown}}"
export CUE_MAGIC_SELECT_THREADS="${CUE_MAGIC_SELECT_THREADS:-${JUGGERNAUT_MAGIC_SELECT_THREADS:-1}}"
export CUE_MAGIC_SELECT_IMAGE_CACHE_SIZE="${CUE_MAGIC_SELECT_IMAGE_CACHE_SIZE:-${JUGGERNAUT_MAGIC_SELECT_IMAGE_CACHE_SIZE:-4}}"

# Mirror the preferred Cue names into the current legacy aliases until the runtime stops reading them.
export JUGGERNAUT_MAGIC_SELECT_PYTHON="${JUGGERNAUT_MAGIC_SELECT_PYTHON:-$CUE_MAGIC_SELECT_PYTHON}"
export JUGGERNAUT_MAGIC_SELECT_HELPER="${JUGGERNAUT_MAGIC_SELECT_HELPER:-$CUE_MAGIC_SELECT_HELPER}"
export JUGGERNAUT_MAGIC_SELECT_MODEL_PATH="${JUGGERNAUT_MAGIC_SELECT_MODEL_PATH:-$CUE_MAGIC_SELECT_MODEL_PATH}"
export JUGGERNAUT_MAGIC_SELECT_MODEL_ID="${JUGGERNAUT_MAGIC_SELECT_MODEL_ID:-$CUE_MAGIC_SELECT_MODEL_ID}"
export JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION="${JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION:-$CUE_MAGIC_SELECT_MODEL_REVISION}"
export JUGGERNAUT_MAGIC_SELECT_THREADS="${JUGGERNAUT_MAGIC_SELECT_THREADS:-$CUE_MAGIC_SELECT_THREADS}"
export JUGGERNAUT_MAGIC_SELECT_IMAGE_CACHE_SIZE="${JUGGERNAUT_MAGIC_SELECT_IMAGE_CACHE_SIZE:-$CUE_MAGIC_SELECT_IMAGE_CACHE_SIZE}"

if [[ ! -x "$CUE_MAGIC_SELECT_PYTHON" ]]; then
  echo "Local Magic Select Python runtime not found at $CUE_MAGIC_SELECT_PYTHON" >&2
  echo "Run ./scripts/setup_local_magic_select.sh first." >&2
  exit 1
fi

if [[ ! -f "$CUE_MAGIC_SELECT_HELPER" ]]; then
  echo "Local Magic Select helper not found at $CUE_MAGIC_SELECT_HELPER" >&2
  exit 1
fi

if [[ ! -f "$CUE_MAGIC_SELECT_MODEL_PATH" ]]; then
  echo "Local Magic Select weights not found at $CUE_MAGIC_SELECT_MODEL_PATH" >&2
  echo "Run ./scripts/setup_local_magic_select.sh first." >&2
  exit 1
fi

exec "$repo_root/scripts/dev_desktop.sh"
