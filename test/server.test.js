'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTerms, parseInterval, parseVideoUrl } = require('../server');

test('accepts supported YouTube URLs', () => {
  assert.equal(parseVideoUrl('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  assert.match(parseVideoUrl('https://www.youtube.com/watch?v=abc'), /^https:\/\/www\.youtube\.com/);
});

test('rejects unsupported or malformed URLs', () => {
  assert.throws(() => parseVideoUrl('https://example.com/video'), /Only youtube/);
  assert.throws(() => parseVideoUrl('not a URL'), /valid YouTube URL/);
});

test('validates interval bounds', () => {
  assert.equal(parseInterval(5), 5);
  assert.throws(() => parseInterval(0), /1 to 60/);
  assert.throws(() => parseInterval(1.5), /1 to 60/);
});

test('normalizes terms before passing them to the process', () => {
  assert.equal(normalizeTerms('square root\nformula\0'), 'square root formula');
  assert.throws(() => normalizeTerms('x'.repeat(501)), /500/);
});
