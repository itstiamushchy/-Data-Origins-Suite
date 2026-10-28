// Витоки Даних — logparsers/syslog.js
// Unix syslog (BSD та RFC5424), auth.log, dmesg.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var BSD_RE = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:\[]+)(\[\d+\])?:\s*(.*)$/;
    var RFC5424_RE = /^<(\d+)>(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/;
    var DMESG_RE = /^\[\s*(\d+\.\d+)\]\s*(.*)$/;

    var FACILITIES = ['kern', 'user', 'mail', 'daemon', 'auth', 'syslog', 'lpr', 'news', 'uucp', 'cron', 'authpriv', 'ftp'];
    var SEVERITIES = ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'];

    function decodePri(pri) {
        var p = parseInt(pri, 10);
        var facility = FACILITIES[Math.floor(p / 8)] || ('facility#' + Math.floor(p / 8));
        var severity = SEVERITIES[p % 8] || ('severity#' + (p % 8));
        return { facility: facility, severity: severity };
    }

    function detect(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            if (BSD_RE.test(lines[i]) || RFC5424_RE.test(lines[i])) hit++;
            if (hit >= 2) return true;
        }
        return hit >= 1 && lines.length <= 3;
    }

    function detectDmesg(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            if (DMESG_RE.test(lines[i])) hit++;
            if (hit >= 2) return true;
        }
        return hit >= 1 && lines.length <= 2;
    }

    var AUTH_PATTERNS = [
        { re: /Accepted password|Accepted publickey/, label: 'успішний вхід' },
        { re: /Failed password|authentication failure/, label: 'невдала спроба входу' },
        { re: /session opened/, label: 'відкрито сеанс' },
        { re: /session closed/, label: 'закрито сеанс' },
        { re: /sudo:.*COMMAND=/, label: 'виконання команди через sudo' },
        { re: /Invalid user/, label: 'спроба входу під неіснуючим користувачем' }
    ];
    var SUDO_CMD_RE = /COMMAND=/;

    function classifyAuth(message, app) {
        if (app && /^sudo/.test(app) && SUDO_CMD_RE.test(message)) return 'виконання команди через sudo';
        for (var i = 0; i < AUTH_PATTERNS.length; i++) {
            if (AUTH_PATTERNS[i].re.test(message)) return AUTH_PATTERNS[i].label;
        }
        return null;
    }

    function parse(lines) {
        var entries = [];
        var severityCounts = {};
        var authEvents = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var m = RFC5424_RE.exec(line);
            var entry;
            if (m) {
                var pri = decodePri(m[1]);
                entry = {
                    raw: line, parsed: true, format: 'RFC5424',
                    facility: pri.facility, severity: pri.severity,
                    time: m[3], host: m[4], app: m[5], pid: m[6], msg: m[8]
                };
            } else {
                m = BSD_RE.exec(line);
                if (m) {
                    entry = {
                        raw: line, parsed: true, format: 'BSD',
                        time: m[1], host: m[2], app: m[3].trim(),
                        pid: m[4] ? m[4].replace(/[\[\]]/g, '') : '', msg: m[5]
                    };
                }
            }
            if (!entry) { entries.push({ raw: line, parsed: false }); continue; }
            entries.push(entry);
            if (entry.severity) severityCounts[entry.severity] = (severityCounts[entry.severity] || 0) + 1;
            var cls = classifyAuth(entry.msg || '', entry.app || '');
            if (cls) authEvents.push({ time: entry.time, host: entry.host, app: entry.app, event: cls, raw: line });
        }
        return { kind: 'syslog', entries: entries, severityCounts: severityCounts, authEvents: authEvents };
    }

    function parseDmesg(lines) {
        var entries = [];
        for (var i = 0; i < lines.length; i++) {
            var m = DMESG_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            entries.push({ raw: lines[i], parsed: true, uptime: m[1], msg: m[2] });
        }
        return { kind: 'dmesg', entries: entries };
    }

    window.LogParsers.syslog = {
        detect: detect, parse: parse,
        detectDmesg: detectDmesg, parseDmesg: parseDmesg
    };
})();
