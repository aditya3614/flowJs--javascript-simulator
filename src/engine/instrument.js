/**
 * Source instrumentation.
 *
 * Parses user code, rewrites it so every interesting moment calls back into the
 * tracer (`__T`), and returns the rewritten source plus a metadata table. The
 * metadata table keeps generated code tiny: instrumentation calls pass an index
 * instead of repeating line numbers and source text.
 */

import { parse } from 'acorn';
import { generate } from 'astring';

/* ---------------------------------------------------------------- builders */

const id = (name) => ({ type: 'Identifier', name });
const lit = (value) => ({ type: 'Literal', value });
const mem = (object, prop) => ({
  type: 'MemberExpression', object, property: id(prop), computed: false, optional: false,
});
const T = (prop) => mem(id('__T'), prop);
const call = (callee, args) => ({ type: 'CallExpression', callee, arguments: args, optional: false });
const stmt = (expression) => ({ type: 'ExpressionStatement', expression });
const arr = (elements) => ({ type: 'ArrayExpression', elements });

const prop = (key, value) => ({
  type: 'Property', key: id(key), value, kind: 'init',
  computed: false, method: false, shorthand: false,
});

const thunk = (body) => ({
  type: 'ArrowFunctionExpression', params: [], body, expression: true, async: false, generator: false,
});

/* ------------------------------------------------------------------ scopes */

class Scope {
  constructor(parent = null, kind = 'block') {
    this.parent = parent;
    this.kind = kind;
    this.names = new Set();
  }
  declare(name) { if (name) this.names.add(name); }
  /** Every name reachable here, innermost first, de-duplicated. */
  visible() {
    const seen = new Set();
    const out = [];
    for (let s = this; s; s = s.parent) {
      for (const n of s.names) if (!seen.has(n)) { seen.add(n); out.push(n); }
    }
    return out;
  }
  functionScope() {
    let s = this;
    while (s && s.kind !== 'function') s = s.parent;
    return s || this;
  }
}

/** An arrow returning `{ a: a, b: b }` for every name currently in scope. */
function scopeThunk(scope) {
  const names = scope.visible().filter((n) => !n.startsWith('__'));
  return thunk({
    type: 'ObjectExpression',
    properties: names.map((n) => prop(n, id(n))),
  });
}

/* ------------------------------------------------------- pattern utilities */

/** Every identifier a binding pattern introduces. */
function boundNames(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.push(node.name); break;
    case 'ObjectPattern': node.properties.forEach((p) => boundNames(p.type === 'RestElement' ? p.argument : p.value, out)); break;
    case 'ArrayPattern': node.elements.forEach((e) => boundNames(e, out)); break;
    case 'AssignmentPattern': boundNames(node.left, out); break;
    case 'RestElement': boundNames(node.argument, out); break;
    default: break;
  }
  return out;
}

/** The base identifier of a member chain, e.g. `a` in `a.b[0].c`. */
function rootName(node) {
  let n = node;
  while (n && n.type === 'MemberExpression') n = n.object;
  return n && n.type === 'Identifier' ? n.name : null;
}

/* --------------------------------------------------------- traced builtins */

/** Array/string methods worth drawing as a pipeline stage. */
const TRACED_METHODS = new Set([
  'map', 'filter', 'reduce', 'reduceRight', 'forEach', 'sort', 'some', 'every',
  'find', 'findIndex', 'findLast', 'flatMap', 'flat', 'slice', 'concat', 'join',
  'reverse', 'includes', 'indexOf', 'push', 'pop', 'shift', 'unshift', 'splice',
  'fill', 'at', 'split', 'toSorted', 'toReversed', 'entries', 'keys', 'values',
]);

/* ------------------------------------------------------------ the compiler */

class Compiler {
  constructor(source) {
    this.source = source;
    this.meta = [];
  }

