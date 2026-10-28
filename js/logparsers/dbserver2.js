// Витоки Даних — logparsers/dbserver2.js
// MS SQL Server ERRORLOG, Oracle alert log.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var MSSQL_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{2})\s+(\S+)\s+(.*)$/;
    var ORACLE_TS_RE_OLD = /^\w{3} \w{3} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/;
    var ORACLE_TS_RE_NEW = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{2}:\d{2})$/;

    function detectMssql(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (MSSQL_RE.test(lines[i])) hit++;
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }

    function detectOracle(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            if (ORACLE_TS_RE_OLD.test(lines[i]) || ORACLE_TS_RE_NEW.test(lines[i])) hit++;
        }
        return hit >= 1;
    }

    var MSSQL_LEVEL_HINTS = [
        { re: /error|fail/i, level: 'ERROR' },
        { re: /warning/i, level: 'WARNING' }
    ];

    function parseMssql(lines) {
        var entries = [], spidCounts = {}, levelCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = MSSQL_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var level = 'INFO';
            for (var k = 0; k < MSSQL_LEVEL_HINTS.length; k++) {
                if (MSSQL_LEVEL_HINTS[k].re.test(m[3])) { level = MSSQL_LEVEL_HINTS[k].level; break; }
            }
            var entry = { raw: lines[i], parsed: true, time: m[1], spid: m[2], msg: m[3], level: level };
            entries.push(entry);
            spidCounts[entry.spid] = (spidCounts[entry.spid] || 0) + 1;
            levelCounts[level] = (levelCounts[level] || 0) + 1;
        }
        return { kind: 'mssql-errorlog', entries: entries, spidCounts: spidCounts, levelCounts: levelCounts };
    }

    var ORACLE_EVENT_HINTS = [
        { re: /^ORA-\d+/, label: 'помилка Oracle (ORA-код)' },
        { re: /ALTER DATABASE OPEN/i, label: 'відкриття бази даних' },
        { re: /Instance shutdown/i, label: 'зупинка інстанції' },
        { re: /Starting ORACLE instance/i, label: 'запуск інстанції' },
        { re: /Archived Log entry/i, label: 'архівація журналу' }
    ];

    function parseOracle(lines) {
        var entries = [], errorCount = 0, cur = null;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (ORACLE_TS_RE_OLD.test(l) || ORACLE_TS_RE_NEW.test(l)) {
                if (cur) entries.push(cur);
                cur = { raw: l, parsed: true, time: l, msgLines: [], level: 'INFO' };
                continue;
            }
            if (!cur) { entries.push({ raw: l, parsed: false }); continue; }
            cur.msgLines.push(l);
            for (var k = 0; k < ORACLE_EVENT_HINTS.length; k++) {
                if (ORACLE_EVENT_HINTS[k].re.test(l)) { cur.event = ORACLE_EVENT_HINTS[k].label; break; }
            }
            if (/^ORA-\d+/.test(l)) { cur.level = 'ERROR'; errorCount++; }
        }
        if (cur) entries.push(cur);
        for (var j = 0; j < entries.length; j++) if (entries[j].msgLines) entries[j].msg = entries[j].msgLines.join(' ');
        return { kind: 'oracle-alert', entries: entries, levelCounts: { ERROR: errorCount } };
    }

    window.LogParsers.dbserver2 = {
        detectMssql: detectMssql, parseMssql: parseMssql,
        detectOracle: detectOracle, parseOracle: parseOracle
    };
})();
