// Витоки Даних — logparsers/proxylog.js
// HAProxy (syslog-формат) та Traefik (JSON access-лог).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var HAPROXY_RE = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+haproxy\[(\d+)\]:\s+(\S+):(\d+)\s+\[([^\]]+)\]\s+(\S+)\s+(\S+)\/(\S+)\s+(\S+)\s+(\d{3})\s+(\S+).*?"(\w+) (\S+)/;

    function detectHaproxy(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (HAPROXY_RE.test(lines[i])) hit++;
        return hit >= 1;
    }

    function parseHaproxy(lines) {
        var entries = [], statusCounts = {}, backendCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = HAPROXY_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = {
                raw: lines[i], parsed: true, time: m[1], host: m[2],
                clientIp: m[4], clientPort: m[5], acceptTime: m[6],
                frontend: m[7], backend: m[8], server: m[9], timers: m[10],
                status: m[11], bytes: m[12], method: m[13], path: m[14]
            };
            entries.push(entry);
            statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
            backendCounts[entry.backend] = (backendCounts[entry.backend] || 0) + 1;
        }
        return { kind: 'haproxy', entries: entries, statusCounts: statusCounts, methodCounts: backendCounts };
    }

    function detectTraefik(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            try {
                var o = JSON.parse(lines[i]);
                if (o && ('DownstreamStatus' in o || 'RouterName' in o) && 'ClientAddr' in o) hit++;
            } catch (e) {}
        }
        return hit >= 1;
    }

    function parseTraefik(lines) {
        var entries = [], statusCounts = {}, routerCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var entry;
            try {
                var o = JSON.parse(lines[i]);
                entry = {
                    raw: lines[i], parsed: true,
                    time: o.StartUTC || o.time || '',
                    clientAddr: o.ClientAddr || '',
                    method: o.RequestMethod || '',
                    path: o.RequestPath || '',
                    status: String(o.DownstreamStatus || o.OriginStatus || ''),
                    router: o.RouterName || '',
                    duration: o.Duration || ''
                };
            } catch (e) {
                entry = { raw: lines[i], parsed: false };
            }
            entries.push(entry);
            if (entry.parsed) {
                statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
                routerCounts[entry.router] = (routerCounts[entry.router] || 0) + 1;
            }
        }
        return { kind: 'traefik', entries: entries, statusCounts: statusCounts, methodCounts: routerCounts };
    }

    window.LogParsers.proxylog = {
        detectHaproxy: detectHaproxy, parseHaproxy: parseHaproxy,
        detectTraefik: detectTraefik, parseTraefik: parseTraefik
    };
})();