  /** Register a metadata record and return its index. */
  mark(node, extra = {}) {
    const loc = node.loc || { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
    this.meta.push({
      line: loc.start.line,
      endLine: loc.end.line,
      col: loc.start.column,
      endCol: loc.end.column,
      type: node.type,
      text: this.snippet(node),
      ...extra,
    });
    return this.meta.length - 1;
  }

  snippet(node, max = 90) {
    if (node.start == null || node.end == null) return '';
    let s = this.source.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
    if (s.length > max) s = `${s.slice(0, max - 1)}…`;
    return s;
  }

  /* ---------------------------------------------------------- statements */

  /** Rewrite a statement list, threading declarations through `scope`. */
  body(list, scope) {
    this.hoist(list, scope);
    const out = [];
    for (const node of list) {
      if (node.type === 'FunctionDeclaration') {
        // Already hoisted; emit without a step marker so the timeline stays clean.
        out.push(this.statement(node, scope));
        continue;
      }
      const metaId = this.mark(node, { role: 'step' });
      out.push(stmt(call(T('s'), [lit(metaId), scopeThunk(scope)])));
      const compiled = this.statement(node, scope);
      if (Array.isArray(compiled)) out.push(...compiled);
      else out.push(compiled);
      this.declare(node, scope);
    }
    return out;
  }

  /** Give `var` and function declarations their hoisted visibility. */
  hoist(list, scope) {
    const fnScope = scope.functionScope();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === 'FunctionDeclaration') { scope.declare(node.id && node.id.name); return; }
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'ClassDeclaration') return;
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        node.declarations.forEach((d) => boundNames(d.id).forEach((n) => fnScope.declare(n)));
      }
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'start' || key === 'end') continue;
        walk(node[key]);
      }
    };
    list.forEach(walk);
  }

  /** Register the bindings a statement introduces, after it has run. */
  declare(node, scope) {
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach((d) => boundNames(d.id).forEach((n) => scope.declare(n)));
    } else if (node.type === 'ClassDeclaration' && node.id) {
      scope.declare(node.id.name);
    }
  }

  /** Force a statement into a block so we can prepend instrumentation. */
  block(node, scope, prefix = []) {
    if (node && node.type === 'BlockStatement') {
      const inner = new Scope(scope, 'block');
      return { type: 'BlockStatement', body: [...prefix, ...this.body(node.body, inner)] };
    }
    if (!node) return { type: 'BlockStatement', body: prefix };
    const inner = new Scope(scope, 'block');
    return { type: 'BlockStatement', body: [...prefix, ...this.body([node], inner)] };
  }

  statement(node, scope) {
    switch (node.type) {
      case 'VariableDeclaration': return this.varDecl(node, scope);

      case 'ExpressionStatement':
        return stmt(this.expr(node.expression, scope, { statement: true }));

      case 'IfStatement': {
        const metaId = this.mark(node.test, { role: 'cond', kind: 'if' });
        return {
          ...node,
          test: call(T('cond'), [lit(metaId), this.expr(node.test, scope)]),
          consequent: this.block(node.consequent, scope),
          alternate: node.alternate
            ? (node.alternate.type === 'IfStatement'
              ? this.statement(node.alternate, scope)
              : this.block(node.alternate, scope))
            : null,
        };
      }

      case 'WhileStatement': {
        const metaId = this.mark(node.test, { role: 'cond', kind: 'while' });
        const loopId = this.mark(node, { role: 'loop', kind: 'while', test: this.snippet(node.test, 40) });
        const inner = new Scope(scope, 'block');
        return {
          ...node,
          test: call(T('cond'), [lit(metaId), this.expr(node.test, scope)]),
          body: this.block(node.body, inner, [stmt(call(T('iter'), [lit(loopId), scopeThunk(inner)]))]),
        };
      }

      case 'DoWhileStatement': {
        const metaId = this.mark(node.test, { role: 'cond', kind: 'while' });
        const loopId = this.mark(node, { role: 'loop', kind: 'do-while' });
        const inner = new Scope(scope, 'block');
        return {
          ...node,
          test: call(T('cond'), [lit(metaId), this.expr(node.test, scope)]),
          body: this.block(node.body, inner, [stmt(call(T('iter'), [lit(loopId), scopeThunk(inner)]))]),
        };
      }

      case 'ForStatement': {
        const inner = new Scope(scope, 'block');
        let init = node.init;
        if (init && init.type === 'VariableDeclaration') {
          boundNames(init.declarations[0] && init.declarations[0].id).forEach((n) => inner.declare(n));
          init = this.varDeclRaw(init, inner);
        } else if (init) {
          init = this.expr(init, inner);
        }
        const testId = node.test ? this.mark(node.test, { role: 'cond', kind: 'for' }) : null;
        const loopVars = [];
        if (node.init && node.init.type === 'VariableDeclaration') {
          node.init.declarations.forEach((d) => boundNames(d.id).forEach((n) => loopVars.push(n)));
        }
        const loopId = this.mark(node, { role: 'loop', kind: 'for', vars: loopVars });
        return {
          ...node,
          init,
          test: node.test ? call(T('cond'), [lit(testId), this.expr(node.test, inner)]) : null,
          update: node.update ? this.expr(node.update, inner, { quiet: true }) : null,
          body: this.block(node.body, inner, [stmt(call(T('iter'), [lit(loopId), scopeThunk(inner)]))]),
        };
      }

      case 'ForOfStatement':
      case 'ForInStatement': {
        const inner = new Scope(scope, 'block');
        let left = node.left;
        if (left.type === 'VariableDeclaration') {
          boundNames(left.declarations[0].id).forEach((n) => inner.declare(n));
        } else {
          boundNames(left).forEach((n) => inner.declare(n));
        }
        const loopId = this.mark(node, {
          role: 'loop',
          kind: node.type === 'ForOfStatement' ? 'for-of' : 'for-in',
          over: this.snippet(node.right, 40),
          vars: left.type === 'VariableDeclaration'
            ? boundNames(left.declarations[0].id)
            : boundNames(left),
        });
        return {
          ...node,
          left,
          right: this.expr(node.right, scope),
          body: this.block(node.body, inner, [stmt(call(T('iter'), [lit(loopId), scopeThunk(inner)]))]),
        };
      }

      case 'ReturnStatement': {
        const metaId = this.mark(node, {
          role: 'return',
          expr: node.argument ? this.snippet(node.argument, 50) : null,
        });
        return {
          ...node,
          argument: call(T('ret'), [
            lit(metaId),
            node.argument ? this.expr(node.argument, scope) : { type: 'Identifier', name: 'undefined' },
          ]),
        };
      }

      case 'BlockStatement':
        return this.block(node, scope);

      case 'FunctionDeclaration':
        return { ...node, ...this.fn(node, scope) };

      case 'ClassDeclaration':
      case 'ClassExpression':
        return { ...node, body: this.classBody(node.body, scope), superClass: node.superClass ? this.expr(node.superClass, scope) : null };

      case 'TryStatement': {
        const handler = node.handler
          ? (() => {
            const inner = new Scope(scope, 'block');
            boundNames(node.handler.param).forEach((n) => inner.declare(n));
            return { ...node.handler, body: this.block(node.handler.body, inner) };
          })()
          : null;
        return {
          ...node,
          block: this.block(node.block, scope),
          handler,
          finalizer: node.finalizer ? this.block(node.finalizer, scope) : null,
        };
      }

      case 'SwitchStatement': {
        const inner = new Scope(scope, 'block');
        const metaId = this.mark(node.discriminant, { role: 'switch' });
        return {
          ...node,
          discriminant: call(T('cond'), [lit(metaId), this.expr(node.discriminant, scope)]),
          cases: node.cases.map((c) => ({
            ...c,
            test: c.test ? this.expr(c.test, inner) : null,
            consequent: this.body(c.consequent, inner),
          })),
        };
      }

      case 'LabeledStatement':
        return { ...node, body: this.statement(node.body, scope) };

      case 'ThrowStatement':
        return { ...node, argument: this.expr(node.argument, scope) };

      case 'BreakStatement':
      case 'ContinueStatement':
      case 'EmptyStatement':
      case 'DebuggerStatement':
        return node;

      default:
        return this.generic(node, scope);
    }
  }

  /* ------------------------------------------------------- declarations */

  varDeclRaw(node, scope) {
    return {
      ...node,
      declarations: node.declarations.map((d) => {
        if (!d.init) return d;
        if (d.id.type === 'Identifier') {
          const metaId = this.mark(d, { role: 'decl', name: d.id.name, kind: node.kind });
          return { ...d, init: call(T('d'), [lit(metaId), lit(d.id.name), this.expr(d.init, scope)]) };
        }
        return { ...d, init: this.expr(d.init, scope) };
      }),
    };
  }

  varDecl(node, scope) {
    const decl = this.varDeclRaw(node, scope);
    // Destructuring binds several names at once — report them once bound.
    const patterns = node.declarations.filter((d) => d.id.type !== 'Identifier');
    if (!patterns.length) return decl;
    const scopeAfter = new Scope(scope, 'block');
    scope.visible().forEach((n) => scopeAfter.declare(n));
    const names = [];
    patterns.forEach((d) => boundNames(d.id).forEach((n) => { names.push(n); scopeAfter.declare(n); }));
    const metaId = this.mark(node, { role: 'destructure', names, kind: node.kind });
    return [
      decl,
      stmt(call(T('dp'), [lit(metaId), {
        type: 'ObjectExpression', properties: names.map((n) => prop(n, id(n))),
      }])),
    ];
  }

  /* ----------------------------------------------------------- functions */

  /** Build the instrumented `{ params, body }` of any function-like node. */
  fn(node, scope) {
    const inner = new Scope(scope, 'function');
    const paramNames = [];
    node.params.forEach((p) => boundNames(p).forEach((n) => { paramNames.push(n); inner.declare(n); }));

    const name = (node.id && node.id.name)
      || (node.__inferredName)
      || (node.type === 'ArrowFunctionExpression' ? 'λ' : 'anonymous');

    const metaId = this.mark(node, {
      role: 'fn',
      name,
      params: paramNames,
      arrow: node.type === 'ArrowFunctionExpression',
    });

    const isExpressionBody = node.body.type !== 'BlockStatement';
    const bodyStatements = isExpressionBody
      ? [{
        type: 'ReturnStatement',
        argument: node.body,
        loc: node.body.loc,
        start: node.body.start,
        end: node.body.end,
      }]
      : node.body.body;

    const enter = stmt(call(T('enter'), [lit(metaId), {
      type: 'ObjectExpression', properties: paramNames.map((n) => prop(n, id(n))),
    }]));

    const compiled = this.body(bodyStatements, inner);

    return {
      params: node.params,
      body: {
        type: 'BlockStatement',
        body: [
          enter,
          {
            type: 'TryStatement',
            block: { type: 'BlockStatement', body: compiled },
            handler: null,
            finalizer: { type: 'BlockStatement', body: [stmt(call(T('exit'), [lit(metaId)]))] },
          },
        ],
      },
      expression: false,
    };
  }

  classBody(body, scope) {
    return {
      ...body,
      body: body.body.map((m) => {
        if (m.type === 'MethodDefinition') {
          const named = { ...m.value, __inferredName: `${m.key.name || 'method'}` };
          return { ...m, value: { ...m.value, ...this.fn(named, scope) } };
        }
        if (m.type === 'PropertyDefinition' && m.value) {
          return { ...m, value: this.expr(m.value, scope) };
        }
        return m;
      }),
    };
  }

  /* --------------------------------------------------------- expressions */

  expr(node, scope, opts = {}) {
    if (!node || typeof node !== 'object') return node;

    switch (node.type) {
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return { ...node, ...this.fn(node, scope) };

      case 'ClassExpression':
        return { ...node, body: this.classBody(node.body, scope) };

      case 'AssignmentExpression': {
        const right = this.expr(node.right, scope);
        if (node.left.type === 'Identifier') {
          const metaId = this.mark(node, { role: 'assign', name: node.left.name, op: node.operator });
          return call(T('a'), [
            lit(metaId), lit(node.left.name), id(node.left.name),
            { ...node, right }, thunk(id(node.left.name)),
          ]);
        }
        if (node.left.type === 'MemberExpression') {
          const base = rootName(node.left);
          const metaId = this.mark(node, {
            role: 'assign', name: this.snippet(node.left, 40), op: node.operator, root: base,
          });
          const left = { ...node.left, object: this.expr(node.left.object, scope), property: node.left.computed ? this.expr(node.left.property, scope) : node.left.property };
          return call(T('am'), [
            lit(metaId), { ...node, left, right },
            base ? thunk(id(base)) : lit(null),
          ]);
        }
        // Destructuring assignment — evaluate, then report.
        return { ...node, right };
      }

      case 'UpdateExpression': {
        if (node.argument.type !== 'Identifier' || opts.quiet) {
          return { ...node, argument: this.expr(node.argument, scope) };
        }
        const metaId = this.mark(node, { role: 'assign', name: node.argument.name, op: node.operator });
        return call(T('u'), [lit(metaId), lit(node.argument.name), node, thunk(id(node.argument.name))]);
      }

      case 'ConditionalExpression': {
        const metaId = this.mark(node.test, { role: 'cond', kind: 'ternary' });
        return {
          ...node,
          test: call(T('cond'), [lit(metaId), this.expr(node.test, scope)]),
          consequent: this.expr(node.consequent, scope),
          alternate: this.expr(node.alternate, scope),
        };
      }

      case 'CallExpression':
        return this.callExpr(node, scope, opts);

      case 'VariableDeclaration':
        return this.varDeclRaw(node, scope);

      default:
        return this.generic(node, scope);
    }
  }

  callExpr(node, scope, opts) {
    const callee = node.callee;

    // console.* — captured so output lands in the playground console.
    if (
      callee.type === 'MemberExpression' && !callee.computed && !callee.optional
      && callee.object.type === 'Identifier' && callee.object.name === 'console'
      && callee.property.type === 'Identifier'
    ) {
      const metaId = this.mark(node, { role: 'log', method: callee.property.name });
      return call(T('log'), [
        lit(metaId), lit(callee.property.name),
        arr(node.arguments.map((a) => this.expr(a, scope))),
      ]);
    }

    // Array-ish method calls become pipeline stages.
    if (
      callee.type === 'MemberExpression' && !callee.computed && !callee.optional && !node.optional
      && callee.property.type === 'Identifier' && TRACED_METHODS.has(callee.property.name)
      && callee.object.type !== 'Super'
      && !node.arguments.some((a) => a.type === 'SpreadElement')
    ) {
      const method = callee.property.name;
      const cbNode = node.arguments.find((a) => a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression');
      const metaId = this.mark(node, {
        role: 'stage',
        method,
        source: this.snippet(callee.object, 36),
        // When the receiver is a plain variable, in-place changes can be
        // reflected straight back into the variables panel.
        sourceName: callee.object.type === 'Identifier' ? callee.object.name : null,
        body: cbNode ? this.snippet(cbNode.body, 46) : null,
        params: cbNode ? cbNode.params.map((p) => this.snippet(p, 14)) : [],
        // Single-expression callbacks are fully described by the stage itself,
        // so their internals do not need their own timeline frames.
        simple: !!cbNode && cbNode.type === 'ArrowFunctionExpression' && cbNode.body.type !== 'BlockStatement',
      });
      return call(T('c'), [
        lit(metaId),
        this.expr(callee.object, scope),
        lit(method),
        arr(node.arguments.map((a) => this.expr(a, scope))),
      ]);
    }

    return {
      ...node,
      callee: this.expr(callee, scope),
      arguments: node.arguments.map((a) => this.expr(a, scope)),
    };
  }

  /** Structural walk for node types with no special handling. */
  generic(node, scope) {
    const out = { ...node };
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range' || key === 'type') continue;
      // Positions that are names, not values.
      if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
      if (node.type === 'Property' && key === 'key' && !node.computed) continue;
      if (node.type === 'MethodDefinition' && key === 'key' && !node.computed) continue;
      if (node.type === 'LabeledStatement' && key === 'label') continue;
      if ((node.type === 'BreakStatement' || node.type === 'ContinueStatement') && key === 'label') continue;

      const value = node[key];
      if (Array.isArray(value)) {
        out[key] = value.map((v) => (v && v.type ? this.dispatch(v, scope) : v));
      } else if (value && typeof value === 'object' && value.type) {
        out[key] = this.dispatch(value, scope);
      }
    }
    return out;
  }

  dispatch(node, scope) {
    if (node.type === 'BlockStatement') return this.block(node, scope);
    if (node.type.endsWith('Statement') || node.type.endsWith('Declaration')) return this.statement(node, scope);
    return this.expr(node, scope);
  }
}

/* -------------------------------------------------------------- public API */

export function instrument(source) {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    locations: true,
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
  });

  const compiler = new Compiler(source);
  const root = new Scope(null, 'function');
  const body = compiler.body(ast.body, root);
  const code = generate({ type: 'Program', body, sourceType: 'script' });

  return { code, meta: compiler.meta };
}
