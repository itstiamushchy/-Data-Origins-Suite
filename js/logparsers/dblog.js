// Витоки Даних — logparsers/dblog.js
// MySQL (error/slow/general), PostgreSQL, MongoDB, Redis.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var MYSQL_ERROR_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(\d+)\s+\[(\w+)\]\s+(.*)$/;
    var MYSQL_SLOW_MARK_RE = /^# Time:/;
    var MYSQL_SLOW_QT_RE = /^# Query_time: ([\d.]+)\s+Lock_time: ([\d.]+)\s+Rows_sent: (\d+)\s+Rows_examined: (\d+)/;
    var PG_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ \w+)\s+\[(\d+)\]\s+(\w+):\s*(.*)$/;
    var MONGO_JSON_TS_RE = /"\$date"\s*:\s*"([^"]+)"/;
    var MONGO_TEXT_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{4})\s+(\w)\s+(\w+)\s+\[(\w+)\]\s+(.*)$/;
    var REDIS_RE = /^(\d+):(\w)\s+(\d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2}\.\d+)\s+([*#.\-])\s*(.*)$/;

    function detectMysqlError(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (MYSQL_ERROR_RE.test(lines[i])) hit++;
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }
    function detectMysqlSlow(lines) {
        for (var i = 0; i < Math.min(lines.length, 10); i++) if (MYSQL_SLOW_MARK_RE.test(lines[i])) return true;
        return false;
    }
    function detectPg(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (PG_RE.test(lines[i])) hit++;
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }
    function detectMongo(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (MONGO_TEXT_RE.test(l)) { hit++; continue; }
            if (l.indexOf('"$date"') > -1 && l.indexOf('"s":"') > -1) hit++;
        }
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }
    function detectRedis(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (REDIS_RE.test(lines[i])) hit++;
        return hit >= 1 && hit >= Math.min(2, lines.length);
    }

    function parseMysqlError(lines) {
        var entries = [], levelCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = MYSQL_ERROR_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = { raw: lines[i], parsed: true, time: m[1], threadId: m[2], level: m[3], msg: m[4] };
            entries.push(entry);
            levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
        }
        return { kind: 'mysql-error', entries: entries, levelCounts: levelCounts };
    }

    function parseMysqlSlow(lines) {
        var entries = [], cur = null;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (MYSQL_SLOW_MARK_RE.test(l)) {
                if (cur) entries.push(cur);
                cur = { raw: l, parsed: true, time: l.replace('# Time:', '').trim(), queryLines: [] };
                continue;
            }
            var qt = MYSQL_SLOW_QT_RE.exec(l);
            if (qt && cur) { cur.queryTime = qt[1]; cur.lockTime = qt[2]; cur.rowsSent = qt[3]; cur.rowsExamined = qt[4]; continue; }
            if (cur && l && l.charAt(0) !== '#') cur.queryLines.push(l);
        }
        if (cur) entries.push(cur);
        return { kind: 'mysql-slow', entries: entries };
    }

    function parsePg(lines) {
        var entries = [], levelCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = PG_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = { raw: lines[i], parsed: true, time: m[1], pid: m[2], level: m[3], msg: m[4] };
            entries.push(entry);
            levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
        }
        return { kind: 'postgresql', entries: entries, levelCounts: levelCounts };
    }

    function parseMongo(lines) {
        var entries = [], severityCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            var m = MONGO_TEXT_RE.exec(l);
            if (m) {
                var e1 = { raw: l, parsed: true, time: m[1], severity: m[2], component: m[3], context: m[4], msg: m[5] };
                entries.push(e1); severityCounts[e1.severity] = (severityCounts[e1.severity] || 0) + 1;
                continue;
            }
            try {
                var obj = JSON.parse(l);
                if (obj && obj.s) {
                    var e2 = { raw: l, parsed: true, time: (obj.t && obj.t.$date) || '', severity: obj.s, component: obj.c || '', msg: obj.msg || '' };
                    entries.push(e2); severityCounts[e2.severity] = (severityCounts[e2.severity] || 0) + 1;
                    continue;
                }
            } catch (e) {}
            entries.push({ raw: l, parsed: false });
        }
        return { kind: 'mongodb', entries: entries, severityCounts: severityCounts };
    }

    function parseRedis(lines) {
        var entries = [], roleCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = REDIS_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var entry = { raw: lines[i], parsed: true, pid: m[1], role: m[2], time: m[3], level: m[4], msg: m[5] };
            entries.push(entry);
            roleCounts[entry.role] = (roleCounts[entry.role] || 0) + 1;
        }
        return { kind: 'redis', entries: entries, roleCounts: roleCounts };
    }

    window.LogParsers.dblog = {
        detectMysqlError: detectMysqlError, parseMysqlError: parseMysqlError,
        detectMysqlSlow: detectMysqlSlow, parseMysqlSlow: parseMysqlSlow,
        detectPg: detectPg, parsePg: parsePg,
        detectMongo: detectMongo, parseMongo: parseMongo,
        detectRedis: detectRedis, parseRedis: parseRedis
    };
})();
