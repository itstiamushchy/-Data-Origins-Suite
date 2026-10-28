// Витоки Даних — log-app.js
(function () {
    'use strict';

    // --- Перемикач вкладок Метадані / Логи ---
    var tabMetaBtn = document.getElementById('tabMetaBtn');
    var tabLogsBtn = document.getElementById('tabLogsBtn');
    var viewMeta = document.getElementById('viewMeta');
    var viewLogs = document.getElementById('viewLogs');

    function activateTab(which) {
        var meta = which === 'meta';
        tabMetaBtn.classList.toggle('active', meta);
        tabLogsBtn.classList.toggle('active', !meta);
        viewMeta.classList.toggle('active', meta);
        viewLogs.classList.toggle('active', !meta);
    }
    tabMetaBtn.addEventListener('click', function () { activateTab('meta'); });
    tabLogsBtn.addEventListener('click', function () { activateTab('logs'); });

    // --- Логіка вкладки «Логи» ---
    var logFileInput = document.getElementById('logFileInput');
    var logDropZone = document.getElementById('logDropZone');
    var logTerminalContent = document.getElementById('logTerminalContent');
    var logReportContent = document.getElementById('logReportContent');
    var logReportBtn = document.getElementById('logReportBtn');
    var logFileNameLabel = document.getElementById('logFileNameLabel');
    var logRawPane = document.getElementById('logRawPane');
    var logReportPane = document.getElementById('logReportPane');

    var currentLogFileInfo = null;
    var currentLogDetected = null;
    var reportShown = false;

    function humanSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        var units = ['КБ', 'МБ', 'ГБ'];
        var v = bytes;
        for (var i = 0; i < units.length; i++) {
            v /= 1024;
            if (v < 1024 || i === units.length - 1) return v.toFixed(2) + ' ' + units[i];
        }
    }

    function clearLogTerminal() { logTerminalContent.innerHTML = ''; }
    function clearLogReport() { logReportContent.innerHTML = ''; }

    function lineClass(entry) {
        var lvl = ((entry && (entry.level || entry.severity)) || '').toString().toUpperCase();
        if (/ERROR|CRIT|FATAL|EMERG|^E$|^4$|^5$/.test(lvl)) return 'log-line-error';
        if (/WARN|^W$/.test(lvl)) return 'log-line-warn';
        return 'log-line-ok';
    }

    function printRawLines(lines, entries) {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < lines.length; i++) {
            var div = document.createElement('div');
            div.className = entries && entries[i] ? lineClass(entries[i]) : 'log-line-ok';
            div.textContent = lines[i];
            frag.appendChild(div);
        }
        logTerminalContent.appendChild(frag);
    }

    function printInfo(text) {
        var div = document.createElement('div');
        div.className = 'log-line-muted';
        div.textContent = text;
        logTerminalContent.appendChild(div);
    }

    // Визначення типу журналу: спершу бінарні сигнатури, потім текстові патерни.
    function detectAndParseLog(file, buffer, textLines) {
        var ext = (file.name.toLowerCase().split('.').pop() || '');
        var LP = window.LogParsers;

        if (LP.winmacBinary.detectEvtx(buffer)) {
            return { kind: 'evtx-binary', binary: true, entries: LP.winmacBinary.parseEvtx(buffer) };
        }
        if (LP.winmacBinary.detectSystemdJournal(buffer)) {
            return { kind: 'systemd-journal-binary', binary: true, entries: LP.winmacBinary.parseSystemdJournal(buffer) };
        }
        if (LP.winmacBinary.detectAsl(buffer)) {
            return { kind: 'asl-binary', binary: true, entries: LP.winmacBinary.parseAsl(buffer) };
        }
        if (LP.winmacBinary.detectTracev3(buffer, ext)) {
            return { kind: 'tracev3-binary', binary: true, entries: LP.winmacBinary.parseTracev3(buffer) };
        }

        var lines = textLines;

        // Найспецифічніші формати (власний заголовок/унікальні ключі) — першими.
        if (LP.iisFirewall.detect(lines)) return LP.iisFirewall.parse(lines);
        if (LP.weblog.detectAccess(lines)) return LP.weblog.parseAccess(lines);
        if (LP.weblog.detectError(lines)) return LP.weblog.parseError(lines);

        if (LP.proxylog.detectTraefik(lines)) return LP.proxylog.parseTraefik(lines);
        if (LP.cloudlog.detectAwsCloudTrail(lines)) return LP.cloudlog.parseAwsCloudTrail(lines);
        if (LP.cloudlog.detectAzureActivity(lines)) return LP.cloudlog.parseAzureActivity(lines);
        if (LP.cloudlog.detectGcpLogging(lines)) return LP.cloudlog.parseGcpLogging(lines);
        if (LP.dblog.detectMongo(lines)) return LP.dblog.parseMongo(lines);
        if (LP.jsonlog.detectDocker(lines)) return LP.jsonlog.parseDocker(lines);

        if (LP.k8s.detect(lines)) return LP.k8s.parse(lines);
        if (LP.javalog.detect(lines)) return LP.javalog.parse(lines);

        if (LP.dblog.detectMysqlSlow(lines)) return LP.dblog.parseMysqlSlow(lines);
        if (LP.dblog.detectMysqlError(lines)) return LP.dblog.parseMysqlError(lines);
        if (LP.dbserver2.detectMssql(lines)) return LP.dbserver2.parseMssql(lines);
        if (LP.dbserver2.detectOracle(lines)) return LP.dbserver2.parseOracle(lines);
        if (LP.dblog.detectPg(lines)) return LP.dblog.parsePg(lines);
        if (LP.dblog.detectRedis(lines)) return LP.dblog.parseRedis(lines);

        if (LP.proxylog.detectHaproxy(lines)) return LP.proxylog.parseHaproxy(lines);

        if (LP.netdevice.detectAsa(lines)) return LP.netdevice.parseAsa(lines);
        if (LP.netdevice.detectPfsense(lines)) return LP.netdevice.parsePfsense(lines);
        if (LP.netdevice.detectIptables(lines)) return LP.netdevice.parseIptables(lines);

        if (LP.mail.detect(lines)) return LP.mail.parse(lines);

        if (LP.syslog.detectDmesg(lines)) return LP.syslog.parseDmesg(lines);
        if (LP.syslog.detect(lines)) return LP.syslog.parse(lines);

        if (LP.jsonlog.detectNdjson(lines)) return LP.jsonlog.parseNdjson(lines);

        return LP.genericText.parse(lines);
    }

    function setReportVisible(show) {
        reportShown = show;
        logReportPane.classList.toggle('show', show);
        logRawPane.classList.toggle('hide', show);
        logReportBtn.textContent = show ? 'Лог' : 'Звіт';
    }

    function handleLogFile(file) {
        clearLogTerminal();
        clearLogReport();
        setReportVisible(false);
        logFileNameLabel.textContent = file.name;
        logReportBtn.disabled = true;
        currentLogFileInfo = null;
        currentLogDetected = null;

        printInfo('> завантаження лог-файлу: ' + file.name + ' (' + humanSize(file.size) + ')');

        file.arrayBuffer().then(function (buffer) {
            currentLogFileInfo = { name: file.name, size: humanSize(file.size) + ' (' + file.size + ' байт)' };

            var isBinaryCandidate = window.LogParsers.winmacBinary.detectEvtx(buffer) ||
                window.LogParsers.winmacBinary.detectSystemdJournal(buffer) ||
                window.LogParsers.winmacBinary.detectAsl(buffer);

            var textLines = [];
            if (!isBinaryCandidate) {
                var decoder = new TextDecoder('utf-8', { fatal: false });
                var text = decoder.decode(buffer);
                textLines = text.split(/\r\n|\r|\n/);
                if (textLines.length && textLines[textLines.length - 1] === '') textLines.pop();
            }

            var detected = detectAndParseLog(file, buffer, textLines);
            currentLogDetected = detected;

            if (detected.binary) {
                printInfo('> бінарний формат журналу розпізнано за сигнатурою.');
                Object.keys(detected.entries).forEach(function (k) {
                    printInfo('  ' + k + ' = ' + detected.entries[k]);
                });
            } else {
                printInfo('> рядків: ' + textLines.length + ', розпізнано записів: ' +
                    detected.entries.filter(function (e) { return e.parsed; }).length);
                printRawLines(textLines, detected.entries);
            }

            logReportBtn.disabled = false;
        }).catch(function (err) {
            printInfo('> помилка обробки файлу: ' + err.message);
        });
    }

    logReportBtn.addEventListener('click', function () {
        if (!currentLogFileInfo || !currentLogDetected) return;
        if (!reportShown) {
            clearLogReport();
            var html = window.LogReport.render(currentLogFileInfo, currentLogDetected);
            var div = document.createElement('div');
            div.innerHTML = html;
            logReportContent.appendChild(div);
        }
        setReportVisible(!reportShown);
    });

    logFileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) handleLogFile(e.target.files[0]);
    });

    logDropZone.addEventListener('click', function () { logFileInput.click(); });
    logDropZone.addEventListener('dragover', function (e) { e.preventDefault(); logDropZone.classList.add('dragover'); });
    logDropZone.addEventListener('dragleave', function () { logDropZone.classList.remove('dragover'); });
    logDropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        logDropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleLogFile(e.dataTransfer.files[0]);
    });
})();
