'use strict';
/*
 * Tests for _buildWsUrl(filename, arrIdx).
 *
 * filename may already be URI-encoded from the data-play attribute, so the
 * function decodes first — but must re-encode before splicing it into the
 * WS URL. Without the re-encode, a filename containing '&', '#', or '?'
 * would be spliced unescaped, letting it inject/override the `arrangement`
 * query param or truncate the path at a '#' fragment.
 *
 * Module-scope, `location`-dependent — extract the real source text from
 * screen.js and compile it with a stubbed `location` injected as a
 * parameter. Same extraction approach as splitscreen.test.js.
 *
 * Run: node --test tests/ws_url.test.js
 */
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const src = fs.readFileSync(path.join(__dirname, '..', 'screen.js'), 'utf8');

function grab(re, label) {
    const m = src.match(re);
    if (!m) throw new Error(`could not extract ${label} from screen.js`);
    return m[0];
}
const buildWsUrlSrc = grab(/function _buildWsUrl\(filename, arrIdx\) \{[\s\S]*?\n\}/, '_buildWsUrl');

function load(loc) {
    return new Function(
        'location',
        '"use strict";' + buildWsUrlSrc + '\nreturn { _buildWsUrl };'
    )(loc);
}

const HTTP_LOC = { protocol: 'http:', host: 'localhost:8000' };
const HTTPS_LOC = { protocol: 'https:', host: 'nas.local' };

test('_buildWsUrl uses ws: for http and wss: for https', () => {
    const { _buildWsUrl: build1 } = load(HTTP_LOC);
    assert.equal(build1('song.sloppak', 0), 'ws://localhost:8000/ws/highway/song.sloppak?arrangement=0');

    const { _buildWsUrl: build2 } = load(HTTPS_LOC);
    assert.equal(build2('song.sloppak', 0), 'wss://nas.local/ws/highway/song.sloppak?arrangement=0');
});

test('_buildWsUrl percent-encodes a filename containing an ampersand', () => {
    const { _buildWsUrl } = load(HTTP_LOC);
    const url = _buildWsUrl('a&arrangement=99&x=y.sloppak', 0);
    // Must not let the filename inject a second `arrangement` param.
    assert.equal((url.match(/arrangement=/g) || []).length, 1);
    assert.ok(url.includes('a%26arrangement%3D99%26x%3Dy.sloppak'));
});

test('_buildWsUrl percent-encodes a filename containing a hash fragment', () => {
    const { _buildWsUrl } = load(HTTP_LOC);
    const url = _buildWsUrl('song#fragment.sloppak', 0);
    assert.ok(!url.includes('#fragment'));
    assert.ok(url.includes('song%23fragment.sloppak'));
});

test('_buildWsUrl percent-encodes a filename containing a question mark', () => {
    const { _buildWsUrl } = load(HTTP_LOC);
    const url = _buildWsUrl('weird?name.sloppak', 0);
    assert.ok(url.includes('weird%3Fname.sloppak'));
});

test('_buildWsUrl round-trips an already-URI-encoded filename (decode then re-encode)', () => {
    const { _buildWsUrl } = load(HTTP_LOC);
    // Space encoded as %20 in the data-play attribute.
    const url = _buildWsUrl('My%20Song.sloppak', 3);
    assert.equal(url, 'ws://localhost:8000/ws/highway/My%20Song.sloppak?arrangement=3');
});

test('_buildWsUrl leaves a plain ASCII filename with no special characters unchanged', () => {
    const { _buildWsUrl } = load(HTTP_LOC);
    const url = _buildWsUrl('plainsong.sloppak', 1);
    assert.equal(url, 'ws://localhost:8000/ws/highway/plainsong.sloppak?arrangement=1');
});
