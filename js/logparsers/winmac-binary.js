// Витоки Даних — logparsers/winmac-binary.js
// Бінарні, пропрієтарні формати журналів: розпізнаємо за сигнатурою та
// витягуємо базові поля заголовка; повний посторінковий розбір запису
// такі формати не передбачають у цьому браузерному застосунку (складна
// закрита бінарна структура) — аналогічно до інших пропрієтарних
// бінарних форматів у проєкті (RAR, PSD тощо).
window.LogParsers = window.LogParsers || {};

(function () {
    'use strict';

    function bytesToStr(buffer, start, len) {
        var u8 = new Uint8Array(buffer, start, len);
        var s = '';
        for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return s;
    }

    function readU32LE(dv, off) { return dv.getUint32(off, true); }
    function readU64LE(dv, off) { return dv.getBigUint64(off, true); }

    // --- Windows Event Log (.evtx) ---
    function detectEvtx(buffer) {
        if (buffer.byteLength < 8) return false;
        return bytesToStr(buffer, 0, 8) === 'ElfFile\u0000';
    }
    function parseEvtx(buffer) {
        var dv = new DataView(buffer);
        var info = { 'EVTX:Signature': 'ElfFile\\0' };
        try {
            info['EVTX:FirstChunkNumber'] = String(readU64LE(dv, 8));
            info['EVTX:LastChunkNumber'] = String(readU64LE(dv, 16));
            info['EVTX:NextRecordId'] = String(readU64LE(dv, 24));
            info['EVTX:HeaderSize'] = String(readU32LE(dv, 32));
            info['EVTX:MinorVersion'] = String(dv.getUint16(36, true));
            info['EVTX:MajorVersion'] = String(dv.getUint16(38, true));
        } catch (e) {}
        info['EVTX:Note'] = 'Бінарний журнал подій Windows. Закрита посторінкова структура (chunks/records) не розбирається повністю в браузері — підтверджено сигнатуру та заголовок файлу.';
        return info;
    }

    // --- systemd journal (бінарний .journal) ---
    function detectSystemdJournal(buffer) {
        if (buffer.byteLength < 8) return false;
        return bytesToStr(buffer, 0, 8) === 'LPKSHHRH';
    }
    function parseSystemdJournal(buffer) {
        var info = { 'Journal:Signature': 'LPKSHHRH' };
        info['Journal:Note'] = 'Бінарний журнал systemd-journald. Внутрішня структура (хеш-таблиці, об\u2019єкти записів) закрита й не розбирається повністю в браузері — підтверджено лише сигнатуру файлу. Для читання вмісту використовуйте journalctl --file=<файл>.';
        return info;
    }

    // --- macOS Unified Log (.tracev3) ---
    function detectTracev3(buffer, ext) {
        if (ext === 'tracev3') return true;
        if (buffer.byteLength < 4) return false;
        var dv = new DataView(buffer);
        // Chunk Header Tag 0x00001000 (Header chunk) у перших байтах файлу
        return dv.getUint32(0, true) === 0x00001000;
    }
    function parseTracev3(buffer) {
        var info = { 'TraceV3:ChunkTag': '0x1000 (Header)' };
        info['TraceV3:Note'] = 'Бінарний «єдиний журнал» macOS (Unified Logging). Формат закритий і не документований Apple офіційно — у браузері підтверджується лише сигнатура заголовкового чанка.';
        return info;
    }

    // --- Apple System Log (ASL) ---
    function detectAsl(buffer) {
        if (buffer.byteLength < 12) return false;
        return bytesToStr(buffer, 0, 7) === 'ASL DB\u0000';
    }
    function parseAsl(buffer) {
        var dv = new DataView(buffer);
        var info = { 'ASL:Signature': 'ASL DB\\0' };
        try { info['ASL:Version'] = String(dv.getUint32(8, true)); } catch (e) {}
        info['ASL:Note'] = 'Бінарна база Apple System Log. Записи зберігаються у власному бінарному форматі Apple — підтверджено сигнатуру файлу.';
        return info;
    }

    window.LogParsers.winmacBinary = {
        detectEvtx: detectEvtx, parseEvtx: parseEvtx,
        detectSystemdJournal: detectSystemdJournal, parseSystemdJournal: parseSystemdJournal,
        detectTracev3: detectTracev3, parseTracev3: parseTracev3,
        detectAsl: detectAsl, parseAsl: parseAsl
    };
})();
