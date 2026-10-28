// Витоки Даних — logparsers/generic-text.js
// Резервний розбір довільного текстового лог-файлу: шукає часові мітки
// (ISO 8601 та подібні) й рівні журналювання в кожному рядку.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var TS_RE = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/;
    var LEVEL_RE = /\b(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|CRITICAL|CRIT|FATAL|EMERG(?:ENCY)?)\b/i;

    function parse(lines) {
        var entries = [], levelCounts = {}, firstTime = null, lastTime = null;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            var tsM = TS_RE.exec(l);
            var lvlM = LEVEL_RE.exec(l);
            var entry = { raw: l, parsed: !!(tsM || lvlM) };
            if (tsM) { entry.time = tsM[1]; if (!firstTime) firstTime = tsM[1]; lastTime = tsM[1]; }
            if (lvlM) {
                entry.level = lvlM[1].toUpperCase();
                levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
            }
            entries.push(entry);
        }
        return { kind: 'generic-text', entries: entries, levelCounts: levelCounts, firstTime: firstTime, lastTime: lastTime };
    }

    window.LogParsers.genericText = { parse: parse };
})();
