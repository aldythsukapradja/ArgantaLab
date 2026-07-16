import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyArtifactKind, classifyGameGenre, ARTIFACT_KINDS, GAME_GENRES, isArtifactKind, isVisibility,
  buildGenerationPrompt, CONTRACT_RULES,
  isValidComponent, selectComponents,
} from '../src/index.js';

test('classifier: task/state language → application, presentation language → website', () => {
  assert.equal(classifyArtifactKind('build me an expense tracker').kind, 'application');
  assert.equal(classifyArtifactKind('create a company landing page').kind, 'website');
  assert.equal(classifyArtifactKind('a CRM dashboard').kind, 'application');
  assert.equal(classifyArtifactKind('my portfolio').kind, 'website');
});

test('classifier: ambiguous defaults to website (the lower-risk artifact), mixed favors application', () => {
  assert.equal(classifyArtifactKind('something nice for arganta').kind, 'website');
  assert.equal(classifyArtifactKind('a landing page with a working expense tracker').kind, 'application'); // has state → app wins
});

test('GB-1 classifier: play language → game, and game beats the app vocabulary it overlaps', () => {
  assert.equal(classifyArtifactKind('a snake game').kind, 'game');
  assert.equal(classifyArtifactKind('build a platformer with 3 levels').kind, 'game');
  assert.equal(classifyArtifactKind('tower defense with waves of enemies').kind, 'game');
  // 'track' is an app signal, but this is unambiguously a game — game wins.
  assert.equal(classifyArtifactKind('a game to track your high score').kind, 'game');
  // …and non-game briefs are NOT dragged into game by a stray word.
  assert.equal(classifyArtifactKind('an expense tracker').kind, 'application');
});

test('GB-1 genre classifier: matches a genre, or honestly says custom', () => {
  assert.equal(classifyGameGenre('a snake game'), 'arcade');
  assert.equal(classifyGameGenre('match-3 puzzle'), 'puzzle');
  assert.equal(classifyGameGenre('a mario-like jumper'), 'platformer');
  assert.equal(classifyGameGenre('something with dragons'), 'custom'); // never guesses
  assert.ok(GAME_GENRES.includes(classifyGameGenre('a racing game')));
});

test('frozen sets + guards', () => {
  assert.deepEqual([...ARTIFACT_KINDS], ['application', 'website', 'game']);
  assert.equal(isArtifactKind('website'), true);
  assert.equal(isArtifactKind('game'), true);
  assert.equal(isArtifactKind('spreadsheet'), false);
  assert.equal(isVisibility('private'), true);
});

test('buildGenerationPrompt: fresh build = system + user brief; mode policy + rules present', () => {
  const msgs = buildGenerationPrompt({ kind: 'application', brief: 'expense tracker' });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[0].content, /MODE: APPLICATION/);
  assert.match(msgs[0].content, /one complete/i);
  assert.equal(msgs[1].content, 'expense tracker');
});

test('buildGenerationPrompt: a revision includes the current HTML and a preserve-unrelated instruction', () => {
  const msgs = buildGenerationPrompt({ kind: 'website', brief: 'x', currentHtml: '<html>OLD</html>', instruction: 'add a pricing section' });
  assert.equal(msgs.length, 3);
  assert.match(msgs[1].content, /OLD/);
  assert.match(msgs[2].content, /add a pricing section/);
  assert.match(msgs[2].content, /preserving everything unrelated/i);
});

test('buildGenerationPrompt: Circle SDK only injected for apps when asked', () => {
  const withSdk = buildGenerationPrompt({ kind: 'application', brief: 'x', useCircleSdk: true });
  assert.match(withSdk[0].content, /Circle App SDK/);
  const siteWithSdk = buildGenerationPrompt({ kind: 'website', brief: 'x', useCircleSdk: true });
  assert.doesNotMatch(siteWithSdk[0].content, /Circle App SDK/); // websites never get it
});

test('GB-1 buildGenerationPrompt: game mode carries the play contract, the genre, and the Game SDK', () => {
  const msgs = buildGenerationPrompt({ kind: 'game', brief: 'a snake game', genre: 'arcade', useCircleSdk: true });
  const sys = msgs[0].content;
  assert.match(sys, /MODE: GAME/);
  assert.match(sys, /requestAnimationFrame/);      // must demand a real loop
  assert.match(sys, /touch/i);                     // must demand phone-playable input
  assert.match(sys, /GENRE: arcade/);
  assert.match(sys, /CircleGame\.submitScore/);    // the game SDK, not the app one
  assert.doesNotMatch(sys, /Circle App SDK/);
});

test('GB-1 buildGenerationPrompt: page blocks are never hinted to a game (they are app/site furniture)', () => {
  const game = buildGenerationPrompt({ kind: 'game', brief: 'x', componentHints: ['Hero (hero): a big banner'] });
  assert.doesNotMatch(game[0].content, /ASSEMBLE FROM THESE BLOCKS/);
  const app = buildGenerationPrompt({ kind: 'application', brief: 'x', componentHints: ['Hero (hero): a big banner'] });
  assert.match(app[0].content, /ASSEMBLE FROM THESE BLOCKS/);
});

test('CONTRACT_RULES restate what validate.js enforces (single-file, no fences, approved hosts, no secrets)', () => {
  const joined = CONTRACT_RULES.join(' ').toLowerCase();
  assert.match(joined, /one complete html/);
  assert.match(joined, /no markdown|code fences/);
  assert.match(joined, /cdn\.jsdelivr\.net/);
  assert.match(joined, /credential|api key/);
});

test('component validation + bounded selection', () => {
  const reg = [
    { id: 'line-chart', name: 'Line chart', category: 'chart', suitableFor: ['application'], description: '', tags: ['revenue', 'trend'], html: '<div></div>', css: '' },
    { id: 'hero', name: 'Hero', category: 'hero', suitableFor: ['website'], description: '', tags: ['landing'], html: '<div></div>', css: '' },
    { id: 'bad', name: 'Bad', category: 'nonsense', suitableFor: [], description: '', html: '', css: '' },
  ];
  assert.equal(isValidComponent(reg[0]), true);
  assert.equal(isValidComponent(reg[2]), false); // unknown category + no suitableFor

  const picked = selectComponents(reg, { brief: 'a dashboard with a revenue trend chart', kind: 'application', max: 4 });
  assert.ok(picked.some((c) => c.id === 'line-chart'));
  assert.ok(!picked.some((c) => c.id === 'hero')); // website-only, filtered out for an app
});
