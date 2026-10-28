// Витоки Даних — logparsers/iis-firewall.js
// Загальний W3C Extended Log Format (#Fields-заголовок): IIS access-лог
// та Windows Firewall (pfirewall.log) — відрізняються набором полів.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    function findFieldsHeader(lines) {
        for (var i = 0; i < Math.min(lines.length, 10); i++) {
            if (lines[i].indexOf('#Fields:') === 0) return { index: i, fields: lines[i].slice(8).trim().split(/\s+/) };
        }
        return null;
    }

    function softwareHint(lines) {
        for (var i = 0; i < Math.min(lines.length, 10); i++) {
            if (lines[i].indexOf('#Software:') === 0) return lines[i].slice(10).trim();
        }
        return '';
    }

    function detect(lines) {
        return !!findFieldsHeader(lines);
    }

    function classify(fields, software) {
        var sw = software.toLowerCase();
        if (sw.indexOf('firewall') > -1) return 'firewall';
        if (sw.indexOf('internet information services') > -1) return 'iis';
        if (fields.indexOf('cs-uri-stem') > -1 || fields.indexOf('cs-method') > -1) return 'iis';
        if (fields.indexOf('action') > -1 && fields.indexOf('src-ip') > -1) return 'firewall';
        return 'w3c';
    }

    function parse(lines) {
        var header = findFieldsHeader(lines);
        var fields = header ? header.fields : [];
        var software = softwareHint(lines);
        var subtype = classify(fields, software);
        var entries = [];
        var statusCounts = {}, actionCounts = {};

        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (!l || l.charAt(0) === '#') { continue; }
            var parts = l.trim().split(/\s+/);
            var entry = { raw: l, parsed: fields.length > 0 && parts.length === fields.length };
            if (entry.parsed) {
                for (var j = 0; j < fields.length; j++) entry[fields[j]] = parts[j];
                if (entry['date'] && entry['time']) entry.time = entry['date'] + ' ' + entry['time'];
                if (subtype === 'iis' && entry['sc-status']) statusCounts[entry['sc-status']] = (statusCounts[entry['sc-status']] || 0) + 1;
                if (subtype === 'firewall' && entry['action']) actionCounts[entry['action']] = (actionCounts[entry['action']] || 0) + 1;
            }
            entries.push(entry);
        }

        return {
            kind: subtype === 'iis' ? 'iis-access' : (subtype === 'firewall' ? 'windows-firewall' : 'w3c-extended'),
            entries: entries, fields: fields, software: software,
            statusCounts: statusCounts, actionCounts: actionCounts
        };
    }

    window.LogParsers.iisFirewall = { detect: detect, parse: parse };
})();
