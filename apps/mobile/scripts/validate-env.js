const fs = require('node:fs');
const path = require('node:path');

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
];

const loadLocalEnv = () => {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  return lines.reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return acc;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    acc[key] = value;
    return acc;
  }, {});
};

const localEnv = loadLocalEnv();

const missing = required.filter((name) => {
  const value = process.env[name] || localEnv[name];
  return !value || value.includes('your-') || value.startsWith('replace-') || value.includes('example.com');
});

if (missing.length > 0) {
  console.error(`Missing production mobile environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Mobile environment variables are configured.');
