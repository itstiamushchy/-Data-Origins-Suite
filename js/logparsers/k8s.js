// Витоки Даних — logparsers/k8s.js
// Kubernetes / containerd CRI-лог подів (текстовий, не JSON, на відміну
// від Docker json-file).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var CRI_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(stdout|stderr)\s+([FP])\s(.*)$/;

    function detect(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (CRI_RE.test(lines[i])) hit++;
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }

    function parse(lines) {
        var entries = [], streamCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = CRI_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = { raw: lines[i], parsed: true, time: m[1], stream: m[2], tag: m[3] === 'P' ? 'частковий рядок' : 'повний рядок', msg: m[4] };
            entries.push(entry);
            streamCounts[entry.stream] = (streamCounts[entry.stream] || 0) + 1;
        }
        return { kind: 'k8s-cri', entries: entries, streamCounts: streamCounts };
    }

    window.LogParsers.k8s = { detect: detect, parse: parse };
})();
