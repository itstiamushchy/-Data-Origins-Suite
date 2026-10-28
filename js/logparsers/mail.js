// Витоки Даних — logparsers/mail.js
// Postfix / sendmail: синтаксис — стандартний BSD syslog, додатково
// розпізнаємо поштові події (доставлено/відхилено/відкладено, connect).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var BSD_RE = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:\[]+)(\[\d+\])?:\s*(.*)$/;

    function detect(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            var m = BSD_RE.exec(lines[i]);
            if (m && /^(postfix|sendmail|postfix\/\w+)/.test(m[3].trim())) hit++;
        }
        return hit >= 1;
    }

    var EVENT_PATTERNS = [
        { re: /status=sent/, label: 'лист доставлено' },
        { re: /status=bounced/, label: 'лист відхилено (bounce)' },
        { re: /status=deferred/, label: 'доставку відкладено' },
        { re: /connect from/, label: 'вхідне з\u2019єднання' },
        { re: /disconnect from/, label: 'з\u2019єднання закрито' },
        { re: /reject:/, label: 'повідомлення відхилено сервером' },
        { re: /NOQUEUE/, label: 'відхилено до постановки в чергу' }
    ];

    function classify(msg) {
        for (var i = 0; i < EVENT_PATTERNS.length; i++) if (EVENT_PATTERNS[i].re.test(msg)) return EVENT_PATTERNS[i].label;
        return null;
    }

    function parse(lines) {
        var entries = [], eventCounts = {}, mailEvents = [];
        for (var i = 0; i < lines.length; i++) {
            var m = BSD_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = { raw: lines[i], parsed: true, time: m[1], host: m[2], app: m[3].trim(), msg: m[5] };
            entries.push(entry);
            var cls = classify(entry.msg);
            if (cls) {
                eventCounts[cls] = (eventCounts[cls] || 0) + 1;
                mailEvents.push({ time: entry.time, host: entry.host, app: entry.app, event: cls, raw: lines[i] });
            }
        }
        return { kind: 'mail-postfix', entries: entries, methodCounts: eventCounts, mailEvents: mailEvents };
    }

    window.LogParsers.mail = { detect: detect, parse: parse };
})();
