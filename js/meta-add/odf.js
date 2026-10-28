// Витоки Даних — meta-add/odf.js
// Додає <meta:user-defined meta:name="vytoky:added"> у наявний meta.xml.
// meta.xml — стандартна частина ODF, вже зареєстрована в manifest.xml,
// тому додаткових змін маніфесту не потрібно.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function enc(str) { return new TextEncoder().encode(str); }
    function dec(bytes) { return new TextDecoder('utf-8').decode(bytes); }

    function write(buffer, comment) {
        var entries = window.ZipReader.listEntries(buffer);
        if (!entries) return Promise.resolve({ ok: false, reason: 'Не є коректним ZIP-контейнером (ODF) — сигнатура PK не знайдена.' });
        if (!entries.some(function (e) { return e.name === 'meta.xml'; })) {
            return Promise.resolve({ ok: false, reason: 'У файлі відсутній meta.xml — нестандартний ODF, безпечна вставка неможлива.' });
        }

        return window.ZipReader.extractByName(buffer, entries, 'meta.xml').then(function (bytes) {
            if (!bytes) return { ok: false, reason: 'Не вдалося прочитати meta.xml (метод стиснення не підтримується браузером).' };
            var xml = dec(bytes);
            var value = window.MetaAddCommon.buildAddedValue(comment);
            var entry = '<meta:user-defined meta:name="vytoky:added" meta:value-type="string">' +
                window.MetaAddCommon.escapeXml(value) + '</meta:user-defined>';

            var closeTag = '</office:meta>';
            var idx = xml.lastIndexOf(closeTag);
            if (idx < 0) return { ok: false, reason: 'Нестандартна структура meta.xml (відсутній </office:meta>) — безпечна вставка неможлива.' };
            var newXml = xml.slice(0, idx) + entry + xml.slice(idx);

            var out = window.ZipWriter.addOrReplaceEntries(buffer, { 'meta.xml': enc(newXml) });
            return { ok: true, data: out };
        });
    }

    window.MetaAddWriters.odf = write;
})();
