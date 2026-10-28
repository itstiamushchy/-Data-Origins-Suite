// Витоки Даних — logparsers/cloudlog.js
// AWS CloudTrail, Azure Activity Log, GCP Cloud Logging — усі JSON,
// розрізняються набором ключових полів.
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    function parseWhole(text) {
        try { return JSON.parse(text); } catch (e) { return null; }
    }

    function recordsFromWholeFile(lines) {
        var whole = parseWhole(lines.join('\n'));
        if (whole && Array.isArray(whole.Records)) return whole.Records; // AWS CloudTrail export
        return null;
    }

    function perLineObjects(lines) {
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) { out.push(null); continue; }
            try { out.push(JSON.parse(lines[i])); } catch (e) { out.push(undefined); }
        }
        return out;
    }

    function detectAwsCloudTrail(lines) {
        var recs = recordsFromWholeFile(lines);
        if (recs && recs.length && recs[0].eventSource && recs[0].eventName) return true;
        var objs = perLineObjects(lines);
        var hit = 0;
        objs.forEach(function (o) { if (o && o.eventSource && o.eventName && o.eventTime) hit++; });
        return hit >= 1;
    }

    function detectAzureActivity(lines) {
        var objs = perLineObjects(lines);
        var hit = 0;
        objs.forEach(function (o) {
            if (o && o.resourceId && o.operationName && (o.eventTimestamp || o.time)) hit++;
        });
        return hit >= 1;
    }

    function detectGcpLogging(lines) {
        var objs = perLineObjects(lines);
        var hit = 0;
        objs.forEach(function (o) {
            if (o && o.logName && o.resource && (o.severity !== undefined) && o.timestamp) hit++;
        });
        return hit >= 1;
    }

    function parseAwsCloudTrail(lines) {
        var recs = recordsFromWholeFile(lines);
        var raws, source;
        if (recs) { raws = recs.map(function (r) { return JSON.stringify(r); }); source = recs; }
        else { var objs = perLineObjects(lines); raws = lines; source = objs; }

        var entries = [], eventCounts = {}, sourceCounts = {};
        for (var i = 0; i < raws.length; i++) {
            var o = source[i];
            if (!o || !o.eventName) { entries.push({ raw: raws[i], parsed: false }); continue; }
            var entry = {
                raw: raws[i], parsed: true, time: o.eventTime || '',
                msg: o.eventName + ' (' + (o.eventSource || '') + ')',
                user: (o.userIdentity && (o.userIdentity.userName || o.userIdentity.type)) || '',
                region: o.awsRegion || '', sourceIp: o.sourceIPAddress || ''
            };
            entries.push(entry);
            eventCounts[o.eventName] = (eventCounts[o.eventName] || 0) + 1;
            sourceCounts[o.eventSource || '?'] = (sourceCounts[o.eventSource || '?'] || 0) + 1;
        }
        return { kind: 'aws-cloudtrail', entries: entries, levelCounts: eventCounts, severityCounts: sourceCounts };
    }

    function parseAzureActivity(lines) {
        var objs = perLineObjects(lines), entries = [], categoryCounts = {}, levelCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var o = objs[i];
            if (!o || !o.operationName) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var opName = typeof o.operationName === 'object' ? (o.operationName.value || o.operationName.localizedValue) : o.operationName;
            var entry = {
                raw: lines[i], parsed: true, time: o.eventTimestamp || o.time || '',
                msg: opName, resource: o.resourceId || '', level: o.level || ''
            };
            entries.push(entry);
            categoryCounts[o.category || '?'] = (categoryCounts[o.category || '?'] || 0) + 1;
            if (entry.level) levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
        }
        return { kind: 'azure-activity', entries: entries, methodCounts: categoryCounts, levelCounts: levelCounts };
    }

    function parseGcpLogging(lines) {
        var objs = perLineObjects(lines), entries = [], severityCounts = {};
        for (var i = 0; i < lines.length; i++) {
            var o = objs[i];
            if (!o || !o.logName) { entries.push({ raw: lines[i], parsed: false }); continue; }
            var msg = o.textPayload || (o.jsonPayload && JSON.stringify(o.jsonPayload)) || (o.protoPayload && JSON.stringify(o.protoPayload)) || '';
            var entry = { raw: lines[i], parsed: true, time: o.timestamp || '', severity: o.severity || '', msg: msg, logName: o.logName };
            entries.push(entry);
            severityCounts[entry.severity || '?'] = (severityCounts[entry.severity || '?'] || 0) + 1;
        }
        return { kind: 'gcp-logging', entries: entries, severityCounts: severityCounts };
    }

    window.LogParsers.cloudlog = {
        detectAwsCloudTrail: detectAwsCloudTrail, parseAwsCloudTrail: parseAwsCloudTrail,
        detectAzureActivity: detectAzureActivity, parseAzureActivity: parseAzureActivity,
        detectGcpLogging: detectGcpLogging, parseGcpLogging: parseGcpLogging
    };
})();
