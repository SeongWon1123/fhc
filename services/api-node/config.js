function isPlaceholder(value) {
  const normalized = String(value || '').trim();
  return (
    !normalized ||
    normalized.startsWith('your_') ||
    normalized.startsWith('dev-placeholder') ||
    normalized === 'replace-with-a-strong-local-secret' ||
    normalized === 'dev-only-change-me' ||
    normalized.includes('your-project')
  );
}

function csvEnv(name, fallback) {
  return String(process.env[name] || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProduction() {
  return String(process.env.ENVIRONMENT || '').toLowerCase() === 'production';
}

function productionConfigErrors() {
  if (!isProduction()) return [];

  const errors = [];
  const required = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  for (const [name, value] of Object.entries(required)) {
    if (isPlaceholder(value)) {
      errors.push(`${name} is missing or still uses a placeholder`);
    }
  }

  const origins = csvEnv('ALLOWED_ORIGINS', '');
  if (origins.includes('*')) {
    errors.push("ALLOWED_ORIGINS must not contain '*' in production");
  }
  if (origins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    errors.push('ALLOWED_ORIGINS must not contain localhost origins in production');
  }

  return errors;
}

function assertProductionReady() {
  const errors = productionConfigErrors();
  if (errors.length) {
    throw new Error(`Production configuration is invalid: ${errors.join('; ')}`);
  }
}

module.exports = {
  assertProductionReady,
  csvEnv,
  isPlaceholder,
  isProduction,
  productionConfigErrors,
};
