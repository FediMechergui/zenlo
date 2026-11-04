import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';

// Run with: node --test tests/backend-invariants.test.mjs
// Exercises the shipped migration SQL in fresh, isolated SQLite databases.
// D1 HTTP/auth integration is tested separately; batch() is modeled with a transaction.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationDir = join(root, 'drizzle');
const migrationFiles = readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
assert.ok(migrationFiles.length, 'Generate the Drizzle migrations before running database tests.');
const migrations = migrationFiles.map(f => readFileSync(join(migrationDir, f), 'utf8'));
const createdAt = '2099-01-01T08:00:00.000Z';
const startAt = '2099-01-02T08:00:00.000Z';
const endAt = '2099-01-07T08:00:00.000Z';
const startMs = Date.parse(startAt);
const endMs = Date.parse(endAt);
let sequence = 0;
const id = prefix => `${prefix}_${++sequence}`;

function removeOwnTemporaryDirectory(folder, prefix) {
  assert.equal(dirname(resolve(folder)), resolve(tmpdir()), 'Cleanup must remain in the explicit temporary directory.');
  assert.ok(basename(folder).startsWith(prefix), 'Only this test-created directory may be removed.');
  rmSync(folder, { recursive: true, force: true });
}

// Import the real service implementations. Only the Cloudflare DB binding is replaced;
// business decisions, validation, SQL, transaction guards and audit writes remain real.
const emitted = mkdtempSync(join(tmpdir(), 'zenlo-service-qa-'));
mkdirSync(join(emitted, 'server'));
writeFileSync(join(emitted, 'cloudflare.mjs'), 'export const env = new Proxy({}, { get(_target, key) { return globalThis.__zenloBackendQaEnvironment?.[key]; } });');
for (const name of ['domain', 'db', 'validation', 'rentals', 'finances', 'operations']) {
  const source = readFileSync(join(root, 'server', `${name}.ts`), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
  const resolved = js.replace(/\bfrom\s+(['"])([^'"]+)\1/g, (_match, quote, specifier) => {
    let destination = specifier;
    if (specifier === 'cloudflare:workers') destination = '../cloudflare.mjs';
    else if (specifier.startsWith('.')) destination = `${specifier}.mjs`;
    else destination = import.meta.resolve(specifier);
    return `from ${quote}${destination}${quote}`;
  });
  writeFileSync(join(emitted, 'server', `${name}.mjs`), resolved);
}
const domain = await import(pathToFileURL(join(emitted, 'server', 'domain.mjs')).href);
const rentalServices = await import(pathToFileURL(join(emitted, 'server', 'rentals.mjs')).href);
const financeServices = await import(pathToFileURL(join(emitted, 'server', 'finances.mjs')).href);
const operationServices = await import(pathToFileURL(join(emitted, 'server', 'operations.mjs')).href);
const dbServices = await import(pathToFileURL(join(emitted, 'server', 'db.mjs')).href);
const validation = await import(pathToFileURL(join(emitted, 'server', 'validation.mjs')).href);
after(() => removeOwnTemporaryDirectory(emitted, 'zenlo-service-qa-'));

class PreparedD1 {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new PreparedD1(this.db, this.sql, values); }
  async first(column) { const row = this.db.prepare(this.sql).get(...this.values); return column ? row?.[column] ?? null : row ?? null; }
  async all() { return { success: true, results: this.db.prepare(this.sql).all(...this.values), meta: {} }; }
  async run() { return this.execute(); }
  execute() { const result = this.db.prepare(this.sql).run(...this.values); return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
}
class SqliteD1 {
  constructor(db) { this.db = db; this.beforeBatch = null; }
  prepare(sql) { return new PreparedD1(this.db, sql); }
  async batch(statements) {
    const intercept = this.beforeBatch;
    this.beforeBatch = null;
    if (intercept) intercept(this.db);
    return atomic(this.db, () => statements.map(statement => statement.execute()));
  }
}
function serviceContext(db, overrides = {}) {
  const settings = { ...domain.defaultSettings('Agence QA'), address: 'Adresse fictive Tunis', taxId: 'QA-ONLY', fiscalValidated: true, fiscalReviewer: 'QA reviewer', fiscalSource: 'QA test fixture', fiscalValidatedAt: createdAt, retentionDays: 365, retentionPolicy: 'QA fictional data retention policy for synthetic records only, not a legal recommendation.', hostingValidated: true, legalValidated: true, contractTerms: 'Conditions fictives de test uniquement, sans valeur contractuelle.' };
  const ctx = { user: { userId: 'qa-user', email: 'qa@example.test', displayName: 'QA actor' }, role: 'owner', memberId: 'qa-member', workspaceVersion: 1, workspace: { id: 't1', name: 'Agence QA', mode: 'demo', settings, createdAt }, ...overrides };
  db.prepare('UPDATE workspaces SET settings=?,mode=? WHERE id=?').run(JSON.stringify(ctx.workspace.settings), ctx.workspace.mode, ctx.workspace.id);
  insert(db, 'members', { id: ctx.memberId, tenant_id: ctx.workspace.id, user_id: ctx.user.userId, email: ctx.user.email, name: ctx.user.displayName, role: ctx.role, created_at: createdAt });
  const adapter = new SqliteD1(db);
  globalThis.__zenloBackendQaEnvironment = { DB: adapter };
  return { ctx, adapter };
}
const mutation = () => ({ key: crypto.randomUUID(), requestHash: crypto.randomUUID() });
function rentalInput(overrides = {}) {
  return { customerId: 'c1', vehicleId: 'v1', startAt, endAt, dailyRate: 100000, discount: 0, extras: 0, depositRequired: 1000000, includedKm: 1000, extraKmRate: 500, source: 'agency', pickupLocation: 'Tunis', returnLocation: 'Tunis', notes: '', status: 'confirmed', ...overrides };
}

function insert(db, table, values) {
  const entries = Object.entries(values);
  return db.prepare(`INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`).run(...entries.map(([, v]) => v));
}
function workspace(db, tenant) {
  insert(db, 'workspaces', { id: tenant, owner_id: `${tenant}-owner`, name: tenant, mode: 'demo', settings: '{}', version: 1, created_at: createdAt });
}
function vehicle(db, tenant = 't1', vehicleId = 'v1') {
  insert(db, 'vehicles', { id: vehicleId, tenant_id: tenant, created_at: createdAt, registration: `REG-${vehicleId}`, make: 'Test', model: 'Vehicle', category: 'Economique', year: 2026, transmission: 'manual', fuel: 'petrol', seats: 5, odometer: 10000, status: 'ready', daily_rate: 100000, deposit: 1000000, insurance_until: '2099-12-31', inspection_until: '2099-12-31', color: 'white', version: 1 });
}
function customer(db, tenant = 't1', customerId = 'c1') {
  insert(db, 'customers', { id: customerId, tenant_id: tenant, created_at: createdAt, type: 'individual', name: 'Fictional QA', email: '', phone: '', country: 'TN', license_number: '', license_until: '2099-12-31', tax_id: '', notes: '' });
}
function rental(db, overrides = {}) {
  const rentalId = overrides.id ?? id('rental');
  insert(db, 'rentals', { id: rentalId, tenant_id: 't1', created_at: createdAt, number: `RES-${rentalId}`, customer_id: 'c1', vehicle_id: 'v1', start_at: startAt, end_at: endAt, actual_start_at: null, actual_end_at: null, status: 'draft', daily_rate: 100000, days: 5, discount: 0, extras: 0, subtotal: 500000, tax: 0, stamp: 0, daily_levy: 0, daily_levy_rate: 0, daily_levy_taxable: 1, tax_rate_bps: 0, total: 500000, deposit_required: 1000000, included_km: 1000, extra_km_rate: 500, source: 'agency', pickup_location: 'Tunis', return_location: 'Tunis', notes: '', terms_version: '1', terms_snapshot: 'QA terms', pricing_snapshot: '{}', version: 1, ...overrides });
  return rentalId;
}
function block(db, rentalId, overrides = {}) {
  const blockId = overrides.id ?? id('block');
  insert(db, 'vehicle_blocks', { id: blockId, tenant_id: 't1', vehicle_id: 'v1', rental_id: rentalId, maintenance_id: null, kind: 'rental', start_ms: startMs, end_ms: endMs, ...overrides });
  return blockId;
}
function payment(db, rentalId, overrides = {}) {
  const paymentId = overrides.id ?? id('payment');
  insert(db, 'payments', { id: paymentId, tenant_id: 't1', created_at: createdAt, rental_id: rentalId, invoice_id: null, kind: 'payment', method: 'bank', amount: 100000, reference: '', note: '', cash_session_id: null, ...overrides });
  return paymentId;
}
function invoice(db, rentalId, overrides = {}) {
  const invoiceId = overrides.id ?? id('invoice');
  insert(db, 'invoices', { id: invoiceId, tenant_id: 't1', created_at: createdAt, number: `INV-${invoiceId}`, rental_id: rentalId, customer_id: 'c1', status: 'draft', subtotal: 500000, tax: 0, stamp: 0, daily_levy: 0, total: 500000, tax_rate_bps: 0, external_status: 'not_configured', issued_at: null, snapshot: '{"immutable":true}', ...overrides });
  return invoiceId;
}
function cashSession(db, overrides = {}) {
  const cashId = overrides.id ?? id('cash');
  insert(db, 'cash_sessions', { id: cashId, tenant_id: 't1', created_at: createdAt, opened_at: createdAt, closed_at: null, opening_amount: 0, expected_amount: null, counted_amount: null, note: '', ...overrides });
  return cashId;
}
function atomic(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = run(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'zenlo-db-qa-'));
  const path = join(folder, 'test.sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  for (const sql of migrations) db.exec(sql);
  workspace(db, 't1'); workspace(db, 't2');
  vehicle(db); vehicle(db, 't2', 'v2'); customer(db); customer(db, 't2', 'c2');
  t.after(() => {
    db.close();
    removeOwnTemporaryDirectory(folder, 'zenlo-db-qa-');
  });
  return { db, path };
}

test('generated migrations contain the actual application invariant triggers', t => {
  const { db } = fixture(t);
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(r => r.name);
  for (const name of ['blocks_no_overlap_insert', 'blocks_no_overlap_update', 'payment_deposit_limit', 'payment_cash_session', 'invoice_immutable_update', 'audit_immutable_update', 'closed_cash_immutable']) {
    assert.ok(names.includes(name), `${name} must be included in the shipped migrations, not only in db/invariants.sql`);
  }
});

test('overlapping bookings are rejected while half-open adjacent intervals are allowed', t => {
  const { db } = fixture(t);
  block(db, rental(db), { start_ms: 1000, end_ms: 2000 });
  const conflicting = rental(db);
  assert.throws(() => block(db, conflicting, { start_ms: 1999, end_ms: 2500 }), /CAPACITY_CONFLICT/);
  block(db, conflicting, { start_ms: 2000, end_ms: 3000 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vehicle_blocks').get().n, 2);
});

test('extension cannot overlap another confirmed reservation', t => {
  const { db } = fixture(t);
  const firstBlock = block(db, rental(db), { start_ms: 1000, end_ms: 2000 });
  block(db, rental(db), { start_ms: 3000, end_ms: 4000 });
  assert.throws(() => db.prepare('UPDATE vehicle_blocks SET end_ms=3500 WHERE id=?').run(firstBlock), /CAPACITY_CONFLICT/);
  assert.equal(db.prepare('SELECT end_ms FROM vehicle_blocks WHERE id=?').get(firstBlock).end_ms, 2000);
});

test('maintenance covering part of the rental prevents booking', t => {
  const { db } = fixture(t);
  const maintenanceId = id('maintenance');
  insert(db, 'maintenance', { id: maintenanceId, tenant_id: 't1', created_at: createdAt, vehicle_id: 'v1', title: 'Inspection QA', start_at: startAt, end_at: endAt, status: 'planned', cost: 0, supplier: '', odometer: 10000, notes: '' });
  block(db, null, { maintenance_id: maintenanceId, kind: 'maintenance', start_ms: startMs + 1000, end_ms: endMs - 1000 });
  assert.throws(() => block(db, rental(db)), /CAPACITY_CONFLICT/);
});

test('unfinished overdue maintenance blocks future bookings until a recorded completion', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const maintenanceId = id('maintenance');
  const from = '2000-01-01T00:00:00.000Z', until = '2000-01-02T00:00:00.000Z';
  insert(db, 'maintenance', { id: maintenanceId, tenant_id: 't1', created_at: from, vehicle_id: 'v1', title: 'QA unfinished repair', start_at: from, end_at: until, status: 'in_progress', cost: 0, supplier: '', odometer: 10000, notes: '' });
  block(db, null, { maintenance_id: maintenanceId, kind: 'maintenance', start_ms: Date.parse(from), end_ms: Date.parse(until) });
  const rentalId = rental(db);
  assert.throws(() => block(db, rentalId), /CAPACITY_CONFLICT/);
  await operationServices.completeMaintenance(ctx, mutation(), maintenanceId, {});
  block(db, rentalId);
  assert.equal(db.prepare('SELECT status FROM maintenance WHERE id=?').get(maintenanceId).status, 'completed');
});

test('an overdue active vehicle remains unavailable beyond its planned end', t => {
  const { db } = fixture(t);
  const overdue = rental(db, { start_at: '2000-01-01T00:00:00.000Z', end_at: '2000-01-02T00:00:00.000Z', status: 'active' });
  block(db, overdue, { start_ms: Date.parse('2000-01-01T00:00:00.000Z'), end_ms: Date.parse('2000-01-02T00:00:00.000Z') });
  assert.throws(() => block(db, rental(db)), /CAPACITY_CONFLICT/);
});

test('recording late-return cleanup preserves existing reservations and blocks new ones', t => {
  const { db } = fixture(t);
  const existingRental = rental(db, { status: 'confirmed' });
  block(db, existingRental);
  block(db, null, { kind: 'cleanup', start_ms: startMs + 1000, end_ms: endMs + 1000 });
  assert.equal(db.prepare('SELECT status FROM rentals WHERE id=?').get(existingRental).status, 'confirmed');
  assert.throws(() => block(db, rental(db), { start_ms: endMs, end_ms: endMs + 5000 }), /CAPACITY_CONFLICT/);
});

test('two independent writers cannot confirm the same final vehicle', async t => {
  const { db, path } = fixture(t);
  const rentalIds = [rental(db), rental(db)];
  const source = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData.path);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
    parentPort.postMessage({ready:true});
    parentPort.once('message', () => {
      try {
        db.exec('BEGIN IMMEDIATE');
        db.prepare('INSERT INTO vehicle_blocks (id,tenant_id,vehicle_id,rental_id,maintenance_id,kind,start_ms,end_ms) VALUES (?,?,?,?,?,?,?,?)')
          .run(workerData.blockId,'t1','v1',workerData.rentalId,null,'rental',workerData.startMs,workerData.endMs);
        db.prepare("UPDATE rentals SET status='confirmed',version=version+1 WHERE id=?").run(workerData.rentalId);
        db.exec('COMMIT'); parentPort.postMessage({ok:true});
      } catch (error) { try { db.exec('ROLLBACK'); } catch {} parentPort.postMessage({ok:false,error:error.message}); }
      finally { db.close(); parentPort.close(); }
    });`;
  const runners = rentalIds.map(rentalId => {
    const worker = new Worker(source, { eval: true, workerData: { path, rentalId, blockId: id('race'), startMs, endMs } });
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const result = new Promise((resolve, reject) => {
      worker.on('message', message => message.ready ? resolveReady() : resolve(message));
      worker.on('error', reject);
    });
    const exited = new Promise(resolve => worker.on('exit', resolve));
    return { worker, ready, result, exited };
  });
  await Promise.all(runners.map(r => r.ready));
  runners.forEach(r => r.worker.postMessage('go'));
  const results = await Promise.all(runners.map(r => r.result));
  await Promise.all(runners.map(r => r.exited));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.match(results.find(r => !r.ok).error, /CAPACITY_CONFLICT/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rentals WHERE status='confirmed'").get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vehicle_blocks').get().n, 1);
});

test('stale version guard rolls back the entire operation including its idempotency row', t => {
  const { db } = fixture(t);
  const rentalId = rental(db, { version: 2 });
  const marker = id('idem');
  assert.throws(() => atomic(db, () => {
    insert(db, 'idempotency', { id: marker, tenant_id: 't1', actor_id: 'owner', key: 'repeat-key', request_hash: 'hash', response: '{}', created_at: createdAt });
    db.prepare('INSERT INTO operation_guards (id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM rentals WHERE tenant_id=? AND id=? AND version=?) THEN 1 ELSE 0 END').run(id('guard'), 't1', rentalId, 1);
    db.prepare("UPDATE rentals SET status='confirmed',version=version+1 WHERE id=?").run(rentalId);
  }), /CHECK constraint failed/);
  assert.equal(db.prepare('SELECT status,version FROM rentals WHERE id=?').get(rentalId).version, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM idempotency WHERE id=?').get(marker).n, 0);
});

test('cross-tenant customer and vehicle references are rejected by composite foreign keys', t => {
  const { db } = fixture(t);
  assert.throws(() => rental(db, { customer_id: 'c2' }), /FOREIGN KEY constraint failed/);
  assert.throws(() => rental(db, { vehicle_id: 'v2' }), /FOREIGN KEY constraint failed/);
  const rentalId = rental(db);
  assert.throws(() => block(db, rentalId, { tenant_id: 't2', vehicle_id: 'v2' }), /FOREIGN KEY constraint failed/);
});

test('tenant-scoped invoice number and vehicle registration can repeat across independent companies', t => {
  const { db } = fixture(t);
  db.prepare("UPDATE vehicles SET registration='REG-v1' WHERE id='v2'").run();
  const r1 = rental(db);
  const r2 = rental(db, { tenant_id: 't2', vehicle_id: 'v2', customer_id: 'c2' });
  invoice(db, r1, { number: 'INV-2099-0001' });
  invoice(db, r2, { tenant_id: 't2', customer_id: 'c2', number: 'INV-2099-0001' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 2);
});

test('payment cannot refer to a different rental invoice even inside the same tenant', t => {
  const { db } = fixture(t);
  const firstRental = rental(db), secondRental = rental(db);
  const invoiceId = invoice(db, firstRental);
  assert.throws(() => payment(db, secondRental, { invoice_id: invoiceId }), /INVALID_INVOICE_LINK/);
});

test('deposit application and restitution cannot exceed collected funds', t => {
  const { db } = fixture(t);
  const rentalId = rental(db, { status: 'returned' });
  payment(db, rentalId, { kind: 'deposit_received', amount: 1000000 });
  payment(db, rentalId, { kind: 'deposit_applied', amount: 150000 });
  payment(db, rentalId, { kind: 'deposit_returned', amount: 850000 });
  assert.throws(() => payment(db, rentalId, { kind: 'deposit_returned', amount: 1 }), /DEPOSIT_INSUFFICIENT/);
  assert.throws(() => payment(db, rentalId, { kind: 'deposit_applied', amount: 1 }), /DEPOSIT_INSUFFICIENT/);
  const balance = db.prepare("SELECT SUM(CASE WHEN kind='deposit_received' THEN amount WHEN kind IN ('deposit_returned','deposit_applied') THEN -amount ELSE 0 END) AS balance FROM payments WHERE rental_id=?").get(rentalId).balance;
  assert.equal(balance, 0);
});

test('refunds cannot exceed settled rental payments', t => {
  const { db } = fixture(t);
  const rentalId = rental(db);
  payment(db, rentalId, { amount: 50000 });
  payment(db, rentalId, { kind: 'refund', amount: 20000 });
  assert.throws(() => payment(db, rentalId, { kind: 'refund', amount: 30001 }), /REFUND_EXCEEDS_PAYMENT/);
  payment(db, rentalId, { kind: 'refund', amount: 30000 });
});

test('overpayments and excess deposit receipts are rejected atomically', t => {
  const { db } = fixture(t);
  const rentalId = rental(db);
  payment(db, rentalId, { amount: 450000 });
  assert.throws(() => payment(db, rentalId, { amount: 50001 }), /PAYMENT_EXCEEDS_BALANCE/);
  payment(db, rentalId, { kind: 'deposit_received', amount: 900000 });
  assert.throws(() => payment(db, rentalId, { kind: 'deposit_received', amount: 100001 }), /DEPOSIT_EXCEEDS_REQUIRED/);
});

test('cash receipt needs an open session and cannot be recorded in a closed session', t => {
  const { db } = fixture(t);
  const rentalId = rental(db);
  assert.throws(() => payment(db, rentalId, { method: 'cash' }), /CASH_SESSION_REQUIRED/);
  const cashId = cashSession(db);
  payment(db, rentalId, { method: 'cash', cash_session_id: cashId });
  db.prepare('UPDATE cash_sessions SET closed_at=?,expected_amount=100000,counted_amount=100000 WHERE id=?').run(endAt, cashId);
  assert.throws(() => payment(db, rentalId, { method: 'cash', cash_session_id: cashId }), /CASH_SESSION_REQUIRED/);
  assert.throws(() => db.prepare('UPDATE cash_sessions SET counted_amount=0 WHERE id=?').run(cashId), /CASH_CLOSED/);
});

test('cash reimbursement cannot make the till negative despite a positive customer balance', t => {
  const { db } = fixture(t);
  const rentalId = rental(db);
  payment(db, rentalId, { kind: 'deposit_received', amount: 1000000, method: 'bank' });
  const cashId = cashSession(db, { opening_amount: 10000 });
  assert.throws(() => payment(db, rentalId, { kind: 'deposit_returned', method: 'cash', cash_session_id: cashId, amount: 10001 }), /CASH_INSUFFICIENT/);
  payment(db, rentalId, { kind: 'deposit_returned', method: 'cash', cash_session_id: cashId, amount: 10000 });
});

test('applying a deposit creates no fictitious cash movement or open-session requirement', t => {
  const { db } = fixture(t);
  const rentalId = rental(db, { status: 'returned' });
  payment(db, rentalId, { kind: 'deposit_received', amount: 1000000 });
  payment(db, rentalId, { kind: 'deposit_applied', method: 'cash', amount: 150000 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cash_sessions').get().n, 0);
});

test('financial movements are immutable and must be corrected by new entries', t => {
  const { db } = fixture(t);
  const paymentId = payment(db, rental(db));
  assert.throws(() => db.prepare('UPDATE payments SET amount=1 WHERE id=?').run(paymentId), /IMMUTABLE_PAYMENT/);
  assert.throws(() => db.prepare('DELETE FROM payments WHERE id=?').run(paymentId), /IMMUTABLE_PAYMENT/);
});

test('issued invoice monetary content and deletion are protected', t => {
  const { db } = fixture(t);
  const invoiceId = invoice(db, rental(db), { status: 'issued', issued_at: createdAt });
  assert.throws(() => db.prepare('UPDATE invoices SET total=1 WHERE id=?').run(invoiceId), /IMMUTABLE_INVOICE/);
  assert.throws(() => db.prepare('DELETE FROM invoices WHERE id=?').run(invoiceId), /IMMUTABLE_INVOICE/);
  assert.throws(() => db.prepare("UPDATE invoices SET status='credited' WHERE id=?").run(invoiceId), /IMMUTABLE_INVOICE/);
});

test('credit transition preserves invoice values and requires a linked immutable credit note', t => {
  const { db } = fixture(t);
  const invoiceId = invoice(db, rental(db), { status: 'issued', issued_at: createdAt });
  const creditId = id('credit');
  atomic(db, () => {
    insert(db, 'credit_notes', { id: creditId, tenant_id: 't1', created_at: createdAt, invoice_id: invoiceId, number: 'AV-2099-0001', amount: 500000, reason: 'QA correction', snapshot: '{}' });
    db.prepare("UPDATE invoices SET status='credited' WHERE id=?").run(invoiceId);
  });
  assert.equal(db.prepare('SELECT total FROM invoices WHERE id=?').get(invoiceId).total, 500000);
  assert.throws(() => db.prepare('UPDATE credit_notes SET amount=1 WHERE id=?').run(creditId), /IMMUTABLE_CREDIT_NOTE/);
  assert.throws(() => db.prepare('DELETE FROM credit_notes WHERE id=?').run(creditId), /IMMUTABLE_CREDIT_NOTE/);
});

test('issued invoice locks rental financial total and period', t => {
  const { db } = fixture(t);
  const rentalId = rental(db);
  invoice(db, rentalId, { status: 'issued', issued_at: createdAt });
  assert.throws(() => db.prepare('UPDATE rentals SET total=1 WHERE id=?').run(rentalId), /INVOICED_RENTAL_LOCKED/);
  assert.throws(() => db.prepare('UPDATE rentals SET end_at=? WHERE id=?').run('2099-01-10T08:00:00.000Z', rentalId), /INVOICED_RENTAL_LOCKED/);
});

test('audit history and signed document snapshots cannot be overwritten or deleted', t => {
  const { db } = fixture(t);
  const rentalId = rental(db), auditId = id('audit'), documentId = id('document');
  insert(db, 'audit', { id: auditId, tenant_id: 't1', created_at: createdAt, actor: 'QA actor', action: 'checkout', entity_type: 'rental', entity_id: rentalId, detail: 'QA event' });
  insert(db, 'document_snapshots', { id: documentId, tenant_id: 't1', created_at: createdAt, rental_id: rentalId, kind: 'contract', version: 1, data: '{"agreed":true}', hash: 'qa-hash' });
  assert.throws(() => db.prepare('UPDATE audit SET detail=? WHERE id=?').run('changed', auditId), /IMMUTABLE_AUDIT/);
  assert.throws(() => db.prepare('DELETE FROM audit WHERE id=?').run(auditId), /IMMUTABLE_AUDIT/);
  assert.throws(() => db.prepare('UPDATE document_snapshots SET data=? WHERE id=?').run('{}', documentId), /IMMUTABLE_DOCUMENT/);
  assert.throws(() => db.prepare('DELETE FROM document_snapshots WHERE id=?').run(documentId), /IMMUTABLE_DOCUMENT/);
});

test('inspection evidence is immutable and odometer cannot decrease', t => {
  const { db } = fixture(t);
  const inspectionId = id('inspection');
  insert(db, 'inspections', { id: inspectionId, tenant_id: 't1', created_at: createdAt, rental_id: rental(db), vehicle_id: 'v1', type: 'departure', odometer: 10000, fuel_percent: 75, condition: 'QA', damages: '', customer_accepted: 1 });
  assert.throws(() => db.prepare('UPDATE inspections SET odometer=0 WHERE id=?').run(inspectionId), /IMMUTABLE_INSPECTION/);
  assert.throws(() => db.prepare('DELETE FROM inspections WHERE id=?').run(inspectionId), /IMMUTABLE_INSPECTION/);
  assert.throws(() => db.prepare("UPDATE vehicles SET odometer=9999 WHERE id='v1'").run(), /ODOMETER_DECREASE/);
});

test('pricing includes the configured daily levy in the VAT basis with exact millime rounding', () => {
  const price = domain.computePrice({ startAt, endAt, dailyRate: 100000, discount: 20000, extras: 30000, dailyLevyRate: 2000, dailyLevyTaxable: true, taxRateBps: 1900, stamp: 1000 });
  assert.deepEqual(price, { days: 5, subtotal: 510000, dailyLevy: 10000, tax: 98800, total: 619800 });
  const tiny = domain.computePrice({ startAt, endAt: new Date(startMs + 86400000).toISOString(), dailyRate: 3, discount: 0, extras: 0, dailyLevyRate: 0, dailyLevyTaxable: true, taxRateBps: 1900, stamp: 0 });
  assert.equal(tiny.tax, 1);
});

test('pricing rejects reversed periods, negative subtotal and unsafe monetary arithmetic', () => {
  const input = { startAt, endAt, dailyRate: 100000, discount: 0, extras: 0, dailyLevyRate: 2000, dailyLevyTaxable: true, taxRateBps: 1900, stamp: 1000 };
  assert.throws(() => domain.computePrice({ ...input, startAt: endAt }), { code: 'INVALID_DATES' });
  assert.throws(() => domain.computePrice({ ...input, discount: 500001 }), { code: 'INVALID_AMOUNT' });
  assert.throws(() => domain.computePrice({ ...input, dailyRate: Number.MAX_SAFE_INTEGER }), { code: 'INVALID_AMOUNT' });
});

test('document expiry follows the Tunisian calendar across UTC midnight', () => {
  const vehicle = { insuranceUntil: '2026-11-04', inspectionUntil: '2026-11-04' };
  domain.ensureDocuments(vehicle, '2026-11-04T22:59:59.000Z');
  assert.throws(() => domain.ensureDocuments(vehicle, '2026-11-04T23:00:00.000Z'), { code: 'INSURANCE_EXPIRED' });
});

test('date-only validation accepts leap days and rejects impossible calendar dates', () => {
  assert.equal(validation.date.safeParse('2028-02-29').success, true);
  for (const impossible of ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01']) {
    assert.equal(validation.date.safeParse(impossible).success, false, `${impossible} must not silently normalize into another day`);
  }
});

test('real reservation service records one booking and atomically rejects the competing reservation', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const first = await rentalServices.createRental(ctx, mutation(), rentalInput());
  assert.ok(first.id);
  await assert.rejects(rentalServices.createRental(ctx, mutation(), rentalInput()), /CAPACITY_CONFLICT/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rentals').get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='rental.created'").get().n, 1);
});

test('service authorization rejects a viewer before creating financial data', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db, { role: 'viewer' });
  const rentalId = rental(db);
  await assert.rejects(financeServices.createPayment(ctx, mutation(), { rentalId, kind: 'payment', method: 'bank', amount: 1000, reference: 'QA-reference', note: '' }), { code: 'FORBIDDEN' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0);
});

test('role revocation racing a write is rechecked in the transaction', async t => {
  const { db } = fixture(t), { ctx, adapter } = serviceContext(db, { role: 'manager' });
  const rentalId = rental(db);
  adapter.beforeBatch = database => database.prepare("UPDATE members SET role='viewer' WHERE id=?").run(ctx.memberId);
  await assert.rejects(financeServices.createPayment(ctx, mutation(), { rentalId, kind: 'payment', method: 'bank', amount: 1000, reference: 'QA-reference', note: '' }), /operation_precondition/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM idempotency').get().n, 0);
});

test('cheques without clearance cannot become settled money', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const rentalId = rental(db);
  await assert.rejects(financeServices.createPayment(ctx, mutation(), { rentalId, kind: 'payment', method: 'cheque', amount: 1000, reference: 'QA-cheque', note: '' }), { code: 'CHEQUE_CLEARANCE_REQUIRED' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0);
});

test('cancellation committed after payment pre-read still prevents a new receipt', async t => {
  const { db } = fixture(t), { ctx, adapter } = serviceContext(db);
  const rentalId = rental(db, { status: 'confirmed' });
  adapter.beforeBatch = database => database.prepare("UPDATE rentals SET status='cancelled',version=version+1 WHERE id=?").run(rentalId);
  await assert.rejects(financeServices.createPayment(ctx, mutation(), { rentalId, kind: 'payment', method: 'bank', amount: 1000, reference: 'QA-transfer', note: '' }), /RENTAL_CANCELLED/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0);
});

test('two concurrent refund services cannot collectively exceed the payment balance', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const rentalId = rental(db, { status: 'returned' });
  payment(db, rentalId, { amount: 100000 });
  const input = { rentalId, kind: 'refund', method: 'bank', amount: 70000, reference: 'QA-refund', note: 'QA reimbursement' };
  const outcomes = await Promise.allSettled([financeServices.createPayment(ctx, mutation(), input), financeServices.createPayment(ctx, mutation(), input)]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal(db.prepare("SELECT SUM(amount) AS amount FROM payments WHERE kind='refund'").get().amount, 70000);
});

test('cash close calculates expected balance inside its transaction, including a racing receipt', async t => {
  const { db } = fixture(t), { ctx, adapter } = serviceContext(db);
  const rentalId = rental(db), cashId = cashSession(db, { opening_amount: 10000 });
  adapter.beforeBatch = database => payment(database, rentalId, { method: 'cash', cash_session_id: cashId, amount: 20000 });
  await financeServices.cashAction(ctx, mutation(), { action: 'close', countedAmount: 30000, note: 'QA close' });
  const result = db.prepare('SELECT expected_amount,counted_amount,closed_at FROM cash_sessions WHERE id=?').get(cashId);
  assert.equal(result.expected_amount, 30000);
  assert.equal(result.counted_amount, 30000);
  assert.ok(result.closed_at);
});

test('idempotency registry replays committed results and rejects a changed request body hash', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const request = mutation();
  const result = await rentalServices.createRental(ctx, request, rentalInput());
  assert.deepEqual(await dbServices.previous(ctx, request), result);
  await assert.rejects(dbServices.previous(ctx, { ...request, requestHash: 'different-body' }), { code: 'IDEMPOTENCY_MISMATCH' });
});

test('issued invoice sequence and audit roll back when a racing settings change invalidates approval', async t => {
  const { db } = fixture(t), { ctx, adapter } = serviceContext(db);
  const rentalId = rental(db, { status: 'returned' });
  const created = await financeServices.createInvoice(ctx, mutation(), { rentalId });
  adapter.beforeBatch = database => database.prepare("UPDATE workspaces SET version=version+1 WHERE id='t1'").run();
  await assert.rejects(financeServices.issueInvoice(ctx, mutation(), created.id, {}));
  assert.equal(db.prepare('SELECT status FROM invoices WHERE id=?').get(created.id).status, 'draft');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sequences').get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='invoice.issued'").get().n, 0);
});

test('issuing a draft freezes the corrected customer identity rather than its stale draft copy', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  ctx.workspace.mode = 'live';
  ctx.workspace.settings.invoiceWorkflow = 'paper';
  ctx.workspace.settings.invoiceWorkflowEvidence = 'QA fictional written review, not a legal determination';
  db.prepare("UPDATE workspaces SET mode='live' WHERE id='t1'").run();
  const rentalId = rental(db, { status: 'returned' });
  const created = await financeServices.createInvoice(ctx, mutation(), { rentalId });
  await assert.rejects(financeServices.issueInvoice(ctx, mutation(), created.id, {}), { code: 'CUSTOMER_ADDRESS_REQUIRED' });
  await operationServices.patchCustomer(ctx, mutation(), 'c1', { address: 'Adresse fictive corrigée, Tunis' });
  await financeServices.issueInvoice(ctx, mutation(), created.id, {});
  const issued = db.prepare('SELECT status,snapshot FROM invoices WHERE id=?').get(created.id);
  assert.equal(issued.status, 'issued');
  assert.equal(JSON.parse(issued.snapshot).customer.address, 'Adresse fictive corrigée, Tunis');
});

for (const [workflow, evidence, code] of [
  ['unreviewed', '', 'INVOICE_WORKFLOW_REVIEW_REQUIRED'],
  ['electronic', 'QA requires configured electronic integration', 'EINVOICE_NOT_CONFIGURED'],
  ['paper', '', 'INVOICE_WORKFLOW_EVIDENCE_REQUIRED'],
]) {
  test(`live invoice emission rejects ${workflow} workflow when its required evidence or integration is missing`, async t => {
    const { db } = fixture(t), { ctx } = serviceContext(db);
    ctx.workspace.mode = 'live';
    ctx.workspace.settings.invoiceWorkflow = workflow;
    ctx.workspace.settings.invoiceWorkflowEvidence = evidence;
    db.prepare("UPDATE workspaces SET mode='live',settings=? WHERE id='t1'").run(JSON.stringify(ctx.workspace.settings));
    db.prepare("UPDATE customers SET address='QA fictitious client address' WHERE id='c1'").run();
    const rentalId = rental(db, { status: 'returned' });
    const created = await financeServices.createInvoice(ctx, mutation(), { rentalId });
    await assert.rejects(financeServices.issueInvoice(ctx, mutation(), created.id, {}), { code });
    assert.equal(db.prepare('SELECT status FROM invoices WHERE id=?').get(created.id).status, 'draft');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sequences').get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='invoice.issued'").get().n, 0);
  });
}

test('changing the reviewed invoice workflow removes earlier fiscal approval until explicitly revalidated', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  await operationServices.patchSettings(ctx, mutation(), { invoiceWorkflow: 'paper', invoiceWorkflowEvidence: 'QA fictional paper workflow evidence' });
  const persisted = JSON.parse(db.prepare("SELECT settings FROM workspaces WHERE id='t1'").get().settings);
  assert.equal(persisted.invoiceWorkflow, 'paper');
  assert.equal(persisted.fiscalValidated, false);
  assert.equal(persisted.fiscalValidatedAt, '');
});

test('hosting approval requires an explicit positive retention period and documented policy', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  for (const input of [
    { hostingValidated: true, retentionDays: 0, retentionPolicy: '' },
    { hostingValidated: true, retentionDays: 365, retentionPolicy: '' },
    { hostingValidated: true, retentionDays: 0, retentionPolicy: 'QA fictional documented retention scope and justification' },
  ]) await assert.rejects(operationServices.patchSettings(ctx, mutation(), input), { code: 'RETENTION_POLICY_REQUIRED' });
  assert.equal(db.prepare("SELECT version FROM workspaces WHERE id='t1'").get().version, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='settings.updated'").get().n, 0);
});

test('full credit prevents further settlement until a replacement invoice is issued', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const rentalId = rental(db, { status: 'returned' });
  const invoiceId = invoice(db, rentalId, { status: 'issued', issued_at: createdAt });
  await financeServices.creditInvoice(ctx, mutation(), invoiceId, { reason: 'QA full cancellation' });
  await assert.rejects(financeServices.createPayment(ctx, mutation(), { rentalId, kind: 'payment', method: 'bank', amount: 1000, reference: 'QA-payment', note: '' }), { code: 'PAYMENT_EXCEEDS_BALANCE' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0);
});

test('departure rechecks the deposit atomically if a restitution races the handover', async t => {
  const { db } = fixture(t), { ctx, adapter } = serviceContext(db);
  db.prepare("UPDATE customers SET license_number='QA-PERMIT' WHERE id='c1'").run();
  const now = Date.now();
  const created = await rentalServices.createRental(ctx, mutation(), rentalInput({ startAt: new Date(now - 3600000).toISOString(), endAt: new Date(now + 23 * 3600000).toISOString() }));
  payment(db, created.id, { kind: 'deposit_received', amount: 1000000 });
  adapter.beforeBatch = database => payment(database, created.id, { kind: 'deposit_returned', amount: 1 });
  await assert.rejects(rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'checkout', expectedVersion: 1, inspection: { odometer: 10000, fuelPercent: 90, condition: 'QA inspected', damages: '', customerAccepted: true } }), /operation_precondition/);
  assert.equal(db.prepare('SELECT status FROM rentals WHERE id=?').get(created.id).status, 'confirmed');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inspections').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assignments').get().n, 0);
});

test('a draft quote cannot be confirmed under silently changed fiscal rates', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  const created = await rentalServices.createRental(ctx, mutation(), rentalInput({ status: 'draft' }));
  ctx.workspace.settings.taxRateBps = 1900;
  await assert.rejects(rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'confirm', expectedVersion: 1 }), { code: 'QUOTE_FISCAL_CHANGED' });
  assert.equal(db.prepare('SELECT status FROM rentals WHERE id=?').get(created.id).status, 'draft');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vehicle_blocks').get().n, 0);
});

test('departure, inspected replacement and return preserve mileage segments and deposit independence', async t => {
  const { db } = fixture(t), { ctx } = serviceContext(db);
  vehicle(db, 't1', 'v3');
  db.prepare("UPDATE customers SET license_number='QA-PERMIT' WHERE id='c1'").run();
  const now = Date.now();
  const created = await rentalServices.createRental(ctx, mutation(), rentalInput({ startAt: new Date(now - 3600000).toISOString(), endAt: new Date(now + 23 * 3600000).toISOString(), includedKm: 100 }));
  await financeServices.createPayment(ctx, mutation(), { rentalId: created.id, kind: 'deposit_received', method: 'bank', amount: 1000000, reference: 'QA-guarantee', note: '' });
  await rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'checkout', expectedVersion: 1, inspection: { odometer: 10000, fuelPercent: 90, condition: 'QA departure', damages: '', customerAccepted: true } });
  const oldInspection = { odometer: 10030, fuelPercent: 80, condition: 'QA old car return', damages: '', customerAccepted: true };
  const newInspection = { odometer: 10000, fuelPercent: 95, condition: 'QA replacement departure', damages: '', customerAccepted: true };
  await rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'swap', expectedVersion: 2, vehicleId: 'v3', oldOdometer: 10030, newOdometer: 10000, oldInspection, newInspection, reason: 'QA replacement' });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM vehicle_blocks WHERE vehicle_id='v1' AND kind='cleanup'").get().n, 1);
  assert.equal(db.prepare("SELECT fuel_percent FROM inspections WHERE rental_id=? AND condition='QA replacement departure'").get(created.id).fuel_percent, 95);
  await rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'checkin', expectedVersion: 3, inspection: { odometer: 10110, fuelPercent: 70, condition: 'QA final return', damages: '', customerAccepted: true } });
  const result = db.prepare('SELECT status,vehicle_id,extras,total FROM rentals WHERE id=?').get(created.id);
  assert.equal(result.status, 'returned');
  assert.equal(result.vehicle_id, 'v3');
  assert.equal(result.extras, 20000); // (30 + 110 - 100 included km) × 500 millimes.
  assert.equal(result.total, 122000); // One day 100 TND + 2 TND levy + 20 TND mileage, QA zero tax.
  const segments = db.prepare('SELECT start_odometer,end_odometer FROM assignments WHERE rental_id=? ORDER BY created_at,id').all(created.id);
  assert.equal(segments.length, 2);
  assert.equal(segments.reduce((sum, segment) => sum + segment.end_odometer - segment.start_odometer, 0), 140);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inspections WHERE rental_id=?').get(created.id).n, 4);
  const movements = db.prepare('SELECT kind,amount FROM payments WHERE rental_id=?').all(created.id);
  assert.deepEqual(domain.financialBalance(movements), { paid: 0, deposit: 1000000 });
});

for (const additional of [0, 10000]) {
  test(`return adds ${additional} millimes of supplementary charges and preserves the 30000 millime booked options`, async t => {
    const { db } = fixture(t), { ctx } = serviceContext(db);
    db.prepare("UPDATE customers SET license_number='QA-PERMIT' WHERE id='c1'").run();
    const currentTime = Date.now();
    const created = await rentalServices.createRental(ctx, mutation(), rentalInput({
      startAt: new Date(currentTime - 3600000).toISOString(),
      endAt: new Date(currentTime + 23 * 3600000).toISOString(),
      extras: 30000,
    }));
    await financeServices.createPayment(ctx, mutation(), { rentalId: created.id, kind: 'deposit_received', method: 'bank', amount: 1000000, reference: 'QA-deposit', note: '' });
    await rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'checkout', expectedVersion: 1, inspection: { odometer: 10000, fuelPercent: 100, condition: 'QA departure', damages: '', customerAccepted: true } });
    await rentalServices.rentalAction(ctx, mutation(), created.id, { action: 'checkin', expectedVersion: 2, extras: additional, inspection: { odometer: 10010, fuelPercent: 100, condition: 'QA return without excess mileage', damages: '', customerAccepted: true } });
    const result = db.prepare('SELECT status,extras,total FROM rentals WHERE id=?').get(created.id);
    assert.equal(result.status, 'returned');
    assert.equal(result.extras, 30000 + additional);
    assert.equal(result.total, 132000 + additional); // One day, 2 TND levy, original options and return additions; QA zero tax.
  });
}
