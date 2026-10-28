// Витоки Даних — logparsers/javalog.js
// Java / log4j / logback: рядки з рівнем і потоком + продовження
// стек-трейсів (at ..., Caused by: ..., ... N more).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var HEAD_RE = /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[([^\]]+)\]\s+(\S+)\s*-\s*(.*)$/;
    var TRACE_CONT_RE = /^\s*(at\s+\S+|Caused by:|\.\.\.\s*\d+\s+more|Suppressed:)/;

    function detect(lines) {
        // Записи часто розтягнуті на кілька рядків (стек-трейси), тож
        // достатньо хоча б одного валідного заголовка запису.
        for (var i = 0; i < lines.length; i++) if (HEAD_RE.test(lines[i])) return true;
        return false;
    }

    function parse(lines) {
        var entries = [], levelCounts = {}, cur = null;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            var m = HEAD_RE.exec(l);
            if (m) {
                if (cur) entries.push(cur);
                cur = { raw: l, parsed: true, time: m[1], level: m[2], thread: m[3], logger: m[4], msg: m[5], stack: [] };
                levelCounts[cur.level] = (levelCounts[cur.level] || 0) + 1;
                continue;
            }
            if (cur && TRACE_CONT_RE.test(l)) { cur.stack.push(l.trim()); continue; }
            if (cur) { cur.stack.push(l); continue; }
            entries.push({ raw: l, parsed: false });
        }
        if (cur) entries.push(cur);
        return { kind: 'java-log4j', entries: entries, levelCounts: levelCounts };
    }

    window.LogParsers.javalog = { detect: detect, parse: parse };
})();
