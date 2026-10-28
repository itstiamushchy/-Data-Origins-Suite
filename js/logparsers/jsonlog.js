// Витоки Даних — logparsers/jsonlog.js
// Docker json-file driver та загальні NDJSON-логи.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    function tryParseLines(lines) {
        var ok = 0, objs = [];
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) { objs.push(null); continue; }
            try { objs.push(JSON.parse(lines[i])); ok++; }
            catch (e) { objs.push(undefined); }
        }
        return { ok: ok, objs: objs };
    }

    function detectDocker(lines) {
        var r = tryParseLines(lines);
        if (r.ok < Math.min(2, lines.length)) return false;
        var dockerHits = 0;
        for (var i = 0; i < r.objs.length; i++) {
            var o = r.objs[i];
            if (o && typeof o === 'object' && 'log' in o && 'stream' in o && 'time' in o) dockerHits++;
        }
        return dockerHits >= 1;
    }

    function detectNdjson(lines) {
        var r = tryParseLines(lines);
        return r.ok >= 1 && r.ok >= Math.min(2, lines.length);
    }

    function parseDocker(lines) {
        var r = tryParseLines(lines), entries = [], streamCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var o = r.objs[i];
            if (o && typeof o === 'object' && 'log' in o) {
                var entry = { raw: lines[i], parsed: true, time: o.time || '', stream: o.stream || '', msg: String(o.log).replace(/\n$/, '') };
                entries.push(entry);
                streamCounts[entry.stream] = (streamCounts[entry.stream] || 0) + 1;
            } else {
                entries.push({ raw: lines[i], parsed: false });
            }
        }
        return { kind: 'docker-json', entries: entries, streamCounts: streamCounts };
    }

    function parseNdjson(lines) {
        var r = tryParseLines(lines), entries = [];
        for (var i = 0; i < lines.length; i++) {
            var o = r.objs[i];
            if (o !== undefined && o !== null) entries.push({ raw: lines[i], parsed: true, obj: o });
            else if (o === null) continue;
            else entries.push({ raw: lines[i], parsed: false });
        }
        return { kind: 'ndjson', entries: entries };
    }

    window.LogParsers.jsonlog = {
        detectDocker: detectDocker, parseDocker: parseDocker,
        detectNdjson: detectNdjson, parseNdjson: parseNdjson
    };
})();
