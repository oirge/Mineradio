'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Audit both locked dependency trees, including Electron's shipped runtime.
// The only accepted high advisory is an unused upstream FTP provider whose
// parent still requires basic-ftp 5.x; the desktop Folia build excludes online
// providers. Changed severity/range or another advisory requires a new review.
const UNUSED_UPSTREAM_FTP_ADVISORY = 'https://github.com/advisories/GHSA-c475-qrg2-pj4r';
const root = path.resolve(__dirname, '..');

function classifyAudit(audit, scope) {
  const findings = new Map();
  const vulnerabilities = audit.vulnerabilities || {};
  function reviewedFtp(name, advisory) {
    return scope === 'folia' && name === 'basic-ftp'
      && advisory.name === 'basic-ftp' && advisory.dependency === 'basic-ftp'
      && advisory.url === UNUSED_UPSTREAM_FTP_ADVISORY
      && advisory.severity === 'high' && advisory.range === '<=6.2.0';
  }
  function resolveAdvisories(name, ancestors = new Set()) {
    if (ancestors.has(name)) return { complete: false, details: [] };
    const entry = vulnerabilities[name];
    if (!entry || !Array.isArray(entry.via) || !entry.via.length) return { complete: false, details: [] };
    const next = new Set(ancestors).add(name);
    let complete = true;
    const details = [];
    for (const advisory of entry.via) {
      if (advisory && typeof advisory === 'object') details.push({ name, advisory });
      else if (typeof advisory === 'string') {
        const nested = resolveAdvisories(advisory, next);
        complete = complete && nested.complete;
        details.push(...nested.details);
      } else complete = false;
    }
    return { complete, details };
  }
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    for (const advisory of entry.via || []) {
      if (!advisory || typeof advisory === 'string') continue;
      const accepted = reviewedFtp(name, advisory);
      const finding = {
        name,
        severity: advisory.severity,
        title: advisory.title,
        url: advisory.url,
        range: advisory.range,
        accepted,
      };
      findings.set(name + ':' + (advisory.source || advisory.url || advisory.title)
        + ':' + advisory.severity, finding);
    }
  }
  // Inherited high entries are accepted only if every leaf is the same reviewed
  // FTP finding. A critical parent or an incomplete/mixed chain remains blocking.
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (entry.severity !== 'high' && entry.severity !== 'critical') continue;
    const chain = resolveAdvisories(name);
    if (entry.severity === 'high' && chain.complete && chain.details.length
        && chain.details.every(detail => reviewedFtp(detail.name, detail.advisory))) continue;
    const alreadyBlocking = chain.complete && chain.details.some(detail =>
      !reviewedFtp(detail.name, detail.advisory) && (entry.severity === 'high'
        ? detail.advisory.severity === 'high' || detail.advisory.severity === 'critical'
        : detail.name === name && detail.advisory.severity === 'critical'));
    if (!alreadyBlocking) {
      findings.set(name + ':unreviewed-chain', {
        name, severity: entry.severity,
        title: chain.complete ? 'High/critical dependency chain is not covered by the reviewed exception'
          : 'Audit dependency chain has incomplete advisory details',
        url: '', range: entry.range, accepted: false,
      });
    }
  }
  if (audit.metadata && audit.metadata.vulnerabilities
      && Number(audit.metadata.vulnerabilities.total) > 0 && !Object.keys(vulnerabilities).length) {
    throw new Error('Dependency audit omitted vulnerability details');
  }
  if (audit.metadata && audit.metadata.vulnerabilities) {
    for (const severity of ['high', 'critical']) {
      const observed = Object.values(vulnerabilities).filter(entry => entry.severity === severity).length;
      if (Number(audit.metadata.vulnerabilities[severity] || 0) > observed) {
        throw new Error('Dependency audit omitted ' + severity + ' vulnerability details');
      }
    }
  }
  const items = Array.from(findings.values());
  return {
    findings: items,
    blocking: items.filter(item => !item.accepted
      && (item.severity === 'high' || item.severity === 'critical')),
  };
}

function auditScope(scope, directory) {
  const args = ['audit', '--package-lock-only', '--ignore-scripts', '--json'];
  // npm run supplies its actual CLI path, avoiding Windows .cmd spawn rules.
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, npmCli ? [npmCli, ...args] : args, {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120000,
    windowsHide: true,
    shell: !npmCli && process.platform === 'win32',
  });
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(scope + ' dependency audit could not complete: '
      + (result.error ? result.error.message : result.stderr || result.stdout));
  }
  let audit;
  try { audit = JSON.parse(result.stdout); }
  catch (_) { throw new Error(scope + ' dependency audit returned invalid JSON'); }
  if (audit.error || !audit.metadata || !audit.metadata.vulnerabilities) {
    throw new Error(scope + ' dependency audit did not return vulnerability metadata');
  }
  const classified = classifyAudit(audit, scope);
  const reportDirectory = path.join(root, 'artifacts', 'ui-language', 'security-audit');
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(path.join(reportDirectory, scope + '.json'),
    JSON.stringify({ scope, summary: audit.metadata.vulnerabilities, ...classified, audit }, null, 2) + '\n');
  console.log(scope + ': ' + JSON.stringify(audit.metadata.vulnerabilities));
  for (const finding of classified.findings) {
    console.log((finding.accepted ? 'ACCEPTED UNUSED UPSTREAM PROVIDER' : finding.severity.toUpperCase())
      + ': ' + finding.name + ' - ' + finding.title + ' (' + finding.url + ')');
  }
  return classified.blocking;
}

function main() {
  const blocking = [
    ...auditScope('desktop', root),
    ...auditScope('folia', path.join(root, 'vendor-src', 'folia')),
  ];
  if (blocking.length) {
    console.error('Security gate failed: ' + blocking.length + ' unaccepted high/critical advisories.');
    process.exitCode = 1;
  } else {
    console.log('Security gate passed: no unaccepted high/critical advisories.');
  }
}

module.exports = { classifyAudit };
if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
