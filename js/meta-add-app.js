// Витоки Даних — meta-add-app.js
(function () {
    'use strict';

    var tabAddBtn = document.getElementById('tabAddBtn');
    var viewAdd = document.getElementById('viewAdd');
    var tabMetaBtn = document.getElementById('tabMetaBtn');
    var tabLogsBtn = document.getElementById('tabLogsBtn');
    var viewMeta = document.getElementById('viewMeta');
    var viewLogs = document.getElementById('viewLogs');

    tabAddBtn.addEventListener('click', function () {
        tabMetaBtn.classList.remove('active');
        tabLogsBtn.classList.remove('active');
        tabAddBtn.classList.add('active');
        viewMeta.classList.remove('active');
        viewLogs.classList.remove('active');
        viewAdd.classList.add('active');
    });
    // Клік по інших вкладках знімає активність із цієї (log-app.js вже керує meta/logs між собою).
    [tabMetaBtn, tabLogsBtn].forEach(function (btn) {
        btn.addEventListener('click', function () { tabAddBtn.classList.remove('active'); viewAdd.classList.remove('active'); });
    });

    var addFileInput = document.getElementById('addFileInput');
    var addDropZone = document.getElementById('addDropZone');
    var addFileNameLabel = document.getElementById('addFileNameLabel');
    var addCommentInput = document.getElementById('addCommentInput');
    var addSubmitBtn = document.getElementById('addSubmitBtn');
    var addTerminalContent = document.getElementById('addTerminalContent');

    var currentFile = null;

    function clearAddTerminal() { addTerminalContent.innerHTML = ''; }
    function printAdd(text, cls) {
        var div = document.createElement('div');
        div.className = cls || 'log-line-ok';
        div.textContent = text;
        addTerminalContent.appendChild(div);
    }

    function asciiAt(bytes, off, len) {
        var s = '';
        for (var i = 0; i < len && off + i < bytes.length; i++) s += String.fromCharCode(bytes[off + i]);
        return s;
    }

    // Повертає {key, label} обраного безпечного writer'а, або null якщо формат не входить до Пакету 1.
    function detectWriter(file, bytes, ext) {
        if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            return { key: 'png', label: 'PNG (iTXt-чанк)' };
        }
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
            return { key: 'jpeg', label: 'JPEG (COM-сегмент)' };
        }
        if (asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a') {
            return { key: 'gif', label: 'GIF (Comment Extension)' };
        }
        if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
            return { key: 'webp', label: 'WebP (власний RIFF-чанк)' };
        }
        if (asciiAt(bytes, 0, 4) === '%PDF') {
            return { key: 'pdf', label: 'PDF (інкрементальне оновлення /Info)' };
        }
        if (asciiAt(bytes, 0, 3) === 'ID3' || (ext === 'mp3' && bytes.length > 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
            return { key: 'mp3id3', label: 'MP3 (ID3v2 TXXX-фрейм)' };
        }
        if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
            var entries = window.ZipReader.listEntries(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            if (entries) {
                if (entries.some(function (e) { return e.name === '[Content_Types].xml'; })) {
                    return { key: 'ooxml', label: 'OOXML docx/xlsx/pptx (docProps/custom.xml)' };
                }
                if (entries.some(function (e) { return e.name === 'mimetype'; })) {
                    return { key: 'odf', label: 'ODF odt/ods/odp (meta.xml)' };
                }
            }
            return { key: 'zipcomment', label: 'ZIP (коментар архіву)' };
        }
        // Текстові XML/SVG/HTML — перевіряємо декодування та ознаки розмітки.
        try {
            var text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
            var trimmed = text.replace(/^\uFEFF/, '').trim();
            if (trimmed.indexOf('<') === 0 || ['xml', 'svg', 'html', 'htm'].indexOf(ext) > -1) {
                return { key: 'svgxml', label: 'XML/SVG/HTML (коментар vytoky:added)' };
            }
        } catch (e) { /* не UTF-8 текст — не підпадає під жоден безпечний writer */ }

        return null;
    }

    function humanSize(b) {
        if (b < 1024) return b + ' Б';
        var u = ['КБ', 'МБ', 'ГБ']; var v = b;
        for (var i = 0; i < u.length; i++) { v /= 1024; if (v < 1024 || i === u.length - 1) return v.toFixed(2) + ' ' + u[i]; }
    }

    function handleFile(file) {
        currentFile = file;
        addFileNameLabel.textContent = file.name;
        clearAddTerminal();
        printAdd('> файл обрано: ' + file.name + ' (' + humanSize(file.size) + ')');
        addSubmitBtn.disabled = false;
    }

    addSubmitBtn.addEventListener('click', function () {
        if (!currentFile) return;
        addSubmitBtn.disabled = true;
        clearAddTerminal();
        var comment = addCommentInput.value || '';
        printAdd('> аналіз файлу: ' + currentFile.name);

        currentFile.arrayBuffer().then(function (buffer) {
            var bytes = new Uint8Array(buffer);
            var ext = (currentFile.name.toLowerCase().split('.').pop() || '');
            var writer = detectWriter(currentFile, bytes, ext);

            if (!writer) {
                printAdd('> формат не входить до переліку безпечного додавання (Пакет 1).', 'log-line-error');
                printAdd('  Підтримуються: PNG, JPEG, GIF, WebP, SVG/XML/HTML, PDF, MP3, OOXML (docx/xlsx/pptx), ODF (odt/ods/odp), ZIP.', 'log-line-muted');
                addSubmitBtn.disabled = false;
                return;
            }

            printAdd('> визначено формат: ' + writer.label);
            var fn = window.MetaAddWriters[writer.key];
            Promise.resolve(fn(buffer, comment)).then(function (res) {
                if (!res.ok) {
                    printAdd('> відмовлено: ' + res.reason, 'log-line-error');
                    printAdd('  Файл НЕ змінено — оригінал залишається недоторканим.', 'log-line-muted');
                    addSubmitBtn.disabled = false;
                    return;
                }
                var outName = window.MetaAddCommon.outputFileName(currentFile.name);
                printAdd('> метадані додано успішно.');
                printAdd('> вихідний файл: ' + outName + ' (' + humanSize(res.data.length) + ', було ' + humanSize(currentFile.size) + ')');
                window.MetaAddCommon.downloadBytes(res.data, outName);
                addSubmitBtn.disabled = false;
            }).catch(function (err) {
                printAdd('> помилка обробки: ' + err.message, 'log-line-error');
                addSubmitBtn.disabled = false;
            });
        });
    });

    addFileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    addDropZone.addEventListener('click', function () { addFileInput.click(); });
    addDropZone.addEventListener('dragover', function (e) { e.preventDefault(); addDropZone.classList.add('dragover'); });
    addDropZone.addEventListener('dragleave', function () { addDropZone.classList.remove('dragover'); });
    addDropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        addDropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
})();
