// Витоки Даних — meta-add/svgxml.js
// Додає XML/HTML-коментар <!-- vytoky:added ... --> одразу після XML-декларації
// (якщо є) або на самому початку файлу. Коментарі валідні в будь-якому місці
// поза тегами, тому вставка нічого не ламає.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function write(buffer, comment) {
        var text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
        catch (e) { return { ok: false, reason: 'Файл не є текстом у кодуванні UTF-8 — безпечна вставка неможлива.' }; }

        var added = window.MetaAddCommon.buildAddedValue(comment).replace(/--/g, '\u2013\u2013');
        var commentBlock = '<!-- vytoky:added ' + added + ' -->\n';

        var xmlDeclMatch = /^\s*<\?xml[^?]*\?>\s*\r?\n?/.exec(text);
        var out;
        if (xmlDeclMatch) {
            out = text.slice(0, xmlDeclMatch[0].length) + commentBlock + text.slice(xmlDeclMatch[0].length);
        } else {
            out = commentBlock + text;
        }

        var bytes = new TextEncoder().encode(out);
        return { ok: true, data: bytes };
    }

    window.MetaAddWriters.svgxml = write;
})();
