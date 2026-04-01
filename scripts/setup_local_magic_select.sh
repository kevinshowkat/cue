#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_dir="${CUE_MAGIC_SELECT_VENV:-$repo_root/.venv-magic-select}"
model_path="${CUE_MAGIC_SELECT_MODEL_PATH:-${JUGGERNAUT_MAGIC_SELECT_MODEL_PATH:-$repo_root/.local/models/mobile_sam.pt}}"
model_url="${CUE_MAGIC_SELECT_MODEL_URL:-https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt}"

choose_python() {
  if [[ -n "${CUE_MAGIC_SELECT_BOOTSTRAP_PYTHON:-}" ]]; then
    printf '%s\n' "$CUE_MAGIC_SELECT_BOOTSTRAP_PYTHON"
    return 0
  fi
  for candidate in python3.11 python3.12 python3.10 python3.9 python3; do
    if ! command -v "$candidate" >/dev/null 2>&1; then
      continue
    fi
    if "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if (3, 9) <= sys.version_info[:2] <= (3, 12) else 1)
PY
    then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "Local Magic Select setup needs Python 3.9 through 3.12 so torch can install cleanly." >&2
  exit 1
}

python_bin="$(choose_python)"

mkdir -p "$(dirname "$model_path")"

"$python_bin" -m venv "$venv_dir"
source "$venv_dir/bin/activate"

python -m pip install --upgrade pip
python -m pip install numpy pillow timm torch torchvision git+https://github.com/ChaoningZhang/MobileSAM.git

if [[ ! -f "$model_path" ]]; then
  temp_path="${model_path}.partial"
  rm -f "$temp_path"
  curl -L --fail "$model_url" -o "$temp_path"
  mv "$temp_path" "$model_path"
fi

python - <<'PY'
import importlib
mods = ["numpy", "PIL", "torch", "mobile_sam"]
for name in mods:
    importlib.import_module(name)
print("Local Magic Select Python runtime is ready.")
PY

cat <<EOF

Local Magic Select setup is ready.
Python: $venv_dir/bin/python
Weights: $model_path

Launch with:
  ./scripts/dev_desktop_magic_select.sh
EOF
