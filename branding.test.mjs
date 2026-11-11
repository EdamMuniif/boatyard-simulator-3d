import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('travel lift uses only generic game signage', () => {
  const source = readFileSync(new URL('./geometry.js', import.meta.url), 'utf8');
  assert.match(source, /root\.name='Boat Hoist - Travel Lift'/);
  assert.match(source, /panelLabel\(root,'BOATYARD SIMULATOR'/);
  for (const company of [String.fromCharCode(77,84,67,67), 'EDEN' + 'TECHNOLOGY']) {
    assert.equal(source.toUpperCase().includes(company), false);
  }
});
