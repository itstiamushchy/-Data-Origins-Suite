// Витоки Даних — meta-add/ooxml.js
// Додає власну custom-властивість у docProps/custom.xml (docx/xlsx/pptx).
// Якщо частини ще немає — створює її і коректно реєструє в
// [Content_Types].xml та _rels/.rels (все через ZipWriter, без перестискання
// й без видалення жодного наявного запису).
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    var CUSTOM_PATH = 'docProps/custom.xml';
    var REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';
    var CT_TYPE = 'application/vnd.openxmlformats-officedocument.custom-properties+xml';

    function enc(str) { return new TextEncoder().encode(str); }
    function dec(bytes) { return new TextDecoder('utf-8').decode(bytes); }

    function write(buffer, comment) {
        var entries = window.ZipReader.listEntries(buffer);
        if (!entries) return Promise.resolve({ ok: false, reason: 'Не є коректним ZIP-контейнером (OOXML) — сигнатура PK не знайдена.' });

        var value = window.MetaAddCommon.buildAddedValue(comment);
        var hasCustom = entries.some(function (e) { return e.name === CUSTOM_PATH; });

        if (hasCustom) {
            return window.ZipReader.extractByName(buffer, entries, CUSTOM_PATH).then(function (bytes) {
                if (!bytes) return { ok: false, reason: 'Не вдалося прочитати наявний docProps/custom.xml (метод стиснення не підтримується браузером).' };
                var xml = dec(bytes);
                var pidMatches = xml.match(/pid="(\d+)"/g) || [];
                var maxPid = pidMatches.reduce(function (m, s) {
                    var n = parseInt(s.match(/\d+/)[0], 10);
                    return Math.max(m, n);
                }, 1);
                var prop = '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="' + (maxPid + 1) + '" name="vytoky:added"><vt:lpwstr>' +
                    window.MetaAddCommon.escapeXml(value) + '</vt:lpwstr></property>';
                var closeTag = '</Properties>';
                var idx = xml.lastIndexOf(closeTag);
                if (idx < 0) return { ok: false, reason: 'Нестандартна структура docProps/custom.xml — безпечна вставка неможлива.' };
                var newXml = xml.slice(0, idx) + prop + xml.slice(idx);
                var out = window.ZipWriter.addOrReplaceEntries(buffer, { 'docProps/custom.xml': enc(newXml) });
                return { ok: true, data: out };
            });
        }

        // Частини ще немає — створюємо custom.xml + реєструємо в Content_Types і _rels/.rels
        return Promise.all([
            window.ZipReader.extractByName(buffer, entries, '[Content_Types].xml'),
            window.ZipReader.extractByName(buffer, entries, '_rels/.rels')
        ]).then(function (res) {
            var ctBytes = res[0], relsBytes = res[1];
            if (!ctBytes || !relsBytes) return { ok: false, reason: 'Відсутні обов\u2019язкові частини [Content_Types].xml або _rels/.rels — файл не є валідним OOXML.' };

            var ctXml = dec(ctBytes);
            var relsXml = dec(relsBytes);

            var newCustomXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
                '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ' +
                'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
                '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="vytoky:added">' +
                '<vt:lpwstr>' + window.MetaAddCommon.escapeXml(value) + '</vt:lpwstr></property></Properties>';

            var ctIdx = ctXml.lastIndexOf('</Types>');
            if (ctIdx < 0) return { ok: false, reason: 'Нестандартна структура [Content_Types].xml — безпечна вставка неможлива.' };
            var newCtXml = ctXml.indexOf(CUSTOM_PATH) > -1 ? ctXml :
                ctXml.slice(0, ctIdx) + '<Override PartName="/' + CUSTOM_PATH + '" ContentType="' + CT_TYPE + '"/>' + ctXml.slice(ctIdx);

            var relsIdx = relsXml.lastIndexOf('</Relationships>');
            if (relsIdx < 0) return { ok: false, reason: 'Нестандартна структура _rels/.rels — безпечна вставка неможлива.' };
            var relId = 'rIdVytokyCustom';
            var newRelsXml = relsXml.indexOf(relId) > -1 ? relsXml :
                relsXml.slice(0, relsIdx) + '<Relationship Id="' + relId + '" Type="' + REL_TYPE + '" Target="' + CUSTOM_PATH + '"/>' + relsXml.slice(relsIdx);

            var out = window.ZipWriter.addOrReplaceEntries(buffer, {
                'docProps/custom.xml': enc(newCustomXml),
                '[Content_Types].xml': enc(newCtXml),
                '_rels/.rels': enc(newRelsXml)
            });
            return { ok: true, data: out };
        });
    }

    window.MetaAddWriters.ooxml = write;
})();
