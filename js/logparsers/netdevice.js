// Витоки Даних — logparsers/netdevice.js
// Cisco ASA (%ASA-x-xxxxxx), pfSense filterlog (CSV через syslog), iptables (через kernel).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    var ASA_RE = /%ASA-(\d)-(\d+):\s*(.*)$/;
    var IPTABLES_RE = /\bIN=\S*.*\bSRC=(\S+)\s+DST=(\S+)/;
    var PFSENSE_FILTERLOG_RE = /filterlog(\[\d+\])?:\s*(\d.*)$/;
    var SYSLOG_HEAD_RE = /^(\S+\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T\S+)\s+(\S+)\s+(.*)$/;

    var ASA_SEVERITY = ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'];

    function detectAsa(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (ASA_RE.test(lines[i])) hit++;
        return hit >= 1;
    }
    function detectPfsense(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (PFSENSE_FILTERLOG_RE.test(lines[i])) hit++;
        return hit >= 1;
    }
    function detectIptables(lines) {
        var hit = 0;
        for (var i = 0; i < lines.length; i++) if (IPTABLES_RE.test(lines[i])) hit++;
        return hit >= 1;
    }

    function parseAsa(lines) {
        var entries = [], severityCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = ASA_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var sev = ASA_SEVERITY[parseInt(m[1], 10)] || ('рівень ' + m[1]);
            var entry = { raw: lines[i], parsed: true, severity: sev, code: m[2], msg: m[3] };
            entries.push(entry);
            severityCounts[sev] = (severityCounts[sev] || 0) + 1;
        }
        return { kind: 'cisco-asa', entries: entries, severityCounts: severityCounts };
    }

    // pfSense filterlog CSV: rule,sub,anchor,tracker,interface,reason,action,direction,ipver,...,proto,...,src,dst,srcport,dstport,...
    function parsePfsense(lines) {
        var entries = [], actionCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = PFSENSE_FILTERLOG_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var head = SYSLOG_HEAD_RE.exec(lines[i]);
            var fields = m[2].split(',');
            var entry = {
                raw: lines[i], parsed: true,
                time: head ? head[1] : '',
                action: fields[6] || '', direction: fields[7] || '',
                iface: fields[4] || '', proto: fields[16] || fields[15] || ''
            };
            entries.push(entry);
            actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
        }
        return { kind: 'pfsense-filterlog', entries: entries, actionCounts: actionCounts };
    }

    function parseIptables(lines) {
        var entries = [], protoCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var m = IPTABLES_RE.exec(lines[i]);
            if (!m) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var head = SYSLOG_HEAD_RE.exec(lines[i]);
            var protoM = /\bPROTO=(\S+)/.exec(lines[i]);
            var entry = {
                raw: lines[i], parsed: true,
                time: head ? head[1] : '',
                src: m[1], dst: m[2], proto: protoM ? protoM[1] : ''
            };
            entries.push(entry);
            protoCounts[entry.proto || '?'] = (protoCounts[entry.proto || '?'] || 0) + 1;
        }
        return { kind: 'iptables', entries: entries, methodCounts: protoCounts };
    }

    window.LogParsers.netdevice = {
        detectAsa: detectAsa, parseAsa: parseAsa,
        detectPfsense: detectPfsense, parsePfsense: parsePfsense,
        detectIptables: detectIptables, parseIptables: parseIptables
    };
})();
