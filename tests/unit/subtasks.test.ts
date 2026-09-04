import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgress, formatProgressLabel } from '@/lib/subtasks';

test('calculateProgress returns 0% for empty list', () => {
  const stats = calculateProgress([]);
  assert.deepEqual(stats, { completed: 0, total: 0, percent: 0 });
});

test('calculateProgress computes partial completion', () => {
  const stats = calculateProgress([{ completed: 1 }, { completed: 0 }, { completed: 0 }, { completed: 1 }]);
  assert.deepEqual(stats, { completed: 2, total: 4, percent: 50 });
});

test('calculateProgress computes full completion', () => {
  const stats = calculateProgress([{ completed: 1 }, { completed: 1 }]);
  assert.deepEqual(stats, { completed: 2, total: 2, percent: 100 });
});

test('formatProgressLabel renders human readable string', () => {
  const label = formatProgressLabel({ completed: 2, total: 2, percent: 100 });
  assert.equal(label, '2 / 2 completed (100%)');
});
