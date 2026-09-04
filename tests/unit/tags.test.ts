import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTagName, isValidHexColor } from '@/lib/tags';

test('normalizeTagName trims surrounding whitespace', () => {
  assert.equal(normalizeTagName('  Work  '), 'Work');
});

test('normalizeTagName collapses internal whitespace', () => {
  assert.equal(normalizeTagName('Home   Chores'), 'Home Chores');
});

test('isValidHexColor accepts 6-digit hex', () => {
  assert.equal(isValidHexColor('#1a2b3c'), true);
});

test('isValidHexColor accepts 3-digit hex', () => {
  assert.equal(isValidHexColor('#abc'), true);
});

test('isValidHexColor rejects invalid formats', () => {
  assert.equal(isValidHexColor('blue'), false);
  assert.equal(isValidHexColor('#12345'), false);
  assert.equal(isValidHexColor('123456'), false);
});
