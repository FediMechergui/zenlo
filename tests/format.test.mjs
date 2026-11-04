import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMillimes, toLocalInput, fromLocalInput, heldForRental, paidForRental } from '../lib/format.ts';

test('Tunisian monetary input preserves millimes exactly', () => {
  assert.equal(parseMillimes('100,001'), 100001);
  assert.equal(parseMillimes('1 250.9'), 1250900);
  assert.equal(parseMillimes('0.001'), 1);
  for (const invalid of ['-1','1.0001','1e3','NaN','', '0x10']) assert.throws(()=>parseMillimes(invalid));
});
test('Tunis input conversion is independent of browser timezone', () => {
  assert.equal(toLocalInput('2026-11-04T23:30:00.000Z'),'2026-11-05T00:30');
  assert.equal(fromLocalInput('2026-11-05T00:30'),'2026-11-04T23:30:00.000Z');
  assert.throws(()=>fromLocalInput('2026-02-30T12:00'));
});
test('deposit liability is separate from rental payments and application moves both', () => {
  const payments=[{rentalId:'a',kind:'deposit_received',amount:1000000},{rentalId:'a',kind:'deposit_applied',amount:150000},{rentalId:'a',kind:'deposit_returned',amount:850000},{rentalId:'a',kind:'payment',amount:100000},{rentalId:'b',kind:'deposit_received',amount:400000}];
  assert.equal(heldForRental(payments,'a'),0);
  assert.equal(paidForRental(payments,'a'),250000);
});
