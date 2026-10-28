// Витоки Даних — logparsers/weblog.js
// Apache / Nginx: access-log (Common/Combined Log Format) та error-log.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var ACCESS_RE = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "([A-Z]+) (\S+)(?: \S+)?" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;
    var ERROR_RE = /^\[([^\]]+)\] \[([^\]]+)\](?: \[client ([^\]]+)\])? (.+)$/;
    var NGINX_ERROR_RE = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\d+#\d+): \*?\d* ?(.+)$/;

    function detectWebAccess(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            if (ACCESS_RE.test(lines[i])) hit++;
            if (hit >= 2) return true;
        }
        return hit >= 1 && lines.length <= 3;
    }

    function detectWebError(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            if (ERROR_RE.test(lines[i]) || NGINX_ERROR_RE.test(lines[i])) hit++;
            if (hit >= 2) return true;
        }
        return hit >= 1 && lines.length <= 3;
    }

    function parseAccess(lines) {
        var entries = [];
        var statusCounts = {};
        var methodCounts = {};
        var ips = {};
        for (var i = 0; i < lines.length; i++) {
            var m = ACCESS_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = {
                raw: lines[i], parsed: true,
                ip: m[1], ident: m[2], user: m[3], time: m[4],
                method: m[5], path: m[6], status: m[7], size: m[8],
                referer: m[9] || '', userAgent: m[10] || ''
            };
            entries.push(entry);
            statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
            methodCounts[entry.method] = (methodCounts[entry.method] || 0) + 1;
            ips[entry.ip] = (ips[entry.ip] || 0) + 1;
        }
        return { kind: 'web-access', entries: entries, statusCounts: statusCounts, methodCounts: methodCounts, ips: ips };
    }

    function parseError(lines) {
        var entries = [];
        var levelCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = ERROR_RE.exec(lines[i]);
            var entry;
            if (m) {
                entry = { raw: lines[i], parsed: true, time: m[1], level: m[2], client: m[3] || '', message: m[4] };
            } else {
                m = NGINX_ERROR_RE.exec(lines[i]);
                if (m) entry = { raw: lines[i], parsed: true, time: m[1], level: m[2], pid: m[3], message: m[4] };
            }
            if (!entry) { entries.push({ raw: lines[i], parsed: false }); continue; }
            entries.push(entry);
            var lvl = (entry.level || '').toLowerCase();
            levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
        }
        return { kind: 'web-error', entries: entries, levelCounts: levelCounts };
    }

    window.LogParsers.weblog = {
        detectAccess: detectWebAccess,
        detectError: detectWebError,
        parseAccess: parseAccess,
        parseError: parseError
    };
})();
