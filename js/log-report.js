// Витоки Даних — log-report.js
window.LogReport = (function () {
    'use strict';

    function esc(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function row(value, explain) {
        return '<div class="report-row"><span class="rv">' + esc(value) + '</span> <span class="re">— ' + esc(explain) + '</span></div>';
    }

    function kv(label, value) {
        return '<div class="report-row"><span class="rl">' + esc(label) + ':</span> <span class="rv">' + esc(value) + '</span></div>';
    }

    function countsTable(counts, title) {
        var keys = Object.keys(counts || {});
        if (!keys.length) return '';
        var out = '<div class="report-row"><span class="rl">' + esc(title) + ':</span></div>';
        keys.sort(function (a, b) { return counts[b] - counts[a]; });
        keys.forEach(function (k) {
            out += '<div class="report-row">　<span class="rv">' + esc(k || '(порожньо)') + '</span>: <span class="rv">' + counts[k] + '</span></div>';
        });
        return out;
    }

    var KIND_LABELS = {
        'web-access': 'Access-лог веб-сервера (Apache/Nginx)',
        'web-error': 'Error-лог веб-сервера (Apache/Nginx)',
        'syslog': 'Системний журнал Unix (syslog)',
        'dmesg': 'Журнал ядра (dmesg)',
        'mysql-error': 'MySQL — журнал помилок',
        'mysql-slow': 'MySQL — журнал повільних запитів',
        'postgresql': 'PostgreSQL — журнал сервера',
        'mongodb': 'MongoDB — журнал сервера',
        'redis': 'Redis — журнал сервера',
        'docker-json': 'Docker — журнал контейнера (json-file)',
        'ndjson': 'Структурований журнал (NDJSON)',
        'generic-text': 'Текстовий лог (загальний розбір)',
        'evtx-binary': 'Windows Event Log (.evtx, бінарний)',
        'systemd-journal-binary': 'systemd journal (бінарний)',
        'tracev3-binary': 'macOS Unified Log (.tracev3, бінарний)',
        'asl-binary': 'Apple System Log (ASL, бінарний)',
        'iis-access': 'IIS access-лог (W3C Extended Log Format)',
        'windows-firewall': 'Windows Firewall (pfirewall.log)',
        'w3c-extended': 'W3C Extended Log Format (загальний)',
        'mssql-errorlog': 'MS SQL Server — ERRORLOG',
        'oracle-alert': 'Oracle — alert log',
        'haproxy': 'HAProxy — access-лог',
        'traefik': 'Traefik — access-лог (JSON)',
        'k8s-cri': 'Kubernetes/containerd — CRI-лог пода',
        'java-log4j': 'Java/log4j — журнал застосунку',
        'mail-postfix': 'Поштовий сервер (Postfix/sendmail)',
        'cisco-asa': 'Cisco ASA — журнал міжмережевого екрана',
        'pfsense-filterlog': 'pfSense — filterlog',
        'iptables': 'iptables/netfilter — журнал ядра',
        'aws-cloudtrail': 'AWS CloudTrail (JSON)',
        'azure-activity': 'Azure Activity Log (JSON)',
        'gcp-logging': 'GCP Cloud Logging (JSON)'
    };

    function render(fileInfo, detected) {
        var lines = [];
        lines.push('<div class="report-block">');
        lines.push('<div class="report-header">══════ ЗВІТ ПО ЛОГ-ФАЙЛУ ══════</div>');
        lines.push(row(fileInfo.name, 'назва файлу'));
        lines.push(row(fileInfo.size, 'розмір файлу'));
        lines.push(row(KIND_LABELS[detected.kind] || detected.kind, 'визначений тип журналу (за патерном вмісту)'));
        lines.push('<div class="report-sep">────────────────────────────</div>');

        if (detected.binary) {
            Object.keys(detected.entries).forEach(function (k) {
                lines.push(kv(k, detected.entries[k]));
            });
            lines.push('<div class="report-header">═══════════════════════════</div>');
            lines.push('</div>');
            return lines.join('\n');
        }

        var total = detected.entries.length;
        var parsedCount = detected.entries.filter(function (e) { return e.parsed; }).length;
        lines.push(row(total, 'усього рядків у файлі'));
        lines.push(row(parsedCount, 'розпізнано як структуровані записи'));

        if (detected.firstTime || detected.lastTime) {
            lines.push(kv('Період', (detected.firstTime || '?') + ' … ' + (detected.lastTime || '?')));
        } else {
            var times = detected.entries.map(function (e) { return e.time; }).filter(Boolean);
            if (times.length) lines.push(kv('Період', times[0] + ' … ' + times[times.length - 1]));
        }

        lines.push(countsTable(detected.statusCounts, 'Розподіл за HTTP-статусами'));
        lines.push(countsTable(detected.methodCounts, 'Розподіл за HTTP-методами'));
        lines.push(countsTable(detected.levelCounts, 'Розподіл за рівнями журналювання'));
        lines.push(countsTable(detected.severityCounts, 'Розподіл за рівнями серйозності'));
        lines.push(countsTable(detected.streamCounts, 'Розподіл за потоками (stdout/stderr)'));
        lines.push(countsTable(detected.roleCounts, 'Розподіл за роллю процесу Redis'));
        lines.push(countsTable(detected.actionCounts, 'Розподіл за діями (allow/deny тощо)'));

        if (detected.ips) {
            var ipKeys = Object.keys(detected.ips);
            if (ipKeys.length) {
                ipKeys.sort(function (a, b) { return detected.ips[b] - detected.ips[a]; });
                lines.push('<div class="report-row"><span class="rl">Найактивніші IP-адреси:</span></div>');
                ipKeys.slice(0, 10).forEach(function (ip) {
                    lines.push('<div class="report-row">　<span class="rv">' + esc(ip) + '</span>: <span class="rv">' + detected.ips[ip] + ' запитів</span></div>');
                });
            }
        }

        if (detected.authEvents && detected.authEvents.length) {
            lines.push('<div class="report-sep">────────────────────────────</div>');
            lines.push('<div class="report-row"><span class="rl">Події автентифікації:</span> <span class="re">— спроби входу, sudo, відкриття/закриття сеансів</span></div>');
            detected.authEvents.slice(0, 50).forEach(function (ev) {
                lines.push('<div class="report-row">　<span class="rv">' + esc(ev.time || '') + ' ' + esc(ev.host || '') + ' ' + esc(ev.app || '') + '</span> ' +
                    '<span class="re">— ' + esc(ev.event) + '</span></div>');
            });
            if (detected.authEvents.length > 50) lines.push(row('… ще ' + (detected.authEvents.length - 50), 'подій не показано (ліміт звіту)'));
        }

        if (detected.mailEvents && detected.mailEvents.length) {
            lines.push('<div class="report-sep">────────────────────────────</div>');
            lines.push('<div class="report-row"><span class="rl">Поштові події:</span> <span class="re">— доставка, відмови, з\u2019єднання</span></div>');
            detected.mailEvents.slice(0, 50).forEach(function (ev) {
                lines.push('<div class="report-row">　<span class="rv">' + esc(ev.time || '') + ' ' + esc(ev.app || '') + '</span> ' +
                    '<span class="re">— ' + esc(ev.event) + '</span></div>');
            });
            if (detected.mailEvents.length > 50) lines.push(row('… ще ' + (detected.mailEvents.length - 50), 'подій не показано (ліміт звіту)'));
        }

        if (detected.kind === 'mysql-slow' && detected.entries.length) {
            lines.push('<div class="report-sep">────────────────────────────</div>');
            lines.push('<div class="report-row"><span class="rl">Повільні запити:</span></div>');
            detected.entries.slice(0, 30).forEach(function (e) {
                lines.push('<div class="report-row">　<span class="rv">' + esc(e.time || '') + '</span> <span class="re">— час виконання: ' + esc(e.queryTime || '?') + ' с, рядків опрацьовано: ' + esc(e.rowsExamined || '?') + '</span></div>');
            });
        }

        // Найпомітніші "негативні" події: ERROR/CRITICAL/FATAL рівнів
        var bad = detected.entries.filter(function (e) {
            var lvl = (e.level || e.severity || '').toString().toUpperCase();
            return /ERROR|CRIT|FATAL|EMERG|E$/.test(lvl);
        });
        if (bad.length) {
            lines.push('<div class="report-sep">────────────────────────────</div>');
            lines.push('<div class="report-row"><span class="rl">Помітні помилки (' + bad.length + '):</span></div>');
            bad.slice(0, 50).forEach(function (e) {
                lines.push('<div class="report-row">　<span class="rv">' + esc(e.time || '') + '</span> <span class="re">— ' + esc(e.msg || e.raw) + '</span></div>');
            });
            if (bad.length > 50) lines.push(row('… ще ' + (bad.length - 50), 'помилок не показано (ліміт звіту)'));
        }

        if (total === 0) {
            lines.push(row('порожній файл', 'записів для аналізу не знайдено'));
        } else if (parsedCount === 0) {
            lines.push(row('формат не розпізнано рядково', 'показано лише загальну статистику; структура записів невідома'));
        }

        lines.push('<div class="report-header">═══════════════════════════</div>');
        lines.push('</div>');
        return lines.join('\n');
    }

    return { render: render };
})();
