#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
version="${RELEASE_VERSION:-${1:-}}"
stage="${RELEASE_STAGE:-${2:-staging}}"
output_dir="${RELEASE_OUTPUT_DIR:-${repo_root}/dist/release}"

if [[ -z "${version}" ]]; then
  if git -C "${repo_root}" describe --tags --exact-match >/dev/null 2>&1; then
    version="$(git -C "${repo_root}" describe --tags --exact-match)"
  else
    version="dev-$(date -u +%Y%m%d%H%M%S)"
  fi
fi

case "${stage}" in
  staging|prod|production) ;;
  *)
    echo "Unsupported RELEASE_STAGE '${stage}'. Use staging, prod, or production." >&2
    exit 1
    ;;
esac

safe_version="${version//\//-}"
package_name="fitconnect-${safe_version}-${stage}"
staging_dir="${output_dir}/${package_name}"
archive_path="${output_dir}/${package_name}.tar.gz"
manifest_path="${staging_dir}/RELEASE_MANIFEST.txt"

rm -rf "${staging_dir}" "${archive_path}"
mkdir -p "${staging_dir}"

copy_path() {
  local source_path="$1"
  local target_path="${staging_dir}/${source_path}"

  if [[ -e "${repo_root}/${source_path}" ]]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -R "${repo_root}/${source_path}" "${target_path}"
  fi
}

copy_path ".env.example"
copy_path "docker-compose.yml"
copy_path "nginx"
copy_path "infra/data/README.md"
copy_path "infra/data/templates"
copy_path "infra/scripts"
copy_path "infra/supabase"
copy_path "docs/RELEASE_RUNBOOK.md"
copy_path "docs/QA_RELEASE_CHECKLIST.md"
copy_path "apps/web/Dockerfile"
copy_path "apps/web/nginx.conf"
copy_path "apps/web/package.json"
copy_path "apps/web/package-lock.json"
copy_path "apps/web/index.html"
copy_path "apps/web/public"
copy_path "apps/web/src"
copy_path "apps/web/tsconfig.json"
copy_path "apps/web/tsconfig.app.json"
copy_path "apps/web/tsconfig.node.json"
copy_path "apps/web/vite.config.ts"
copy_path "apps/web/eslint.config.js"
copy_path "services/api-fastapi/Dockerfile"
copy_path "services/api-fastapi/requirements.txt"
copy_path "services/api-fastapi/main.py"
copy_path "services/api-fastapi/app"
copy_path "services/api-node/Dockerfile"
copy_path "services/api-node/package.json"
copy_path "services/api-node/package-lock.json"
copy_path "services/api-node/index.js"
copy_path "services/api-node/routes"
copy_path "services/api-node/middleware"
copy_path "scripts/release"

{
  echo "name=${package_name}"
  echo "version=${version}"
  echo "stage=${stage}"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if git -C "${repo_root}" rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "commit=$(git -C "${repo_root}" rev-parse HEAD)"
  else
    echo "commit=unknown"
  fi
  echo
  echo "contents:"
  find "${staging_dir}" -type f \
    ! -path "${manifest_path}" \
    | sed "s#${staging_dir}/##" \
    | sort
} > "${manifest_path}"

tar -C "${output_dir}" -czf "${archive_path}" "${package_name}"

echo "Created ${archive_path}"
echo "Created ${manifest_path}"
