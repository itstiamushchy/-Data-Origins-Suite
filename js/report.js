// Витоки Даних — report.js
// Формує звіт прямо у вікні терміналу: зелений — значення з файлу, білий — пояснення людською мовою.
window.Report = (function () {
    'use strict';

    function esc(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function formatValue(key, value) {
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
        if (typeof value === 'boolean') return value ? 'так' : 'ні';
        if (value instanceof Uint8Array) return '[бінарні дані, ' + value.length + ' байт]';
        return String(value);
    }

    // Пропускаємо суто службові технічні поля без змістовної цінності для користувача.
    var SKIP_KEYS = { ExifIFDPointer: 1, GPSInfoIFDPointer: 1 };

    function render(fileInfo, metadata) {
        var lines = [];
        lines.push('<div class="report-block">');
        lines.push('<div class="report-header">══════ ЗВІТ ПО ФАЙЛУ ══════</div>');

        lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.name) + '</span> ' +
            '<span class="re">— назва файлу</span></div>');
        lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.size) + '</span> ' +
            '<span class="re">— розмір файлу</span></div>');
        lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.type) + '</span> ' +
            '<span class="re">— визначений формат (за сигнатурою файлу)</span></div>');
        if (fileInfo.mime) {
            lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.mime) + '</span> ' +
                '<span class="re">— MIME-тип за даними браузера (може відрізнятись від реального формату)</span></div>');
        }
        if (fileInfo.modified) {
            lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.modified) + '</span> ' +
                '<span class="re">— дата останньої зміни файлу (з файлової системи)</span></div>');
        }
        if (fileInfo.hash) {
            lines.push('<div class="report-row"><span class="rv">' + esc(fileInfo.hash) + '</span> ' +
                '<span class="re">— контрольна сума SHA-256 (для перевірки цілісності файлу)</span></div>');
        }
        if (fileInfo.nativeDim) {
            lines.push('<div class="report-row"><span class="rv">' + fileInfo.nativeDim.w + '×' + fileInfo.nativeDim.h + '</span> ' +
                '<span class="re">— фактичні розміри зображення (визначено нативним декодером браузера)</span></div>');
        }

        var keys = Object.keys(metadata).filter(function (k) { return !SKIP_KEYS[k]; });
        if (keys.length === 0) {
            lines.push('<div class="report-row"><span class="re">У файлі не знайдено розпізнаних метаданих.</span></div>');
        } else {
            lines.push('<div class="report-sep">────────────────────────────</div>');
            keys.forEach(function (key) {
                var label = Labels.label(key);
                var explain = Labels.explain(key);
                var val = formatValue(key, metadata[key]);
                lines.push('<div class="report-row">' +
                    '<span class="rl">' + esc(label) + ':</span> ' +
                    '<span class="rv">' + esc(val) + '</span><br>' +
                    '<span class="re">　' + esc(explain) + '</span></div>');
            });
        }
        lines.push('<div class="report-header">═══════════════════════════</div>');
        lines.push('</div>');
        return lines.join('\n');
    }

    return { render: render };
})();
