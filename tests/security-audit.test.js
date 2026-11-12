'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAudit } = require('../scripts/security-audit');

function advisory(overrides = {}) {
  return {
    source: 1240853, name: 'basic-ftp', dependency: 'basic-ftp', severity: 'high',
    title: 'Quadratic FTP listing parser', range: '<=6.2.0',
    url: 'https://github.com/advisories/GHSA-c475-qrg2-pj4r', ...overrides,
  };
}
function auditFor(name, item) {
  return { vulnerabilities: { [name]: { severity: item.severity, via: [item] } } };
}

test('accepts only the reviewed unused Folia FTP advisory and its inherited entries', () => {
  const audit = auditFor('basic-ftp', advisory());
  audit.vulnerabilities['get-uri'] = { severity: 'high', via: ['basic-ftp'] };
  audit.vulnerabilities['pac-proxy-agent'] = { severity: 'high', via: ['get-uri'] };
  audit.vulnerabilities['@neteasecloudmusicapienhanced/api'] = { severity: 'high', via: ['pac-proxy-agent'] };
  const result = classifyAudit(audit, 'folia');
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].accepted, true);
  assert.equal(result.blocking.length, 0);
});

test('the same FTP advisory blocks the desktop dependency tree', () => {
  const result = classifyAudit(auditFor('basic-ftp', advisory()), 'desktop');
  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].accepted, false);
});

test('new FTP advisories, changed identity, range or severity never inherit the exception', () => {
  for (const changes of [
    { url: 'https://github.com/advisories/GHSA-unreviewed' },
    { name: 'electron' }, { dependency: 'another-package' },
    { range: '<=7.0.0' }, { severity: 'critical' },
  ]) {
    const result = classifyAudit(auditFor('basic-ftp', advisory(changes)), 'folia');
    assert.equal(result.blocking.length, 1, JSON.stringify(changes));
    assert.equal(result.blocking[0].accepted, false);
  }
});

test('an unrelated package cannot reuse the FTP advisory URL to obtain an exception', () => {
  assert.equal(classifyAudit(auditFor('electron', advisory()), 'folia').blocking.length, 1);
});

test('unreviewed high and critical advisories block either dependency tree', () => {
  for (const scope of ['desktop', 'folia']) {
    const audit = { vulnerabilities: {
      electron: { severity: 'high', via: [advisory({ source: 1, name: 'electron',
        dependency: 'electron', url: 'https://github.com/advisories/GHSA-electron' })] },
      vite: { severity: 'critical', via: [advisory({ source: 2, name: 'vite', dependency: 'vite',
        severity: 'critical', url: 'https://github.com/advisories/GHSA-vite' })] },
    } };
    assert.deepEqual(classifyAudit(audit, scope).blocking.map(item => item.name), ['electron', 'vite']);
  }
});

test('a reviewed FTP advisory cannot hide another high advisory in the same package', () => {
  const audit = auditFor('basic-ftp', advisory());
  audit.vulnerabilities['basic-ftp'].via.push(advisory({ source: 2,
    url: 'https://github.com/advisories/GHSA-new-ftp' }));
  const result = classifyAudit(audit, 'folia');
  assert.equal(result.findings.length, 2);
  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].url, 'https://github.com/advisories/GHSA-new-ftp');
});

test('critical parents cannot inherit the reviewed high FTP exception', () => {
  const audit = auditFor('basic-ftp', advisory());
  audit.vulnerabilities['get-uri'] = { severity: 'critical', via: ['basic-ftp'] };
  const result = classifyAudit(audit, 'folia');
  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].name, 'get-uri');
  assert.equal(result.blocking[0].severity, 'critical');
});

test('high parent exceptions require a complete chain consisting only of the reviewed FTP advisory', () => {
  for (const extra of [
    { other: { severity: 'moderate', via: [advisory({ source: 2, severity: 'moderate',
      url: 'https://github.com/advisories/GHSA-other' })] } },
    { other: { severity: 'high', via: [advisory({ source: 2,
      url: 'https://github.com/advisories/GHSA-other' })] } },
    {},
  ]) {
    const audit = auditFor('basic-ftp', advisory());
    Object.assign(audit.vulnerabilities, extra);
    audit.vulnerabilities['get-uri'] = { severity: 'high', via: ['basic-ftp', 'other'] };
    assert.ok(classifyAudit(audit, 'folia').blocking.length > 0);
  }
});

test('metadata high/critical counts without matching entry details fail closed', () => {
  for (const severity of ['high', 'critical']) {
    const audit = { metadata: { vulnerabilities: { total: 1, [severity]: 1 } },
      vulnerabilities: { incomplete: { via: [] } } };
    assert.throws(() => classifyAudit(audit, 'folia'), /omitted.*vulnerability details/);
  }
});

test('low and moderate advisories remain visible without blocking releases', () => {
  for (const severity of ['low', 'moderate']) {
    const result = classifyAudit(auditFor('minimatch', advisory({ severity })), 'desktop');
    assert.equal(result.findings[0].severity, severity);
    assert.equal(result.findings[0].accepted, false);
    assert.equal(result.blocking.length, 0);
  }
  assert.deepEqual(classifyAudit({ vulnerabilities: {} }, 'desktop'), { findings: [], blocking: [] });
});

test('missing high advisory chains and cycles fail closed instead of passing silently', () => {
  for (const vulnerabilities of [
    { missing: { severity: 'high', via: ['absent-package'] } },
    { empty: { severity: 'critical', via: [] } },
    { first: { severity: 'high', via: ['second'] }, second: { severity: 'high', via: ['first'] } },
  ]) {
    assert.ok(classifyAudit({ vulnerabilities }, 'desktop').blocking.length > 0);
  }
  assert.throws(() => classifyAudit({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: {} }, 'desktop'),
    /omitted vulnerability details/);
});
