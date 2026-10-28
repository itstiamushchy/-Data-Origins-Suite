// Витоки Даних — meta-add/mp3id3.js
// Додає кастомний TXXX-фрейм ID3v2.3 (опис "vytoky:added"). Якщо тег ID3v2
// вже є — дописує фрейм перед зоною padding (не чіпаючи наявні фрейми),
// якщо тегу немає — створює мінімальний новий і додає його на початок файлу
// (аудіодані залишаються без змін).
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    // ID3v2.3 знає лише кодування 0x00 (ISO-8859-1) або 0x01 (UTF-16+BOM) —
    // UTF-8 (0x03) з'явився тільки в ID3v2.4, тому для кирилиці обов'язково UTF-16.
    function utf16leWithBom(str) {
        var out = new Uint8Array(2 + str.length * 2);
        out[0] = 0xFF; out[1] = 0xFE;
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            out[2 + i * 2] = code & 0xFF;
            out[3 + i * 2] = (code >> 8) & 0xFF;
        }
        return out;
    }

    function buildTxxxFrame(value) {
        var desc = utf16leWithBom('vytoky:added');
        var val = utf16leWithBom(value);
        var body = window.MetaAddCommon.concatBytes([
            new Uint8Array([0x01]), // encoding: UTF-16 з BOM
            desc, new Uint8Array([0x00, 0x00]), // роздільник полів — подвійний нуль у UTF-16
            val
        ]);
        var header = new Uint8Array(10);
        header.set(new TextEncoder().encode('TXXX'), 0);
        new DataView(header.buffer).setUint32(4, body.length, false); // ID3v2.3: розмір фрейму НЕ syncsafe
        header[8] = 0; header[9] = 0; // flags
        return window.MetaAddCommon.concatBytes([header, body]);
    }

    // Знаходить межу "реальних" фреймів усередині тіла тегу (до нульового padding).
    function realFramesLength(body) {
        var p = 0;
        while (p + 10 <= body.length) {
            if (body[p] === 0) break; // ID фрейму не може починатись з 0x00 — почався padding
            var size = new DataView(body.buffer, body.byteOffset).getUint32(p + 4, false);
            var next = p + 10 + size;
            if (size < 0 || next > body.length) break; // підозрілий/пошкоджений фрейм — зупиняємось тут
            p = next;
        }
        return p;
    }

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        var value = window.MetaAddCommon.buildAddedValue(comment);
        var frame = buildTxxxFrame(value);

        var hasId3 = bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33; // "ID3"
        if (!hasId3) {
            var size = window.MetaAddCommon.encodeSyncsafe32(frame.length);
            var header = new Uint8Array(10);
            header.set(new TextEncoder().encode('ID3'), 0);
            header[3] = 3; header[4] = 0; // версія 2.3.0
            header[5] = 0; // flags
            header.set(size, 6);
            var out1 = window.MetaAddCommon.concatBytes([header, frame, bytes]);
            return { ok: true, data: out1 };
        }

        var tagSize = window.MetaAddCommon.decodeSyncsafe32(bytes, 6);
        var bodyStart = 10;
        var bodyEnd = bodyStart + tagSize;
        if (bodyEnd > bytes.length) return { ok: false, reason: 'Некоректний розмір наявного ID3v2-тегу — файл, ймовірно, пошкоджений.' };
        var body = bytes.subarray(bodyStart, bodyEnd);

        var realLen = realFramesLength(body);
        var newBody = window.MetaAddCommon.concatBytes([body.subarray(0, realLen), frame]);
        var newSize = window.MetaAddCommon.encodeSyncsafe32(newBody.length);

        var newHeader = bytes.slice(0, 10);
        newHeader.set(newSize, 6);

        var out2 = window.MetaAddCommon.concatBytes([newHeader, newBody, bytes.subarray(bodyEnd)]);
        return { ok: true, data: out2 };
    }

    window.MetaAddWriters.mp3id3 = write;
})();
