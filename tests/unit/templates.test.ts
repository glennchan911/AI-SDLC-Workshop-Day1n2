import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeSubtasks, deserializeSubtasks, computeDueDate } from '@/lib/templates';

test('serializeSubtasks assigns sequential positions', () => {
  const json = serializeSubtasks([{ title: 'First' }, { title: 'Second' }]);
  assert.deepEqual(JSON.parse(json), [
    { title: 'First', position: 0 },
    { title: 'Second', position: 1 },
  ]);
});

test('deserializeSubtasks round-trips serialized data', () => {
  const json = serializeSubtasks([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
  const result = deserializeSubtasks(json);
  assert.deepEqual(result, [
    { title: 'A', position: 0 },
    { title: 'B', position: 1 },
    { title: 'C', position: 2 },
  ]);
});

test('deserializeSubtasks sorts by position and ignores malformed entries', () => {
  const json = JSON.stringify([
    { title: 'Second', position: 1 },
    { title: 'First', position: 0 },
    { notATitle: true },
  ]);
  const result = deserializeSubtasks(json);
  assert.deepEqual(result, [
    { title: 'First', position: 0 },
    { title: 'Second', position: 1 },
  ]);
});

test('deserializeSubtasks returns empty array for invalid JSON', () => {
  assert.deepEqual(deserializeSubtasks('not json'), []);
});

test('computeDueDate adds whole days to the given date', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const result = computeDueDate(5, from);
  assert.equal(result, '2026-01-06T00:00:00.000Z');
});

test('computeDueDate supports zero offset', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(computeDueDate(0, from), from.toISOString());
});
