import { test } from 'node:test';
import assert from 'node:assert';
import { greet } from '../src/index.js';

test('greet returns a greeting', () => {
  assert.equal(greet('world'), 'Hello, world!');
});
