const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCodexProcessName,
  parseWindowsProcessList,
  hasCodexProcess
} = require('../src/process-monitor');

test('isCodexProcessName matches narrow Codex process names', () => {
  assert.equal(isCodexProcessName('codex.exe'), true);
  assert.equal(isCodexProcessName('Codex.exe'), true);
  assert.equal(isCodexProcessName('OpenAI Codex.exe'), true);
  assert.equal(isCodexProcessName('codex-cli.exe'), true);
  assert.equal(isCodexProcessName('my-codex-notes.exe'), false);
  assert.equal(isCodexProcessName('node.exe'), false);
});

test('parseWindowsProcessList extracts process names and pids from csv', () => {
  const stdout = [
    '"Name","ProcessId"',
    '"Code.exe","100"',
    '"codex.exe","200"',
    '"node.exe","300"'
  ].join('\r\n');

  assert.deepEqual(parseWindowsProcessList(stdout), [
    { name: 'Code.exe', pid: 100 },
    { name: 'codex.exe', pid: 200 },
    { name: 'node.exe', pid: 300 }
  ]);
});

test('hasCodexProcess returns true only for matching process rows', () => {
  assert.equal(hasCodexProcess([{ name: 'node.exe' }, { name: 'codex.exe' }]), true);
  assert.equal(hasCodexProcess([{ name: 'node.exe' }, { name: 'chrome.exe' }]), false);
});
