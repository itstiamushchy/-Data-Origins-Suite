// Витоки Даних — meta-add/pdf.js
// Стандартний механізм PDF incremental update: оригінальні байти файлу не
// чіпаються взагалі, у кінець дописується нова ревізія з оновленим /Info
// (усі наявні ключі зберігаються, додається лише один новий) та новий xref
// і trailer. Підтримується лише класична (таблична) xref-структура —
// cross-reference streams (PDF 1.5+ компактний формат) свідомо НЕ
// обробляються, щоб не ризикнути пошкодити файл.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function bytesToLatin1(bytes) {
        var CHUNK = 8192, out = '';
        for (var i = 0; i < bytes.length; i += CHUNK) {
            out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
        }
        return out;
    }
    function latin1ToBytes(str) {
        var out = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
        return out;
    }

    // Знаходить індекс символу '>' завершального '>>' на глибині 0, починаючи з позиції
    // одразу ПІСЛЯ відкриваючого '<<'. Повертає позицію першого '>' пари, або -1.
    function findDictEnd(str, startAfterOpen) {
        var depth = 1, i = startAfterOpen;
        while (i < str.length) {
            var c = str[i];
            if (c === '(') { // рядок-літерал: пропускаємо до незекранованої ')'
                var d = 1; i++;
                while (i < str.length && d > 0) {
                    if (str[i] === '\\') { i += 2; continue; }
                    if (str[i] === '(') d++;
                    else if (str[i] === ')') d--;
                    i++;
                }
                continue;
            }
            if (c === '<' && str[i + 1] !== '<') { // hex-рядок
                var end = str.indexOf('>', i + 1);
                i = end < 0 ? str.length : end + 1;
                continue;
            }
            if (c === '<' && str[i + 1] === '<') { depth++; i += 2; continue; }
            if (c === '>' && str[i + 1] === '>') {
                depth--;
                if (depth === 0) return i;
                i += 2; continue;
            }
            i++;
        }
        return -1;
    }

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        var text = bytesToLatin1(bytes);

        var lastStartxref = text.lastIndexOf('startxref');
        if (lastStartxref < 0) return { ok: false, reason: 'Не знайдено startxref — файл не є стандартним PDF або вже пошкоджений.' };
        var m = /startxref\s+(\d+)/.exec(text.slice(lastStartxref));
        if (!m) return { ok: false, reason: 'Не вдалося прочитати зсув xref (startxref) у PDF.' };
        var prevXrefOffset = parseInt(m[1], 10);
        if (prevXrefOffset < 0 || prevXrefOffset >= text.length) return { ok: false, reason: 'Зсув startxref виходить за межі файлу — PDF пошкоджений.' };

        if (text.slice(prevXrefOffset, prevXrefOffset + 4) !== 'xref') {
            return { ok: false, reason: 'Використано компактний cross-reference stream (PDF 1.5+) — такий формат свідомо не підтримується для безпечного додавання.' };
        }

        var trailerPos = text.indexOf('trailer', prevXrefOffset);
        if (trailerPos < 0) return { ok: false, reason: 'Не знайдено секцію trailer — безпечне оновлення неможливе.' };
        var dictOpen = text.indexOf('<<', trailerPos);
        if (dictOpen < 0) return { ok: false, reason: 'Некоректна структура trailer.' };
        var dictEnd = findDictEnd(text, dictOpen + 2);
        if (dictEnd < 0) return { ok: false, reason: 'Не вдалося розібрати словник trailer (незбалансовані << >>).' };
        var trailerDict = text.slice(dictOpen, dictEnd + 2);

        var rootM = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailerDict);
        var sizeM = /\/Size\s+(\d+)/.exec(trailerDict);
        var infoM = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(trailerDict);
        if (!rootM || !sizeM) return { ok: false, reason: 'У trailer відсутні обов\u2019язкові ключі /Root або /Size.' };

        var value = window.MetaAddCommon.buildAddedValue(comment);
        // PDF literal-рядки "(...)" підтримують лише PDFDocEncoding/Latin-1, тому для
        // коректної кирилиці та інших Unicode-символів кодуємо як UTF-16BE hex-рядок з BOM.
        var escVal = '<FEFF' + Array.prototype.map.call(value, function (ch) {
            var code = ch.charCodeAt(0);
            return ('0000' + code.toString(16)).slice(-4);
        }).join('') + '>';

        var appendParts = [];
        var curOffset = bytes.length; // зсуви рахуємо від кінця ОРИГІНАЛЬНОГО файлу

        var infoObjNum, infoGen, newSize = parseInt(sizeM[1], 10);

        if (infoM) {
            infoObjNum = infoM[1]; infoGen = infoM[2];
            var objPattern = new RegExp('(^|[\\r\\n])' + infoObjNum + '\\s+' + infoGen + '\\s+obj\\b');
            var objMatch = objPattern.exec(text);
            if (!objMatch) return { ok: false, reason: 'Не знайдено об\u2019єкт /Info (' + infoObjNum + ' ' + infoGen + ' obj) у файлі.' };
            var objStart = objMatch.index + objMatch[0].length;
            var infoDictOpen = text.indexOf('<<', objStart);
            if (infoDictOpen < 0 || infoDictOpen - objStart > 20) return { ok: false, reason: 'Об\u2019єкт /Info не є простим словником — безпечна вставка неможлива.' };
            var infoDictEnd = findDictEnd(text, infoDictOpen + 2);
            if (infoDictEnd < 0) return { ok: false, reason: 'Не вдалося розібрати словник об\u2019єкта /Info.' };
            var innerContent = text.slice(infoDictOpen + 2, infoDictEnd);
            var newInfoDict = '<<' + innerContent + ' /VytokyAdded ' + escVal + '>>';
            var objText = '\n' + infoObjNum + ' ' + infoGen + ' obj\n' + newInfoDict + '\nendobj\n';
            appendParts.push({ text: objText, objNum: infoObjNum, gen: infoGen });
        } else {
            infoObjNum = String(newSize); infoGen = '0';
            newSize = newSize + 1;
            var newInfoDict2 = '<< /VytokyAdded ' + escVal + '>>';
            var objText2 = '\n' + infoObjNum + ' ' + infoGen + ' obj\n' + newInfoDict2 + '\nendobj\n';
            appendParts.push({ text: objText2, objNum: infoObjNum, gen: infoGen });
        }

        // Збираємо байти, що дописуються, рахуючи точний зсув кожного нового об'єкта.
        var appendStr = '';
        var objOffset = -1;
        appendParts.forEach(function (part) {
            objOffset = bytes.length + appendStr.length + part.text.indexOf('\n' + part.objNum + ' ' + part.gen + ' obj') + 1;
            appendStr += part.text;
        });

        var xrefOffset = bytes.length + appendStr.length;
        var offsetStr = String(objOffset);
        while (offsetStr.length < 10) offsetStr = '0' + offsetStr;
        var genStr = String(parseInt(infoGen, 10));
        while (genStr.length < 5) genStr = '0' + genStr;

        appendStr += 'xref\n' + infoObjNum + ' 1\n' + offsetStr + ' ' + genStr + ' n \n';
        appendStr += 'trailer\n<< /Size ' + newSize + ' /Root ' + rootM[1] + ' ' + rootM[2] + ' R /Info ' +
            infoObjNum + ' ' + infoGen + ' R /Prev ' + prevXrefOffset + ' >>\n';
        appendStr += 'startxref\n' + xrefOffset + '\n%%EOF\n';

        var out = window.MetaAddCommon.concatBytes([bytes, latin1ToBytes(appendStr)]);
        return { ok: true, data: out };
    }

    window.MetaAddWriters.pdf = write;
})();
