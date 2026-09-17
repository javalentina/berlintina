// A small PostgREST-shaped query builder on top of plain Postgres.
//
// The server was written against supabase-js and calls `.from(...).select(...).eq(...)`
// in 58 places. Rewriting each of those into raw SQL would touch far more code than
// the move actually requires, so this module keeps that surface and translates it to
// SQL underneath. Only the handful of methods the server really uses is implemented —
// anything else throws loudly rather than returning a silently wrong result.
//
// Two deliberate differences from supabase-js:
//   * every call resolves to { data, error } the same way, so callers stay unchanged;
//   * identifiers are validated against a strict pattern before they reach the SQL
//     string, because column names arrive from our own code, not from the database.

import pg from 'pg';

const IDENT = /^[a-z_][a-z0-9_]*$/i;

function ident(name) {
  const bare = String(name).trim();
  if (!IDENT.test(bare)) throw new Error(`db: refusing unsafe identifier ${JSON.stringify(name)}`);
  return `"${bare}"`;
}

// jsonb columns arrive as JS objects/arrays; node-postgres would send them as strings
// unless we stringify ourselves, which would store the JSON quoted.
function encode(value) {
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

class Query {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.op = 'select';
    this.columns = '*';
    this.where = [];        // { sql, values }
    this.orders = [];
    this.limitN = null;
    this.offsetN = null;
    this.payload = null;
    this.rowMode = null;    // 'single' | 'maybe'
    this.countMode = null;
    this.headOnly = false;
    this.returning = null;
  }

  // ── shape ────────────────────────────────────────────────────────────────
  select(columns = '*', options = {}) {
    if (this.op === 'select') {
      this.columns = columns;
    } else {
      this.returning = columns;   // insert/update/delete + .select() => RETURNING
    }
    if (options.count) this.countMode = options.count;
    if (options.head) this.headOnly = true;
    return this;
  }

  insert(rows) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  // ── filters ──────────────────────────────────────────────────────────────
  #cmp(column, operator, value) {
    this.where.push({ sql: `${ident(column)} ${operator} ?`, values: [value] });
    return this;
  }

  eq(column, value) { return this.#cmp(column, '=', value); }
  neq(column, value) { return this.#cmp(column, '<>', value); }
  gt(column, value) { return this.#cmp(column, '>', value); }
  gte(column, value) { return this.#cmp(column, '>=', value); }
  lt(column, value) { return this.#cmp(column, '<', value); }
  lte(column, value) { return this.#cmp(column, '<=', value); }
  like(column, pattern) { return this.#cmp(column, 'LIKE', pattern); }
  ilike(column, pattern) { return this.#cmp(column, 'ILIKE', pattern); }

  is(column, value) {
    if (value !== null) throw new Error('db: .is() only supports null');
    this.where.push({ sql: `${ident(column)} IS NULL`, values: [] });
    return this;
  }

  not(column, operator, value) {
    if (operator !== 'is' || value !== null) {
      throw new Error('db: .not() only supports (column, "is", null)');
    }
    this.where.push({ sql: `${ident(column)} IS NOT NULL`, values: [] });
    return this;
  }

  in(column, values) {
    const list = Array.isArray(values) ? values : [values];
    if (!list.length) {
      this.where.push({ sql: 'false', values: [] });   // matches PostgREST's empty in()
      return this;
    }
    this.where.push({
      sql: `${ident(column)} IN (${list.map(() => '?').join(', ')})`,
      values: list,
    });
    return this;
  }

  // PostgREST's or() takes "col.op.value,col.op.value". The server uses ilike,
  // is.null and lte; anything else is rejected rather than guessed at.
  or(expression) {
    const parts = [];
    const values = [];
    for (const clause of String(expression).split(',')) {
      const match = clause.match(/^([a-z_][a-z0-9_]*)\.([a-z]+)\.(.*)$/i);
      if (!match) throw new Error(`db: cannot parse or() clause ${JSON.stringify(clause)}`);
      const [, column, operator, raw] = match;
      if (operator === 'is') {
        if (raw !== 'null') throw new Error('db: or() is.<x> only supports null');
        parts.push(`${ident(column)} IS NULL`);
      } else if (operator === 'ilike' || operator === 'like') {
        parts.push(`${ident(column)} ${operator.toUpperCase()} ?`);
        values.push(raw);
      } else if (['eq', 'lte', 'gte', 'lt', 'gt'].includes(operator)) {
        const sign = { eq: '=', lte: '<=', gte: '>=', lt: '<', gt: '>' }[operator];
        parts.push(`${ident(column)} ${sign} ?`);
        values.push(raw);
      } else {
        throw new Error(`db: or() operator ${operator} not implemented`);
      }
    }
    this.where.push({ sql: `(${parts.join(' OR ')})`, values });
    return this;
  }

  textSearch(column, term, options = {}) {
    const config = options.config || 'simple';
    if (!IDENT.test(config)) throw new Error('db: unsafe text search config');
    const fn = options.type === 'websearch' ? 'websearch_to_tsquery' : 'plainto_tsquery';
    this.where.push({ sql: `${ident(column)} @@ ${fn}('${config}', ?)`, values: [term] });
    return this;
  }

  // ── ordering and slicing ─────────────────────────────────────────────────
  order(column, options = {}) {
    const direction = options.ascending === false ? 'DESC' : 'ASC';
    this.orders.push(`${ident(column)} ${direction}`);
    return this;
  }

  limit(n) { this.limitN = n; return this; }

  range(from, to) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }

  single() { this.rowMode = 'single'; return this; }
  maybeSingle() { this.rowMode = 'maybe'; return this; }

  // ── SQL assembly ─────────────────────────────────────────────────────────
  #columnList(spec) {
    const raw = String(spec ?? '*').trim();
    if (raw === '*' || raw === '') return '*';
    return raw.split(',').map((c) => ident(c)).join(', ');
  }

  #whereClause(values) {
    if (!this.where.length) return '';
    const rendered = this.where.map((clause) => {
      let sql = clause.sql;
      for (const value of clause.values) {
        values.push(encode(value));
        sql = sql.replace('?', `$${values.length}`);
      }
      return sql;
    });
    return ` WHERE ${rendered.join(' AND ')}`;
  }

  #build() {
    const values = [];
    const table = ident(this.table);

    if (this.op === 'insert') {
      const columns = Object.keys(this.payload[0]);
      const tuples = this.payload.map((row) => {
        const slots = columns.map((c) => {
          values.push(encode(row[c]));
          return `$${values.length}`;
        });
        return `(${slots.join(', ')})`;
      });
      const returning = this.returning ? ` RETURNING ${this.#columnList(this.returning)}` : '';
      return {
        text: `INSERT INTO ${table} (${columns.map(ident).join(', ')}) VALUES ${tuples.join(', ')}${returning}`,
        values,
      };
    }

    if (this.op === 'update') {
      const assignments = Object.entries(this.payload).map(([column, value]) => {
        values.push(encode(value));
        return `${ident(column)} = $${values.length}`;
      });
      const where = this.#whereClause(values);
      const returning = this.returning ? ` RETURNING ${this.#columnList(this.returning)}` : '';
      return { text: `UPDATE ${table} SET ${assignments.join(', ')}${where}${returning}`, values };
    }

    if (this.op === 'delete') {
      const where = this.#whereClause(values);
      const returning = this.returning ? ` RETURNING ${this.#columnList(this.returning)}` : '';
      return { text: `DELETE FROM ${table}${where}${returning}`, values };
    }

    const where = this.#whereClause(values);
    const orderBy = this.orders.length ? ` ORDER BY ${this.orders.join(', ')}` : '';
    let tail = '';
    if (this.limitN != null) tail += ` LIMIT ${Number(this.limitN)}`;
    if (this.offsetN != null) tail += ` OFFSET ${Number(this.offsetN)}`;
    return {
      text: `SELECT ${this.#columnList(this.columns)} FROM ${table}${where}${orderBy}${tail}`,
      values,
    };
  }

  #countQuery() {
    const values = [];
    const where = this.#whereClause(values);
    return { text: `SELECT count(*)::int AS n FROM ${ident(this.table)}${where}`, values };
  }

  async #run() {
    let count = null;
    if (this.countMode) {
      const q = this.#countQuery();
      count = (await this.pool.query(q.text, q.values)).rows[0].n;
      if (this.headOnly) return { data: null, error: null, count };
    }

    const { text, values } = this.#build();
    const rows = (await this.pool.query(text, values)).rows;

    if (this.rowMode === 'single') {
      if (rows.length !== 1) {
        return {
          data: null,
          count,
          error: { message: `expected exactly one row, got ${rows.length}`, code: 'PGRST116' },
        };
      }
      return { data: rows[0], error: null, count };
    }
    if (this.rowMode === 'maybe') {
      return { data: rows[0] ?? null, error: null, count };
    }
    // insert/update/delete without .select() return no rows, like supabase-js
    if (this.op !== 'select' && !this.returning) return { data: null, error: null, count };
    return { data: rows, error: null, count };
  }

  // Awaiting the builder is what actually runs it. Errors are returned, never thrown,
  // because every call site checks `error` instead of using try/catch.
  then(onFulfilled, onRejected) {
    return this.#run()
      .catch((err) => ({ data: null, error: { message: err.message }, count: null }))
      .then(onFulfilled, onRejected);
  }
}

export function createDb(connectionString) {
  // TLS only when the connection string asks for it. Railway's internal network is
  // already private and its Postgres listens without TLS, and so does a local server
  // — turning TLS on by default fails both with "server does not support SSL".
  // A public endpoint is reached with ?sslmode=require, and its certificate is not
  // one a public CA vouches for, hence rejectUnauthorized: false.
  const wantsTls = /[?&](sslmode=require|ssl=true)/.test(connectionString || '');

  const pool = new pg.Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
    ssl: wantsTls ? { rejectUnauthorized: false } : false,
  });

  return {
    from(table) { return new Query(pool, table); },
    async end() { await pool.end(); },
    pool,
  };
}
