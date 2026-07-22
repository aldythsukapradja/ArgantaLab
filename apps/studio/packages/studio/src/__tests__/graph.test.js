import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudioGraph, graphStats, KIND_COLOR } from '../graph.js';

const char = (id, name) => ({ id, name, trigger_token: `ar_${name.toLowerCase()}` });
const run = (id, cid, prompt, status = 'complete') => ({ id, character_id: cid, prompt, status, provider: 'arganta' });
const post = (id, runId, cid, platform) => ({ id, run_id: runId, character_id: cid, platform, format: 'post', status: 'draft' });

test('empty inputs → empty graph', () => {
  const { nodes, edges } = buildStudioGraph([], [], []);
  assert.equal(nodes.length, 0);
  assert.equal(edges.length, 0);
});

test('character → generation edges are built', () => {
  const chars = [char('c1', 'Aria')];
  const runs = [run('r1', 'c1', 'a'), run('r2', 'c1', 'b')];
  const { nodes, edges } = buildStudioGraph(runs, chars, []);
  assert.equal(nodes.filter((n) => n.kind === 'character').length, 1);
  assert.equal(nodes.filter((n) => n.kind === 'generation').length, 2);
  assert.equal(edges.filter((e) => e.kind === 'generates').length, 2);
});

test('character-less runs get a synthetic Unassigned hub', () => {
  const runs = [run('r1', null, 'orphan')];
  const { nodes } = buildStudioGraph(runs, [], []);
  const unassigned = nodes.find((n) => n.synthetic);
  assert.ok(unassigned, 'expected a synthetic hub');
  assert.equal(unassigned.title, 'Unassigned');
});

test('full character → generation → post chain', () => {
  const chars = [char('c1', 'Aria')];
  const runs = [run('r1', 'c1', 'a')];
  const posts = [post('p1', 'r1', 'c1', 'tiktok')];
  const { nodes, edges } = buildStudioGraph(runs, chars, posts);
  assert.equal(nodes.length, 3); // char + gen + post
  assert.equal(edges.filter((e) => e.kind === 'generates').length, 1);
  assert.equal(edges.filter((e) => e.kind === 'published').length, 1);
  // the post node exists and is tagged as a post
  assert.ok(nodes.find((n) => n.kind === 'post' && n.id === 'p1'));
});

test('failed generations are colored red, complete are purple', () => {
  const runs = [run('r1', null, 'ok', 'complete'), run('r2', null, 'bad', 'failed')];
  const { nodes } = buildStudioGraph(runs, [], []);
  const ok = nodes.find((n) => n.id === 'r1');
  const bad = nodes.find((n) => n.id === 'r2');
  assert.equal(ok.color, KIND_COLOR.generation);
  assert.equal(bad.color, '#ef4444');
});

test('every node has finite x/y coordinates (deterministic layout)', () => {
  const chars = [char('c1', 'Aria'), char('c2', 'Bea')];
  const runs = [run('r1', 'c1', 'a'), run('r2', 'c2', 'b')];
  const { nodes } = buildStudioGraph(runs, chars, [], { width: 800, height: 600 });
  for (const n of nodes) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `node ${n.id} has bad coords`);
  }
});

test('layout is deterministic — same input, same output', () => {
  const chars = [char('c1', 'Aria')];
  const runs = [run('r1', 'c1', 'a')];
  const a = buildStudioGraph(runs, chars, []);
  const b = buildStudioGraph(runs, chars, []);
  assert.deepEqual(a.nodes.map((n) => [n.id, n.x, n.y]), b.nodes.map((n) => [n.id, n.x, n.y]));
});

test('graphStats counts by kind', () => {
  const chars = [char('c1', 'Aria')];
  const runs = [run('r1', 'c1', 'a')];
  const posts = [post('p1', 'r1', 'c1', 'tiktok')];
  const { nodes } = buildStudioGraph(runs, chars, posts);
  const stats = graphStats(nodes);
  assert.equal(stats.character, 1);
  assert.equal(stats.generation, 1);
  assert.equal(stats.post, 1);
});
