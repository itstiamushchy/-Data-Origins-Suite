// Витоки Даних — app.js
(function () {
    'use strict';

    var fileInput = document.getElementById('fileInput');
    var dropZone = document.getElementById('dropZone');
    var terminalContent = document.getElementById('terminalContent');
    var reportBtn = document.getElementById('reportBtn');
    var fileNameLabel = document.getElementById('fileNameLabel');

    var currentFileInfo = null;
    var currentMetadata = null;

    function sha256Hex(file) {
        return new Promise(function (resolve) {
            if (!(window.crypto && window.crypto.subtle) || file.size > 100 * 1024 * 1024) { resolve(null); return; }
            file.arrayBuffer().then(function (buf) { return window.crypto.subtle.digest('SHA-256', buf); })
                .then(function (hashBuf) {
                    var bytes = Array.from(new Uint8Array(hashBuf));
                    resolve(bytes.map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''));
                }).catch(function () { resolve(null); });
        });
    }

    function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

    // Резервне визначення розмірів зображення через нативний декодер браузера —
    // спрацьовує навіть коли формат-специфічний парсер не передбачає ImageWidth/ImageHeight.
    function nativeImageDimensions(file) {
        return new Promise(function (resolve) {
            if (!/^image\//.test(file.type)) { resolve(null); return; }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var w = img.naturalWidth, h = img.naturalHeight;
                URL.revokeObjectURL(url);
                resolve({ w: w, h: h });
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    function humanSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        var units = ['КБ', 'МБ', 'ГБ'];
        var v = bytes;
        for (var i = 0; i < units.length; i++) {
            v /= 1024;
            if (v < 1024 || i === units.length - 1) return v.toFixed(2) + ' ' + units[i];
        }
    }

    function printLine(text, cls) {
        var div = document.createElement('div');
        if (cls) div.className = cls;
        div.textContent = text;
        terminalContent.appendChild(div);
        scrollTerminalToEnd();
    }

    function printHtml(html) {
        var div = document.createElement('div');
        div.innerHTML = html;
        terminalContent.appendChild(div);
        scrollTerminalToEnd();
    }

    function scrollTerminalToEnd() {
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    function clearTerminal() {
        terminalContent.innerHTML = '';
    }

    // Визначення формату за magic bytes + розширенням, виклик відповідного парсера.
    var EXTENSIONLESS_NAMES = { makefile: 1, dockerfile: 1, license: 1, readme: 1, gemfile: 1, rakefile: 1, procfile: 1, vagrantfile: 1, changelog: 1, authors: 1, notice: 1 };

    function detectAndParse(file, buffer) {
        var rawName = file.name.toLowerCase();
        var hasDot = rawName.indexOf('.') > -1;
        var ext = hasDot ? (rawName.split('.').pop() || '') : (EXTENSIONLESS_NAMES[rawName] ? rawName : '');
        var rawExts = { cr2: 1, nef: 1, arw: 1, dng: 1, orf: 1, raf: 1, rw2: 1 };

        var result = null;
        try { result = window.Parsers.jpeg(buffer); } catch (e) {}
        if (result) return { format: 'JPEG', data: Promise.resolve(result) };

        try { result = window.Parsers.png(buffer); } catch (e) {}
        if (result) return { format: 'PNG', data: Promise.resolve(result) };

        try { result = window.Parsers.gif(buffer); } catch (e) {}
        if (result) return { format: 'GIF', data: Promise.resolve(result) };

        try { result = window.Parsers.webp(buffer); } catch (e) {}
        if (result) return { format: 'WEBP', data: Promise.resolve(result) };

        try { result = window.Parsers.bmp(buffer); } catch (e) {}
        if (result) return { format: 'BMP', data: Promise.resolve(result) };

        try { result = window.Parsers.ico(buffer); } catch (e) {}
        if (result) return { format: 'ICO', data: Promise.resolve(result) };

        try { result = window.Parsers.psd(buffer); } catch (e) {}
        if (result) return { format: 'PSD', data: Promise.resolve(result) };

        try { result = window.Parsers.heic(buffer); } catch (e) {}
        if (result) return { format: 'HEIC/AVIF', data: Promise.resolve(result) };

        try { result = window.Parsers.jp2(buffer); } catch (e) {}
        if (result) return { format: 'JPEG2000', data: Promise.resolve(result) };

        if (ext === 'svg') {
            try { result = window.Parsers.svg(buffer); } catch (e) {}
            if (result) return { format: 'SVG', data: Promise.resolve(result) };
        }

        if (rawExts[ext]) {
            try { result = window.Parsers.raw(buffer, ext); } catch (e) {}
            if (result) return { format: 'RAW (' + ext.toUpperCase() + ')', data: Promise.resolve(result) };
        }

        // --- Аудіо ---
        try { result = window.Parsers.flac(buffer); } catch (e) {}
        if (result) return { format: 'FLAC', data: Promise.resolve(result) };

        try { result = window.Parsers.ogg(buffer); } catch (e) {}
        if (result) return { format: 'OGG', data: Promise.resolve(result) };

        try { result = window.Parsers.wav(buffer); } catch (e) {}
        if (result) return { format: 'WAV', data: Promise.resolve(result) };

        try { result = window.Parsers.aiff(buffer); } catch (e) {}
        if (result) return { format: 'AIFF', data: Promise.resolve(result) };

        try { result = window.Parsers.caf(buffer); } catch (e) {}
        if (result) return { format: 'CAF', data: Promise.resolve(result) };

        try { result = window.Parsers.dsf(buffer); } catch (e) {}
        if (result) return { format: 'DSF (DSD)', data: Promise.resolve(result) };

        try { result = window.Parsers.wma(buffer); } catch (e) {}
        if (result) return { format: 'WMA/ASF', data: Promise.resolve(result) };

        try { result = window.Parsers.midi(buffer); } catch (e) {}
        if (result) return { format: 'MIDI', data: Promise.resolve(result) };

        try { result = window.Parsers.ape(buffer); } catch (e) {}
        if (result) return { format: "Monkey's Audio (APE)", data: Promise.resolve(result) };

        if (ext === 'mod' || ext === 'xm' || ext === 's3m' || ext === 'it') {
            try { result = window.Parsers.tracker(buffer, ext); } catch (e) {}
            if (result) return { format: 'Трекерний модуль (' + ext.toUpperCase() + ')', data: Promise.resolve(result) };
        }

        try { result = window.Parsers.mp4audio(buffer); } catch (e) {}
        if (result) return { format: 'MP4/M4A аудіо', data: Promise.resolve(result) };

        // MP3 перевіряємо майже останнім — сигнатура менш надійна (можливий хибний збіг)
        try { result = window.Parsers.mp3(buffer); } catch (e) {}
        if (result) return { format: 'MP3', data: Promise.resolve(result) };

        // --- Документи / таблиці / текст ---
        try { result = window.Parsers.ooxml(buffer, ext); } catch (e) {}
        if (result) return { format: 'OOXML', data: Promise.resolve(result) };

        try { result = window.Parsers.odf(buffer); } catch (e) {}
        if (result) return { format: 'OpenDocument', data: Promise.resolve(result) };

        try { result = window.Parsers.epub(buffer); } catch (e) {}
        if (result) return { format: 'EPUB', data: Promise.resolve(result) };

        try { result = window.Parsers.ole2doc(buffer); } catch (e) {}
        if (result) return { format: 'OLE2 Office', data: Promise.resolve(result) };

        try { result = window.Parsers.rtf(buffer); } catch (e) {}
        if (result) return { format: 'RTF', data: Promise.resolve(result) };

        if (ext !== 'ai') {
            try { result = window.Parsers.pdf(buffer); } catch (e) {}
            if (result) return { format: 'PDF', data: Promise.resolve(result) };
        }

        try { result = window.Parsers.html(buffer, ext); } catch (e) {}
        if (result) return { format: 'HTML', data: Promise.resolve(result) };

        var plaintextExts = {
            // базові текстові/дані
            txt: 1, csv: 1, tsv: 1, md: 1, json: 1, jsonl: 1, ndjson: 1, xml: 1, log: 1, yaml: 1, yml: 1, ini: 1,
            toml: 1, env: 1, conf: 1, cfg: 1, sql: 1, properties: 1, geojson: 1, webmanifest: 1, map: 1, bib: 1,
            ris: 1, ged: 1, gedcom: 1, patch: 1, diff: 1, tf: 1, tfvars: 1, hcl: 1, tfstate: 1, htaccess: 1, htpasswd: 1,
            gitignore: 1, gitattributes: 1, editorconfig: 1, lock: 1, dbml: 1, proto: 1, thrift: 1, graphql: 1,
            desktop: 1, service: 1, socket: 1, timer: 1, m3u: 1, m3u8: 1, rst: 1, tex: 1, typ: 1, mbox: 1,
            makefile: 1, dockerfile: 1, license: 1, readme: 1, gemfile: 1, rakefile: 1, procfile: 1, vagrantfile: 1, changelog: 1, authors: 1, notice: 1,
            // веб
            css: 1, scss: 1, sass: 1, less: 1, js: 1, mjs: 1, cjs: 1, ts: 1, tsx: 1, jsx: 1, vue: 1, svelte: 1,
            php: 1, asp: 1, aspx: 1, jsp: 1, ejs: 1, hbs: 1, pug: 1,
            // мови програмування
            py: 1, java: 1, c: 1, h: 1, cpp: 1, cc: 1, cxx: 1, hpp: 1, cs: 1, go: 1, rs: 1, rb: 1, swift: 1, kt: 1, kts: 1,
            scala: 1, pl: 1, pm: 1, lua: 1, r: 1, jl: 1, dart: 1, groovy: 1, clj: 1, cljs: 1, ex: 1, exs: 1, erl: 1, hrl: 1,
            hs: 1, elm: 1, fs: 1, fsx: 1, ml: 1, mli: 1, nim: 1, zig: 1, v: 1, vb: 1, pas: 1, asm: 1, s: 1, f: 1, f90: 1,
            cob: 1, cbl: 1, d: 1, sh: 1, bash: 1, zsh: 1, fish: 1, ps1: 1, psm1: 1, bat: 1, cmd: 1, awk: 1, sed: 1,
            // раніше пропущені дрібні текстові розширення
            mod: 1, sum: 1, csproj: 1, sln: 1, vbproj: 1, fsproj: 1, ipynb: 1, hex: 1, reg: 1, vbox: 1,
            url: 1, webloc: 1, vhdl: 1, sol: 1, lisp: 1, lsp: 1, rkt: 1, cljc: 1, lhs: 1,
            'for': 1, hh: 1, hxx: 1, m: 1, mm: 1, psd1: 1, psm: 1, dpr: 1, cmake: 1, pro: 1, pp: 1, cl: 1,
            coverage: 1, lcov: 1, containerfile: 1
        };
        if (plaintextExts[ext]) {
            try { result = window.Parsers.plaintext(buffer, ext); } catch (e) {}
            if (result) return { format: 'Текст (' + ext.toUpperCase() + ')', data: Promise.resolve(result) };
        }

        // --- Електронні таблиці (розширені) / бази даних ---
        try { result = window.Parsers.sqlite(buffer); } catch (e) {}
        if (result) return { format: 'SQLite', data: Promise.resolve(result) };
        try { result = window.Parsers.dbf(buffer, ext); } catch (e) {}
        if (result) return { format: 'DBF', data: Promise.resolve(result) };
        try { result = window.Parsers.mdb(buffer); } catch (e) {}
        if (result) return { format: 'MDB/ACCDB', data: Promise.resolve(result) };
        try { result = window.Parsers.rdb(buffer); } catch (e) {}
        if (result) return { format: 'Redis RDB', data: Promise.resolve(result) };
        try { result = window.Parsers.firebird(buffer); } catch (e) {}
        if (result) return { format: 'Firebird/InterBase', data: Promise.resolve(result) };
        try { result = window.Parsers.pgdump(buffer); } catch (e) {}
        if (result) return { format: 'PostgreSQL dump', data: Promise.resolve(result) };

        // --- Java/.NET (перед загальним ZIP, щоб JAR не впав у generic ZIP) ---
        try { result = window.Parsers.jar(buffer, ext); } catch (e) {}
        if (result) return { format: 'JAR/WAR/EAR', data: Promise.resolve(result) };
        try { result = window.Parsers.javaClass(buffer); } catch (e) {}
        if (result) return { format: 'Java class', data: Promise.resolve(result) };

        // --- Вектор/дизайн (AI може бути PDF-сумісним — перед pdf вже пройшли вище, тут ловимо залишок) ---
        try { result = window.Parsers.ai(buffer, ext); } catch (e) {}
        if (result) return { format: 'Adobe Illustrator', data: Promise.resolve(result) };
        try { result = window.Parsers.cdr(buffer); } catch (e) {}
        if (result) return { format: 'CorelDRAW', data: Promise.resolve(result) };
        try { result = window.Parsers.indd(buffer, ext); } catch (e) {}
        if (result) return { format: 'InDesign', data: Promise.resolve(result) };

        // --- Сертифікати ---
        try { result = window.Parsers.cert(buffer, ext); } catch (e) {}
        if (result) return { format: 'Сертифікат/ключ', data: Promise.resolve(result) };

        // --- Шрифти ---
        try { result = window.Parsers.fonts(buffer); } catch (e) {}
        if (result) return { format: 'Шрифт', data: Promise.resolve(result) };

        // --- Відео ---
        try { result = window.Parsers.mp4video(buffer); } catch (e) {}
        if (result) return { format: 'MP4/MOV відео', data: Promise.resolve(result) };
        try { result = window.Parsers.avi(buffer); } catch (e) {}
        if (result) return { format: 'AVI', data: Promise.resolve(result) };
        try { result = window.Parsers.mkv(buffer); } catch (e) {}
        if (result) return { format: 'Matroska/WebM', data: Promise.resolve(result) };
        if (ext === 'wmv') {
            try { result = window.Parsers.wma(buffer); } catch (e) {}
            if (result) return { format: 'WMV (ASF)', data: Promise.resolve(result) };
        }

        // --- Субтитри ---
        var subExts = { srt: 1, vtt: 1, ass: 1, ssa: 1 };
        if (subExts[ext]) {
            try { result = window.Parsers.subtitles(buffer, ext); } catch (e) {}
            if (result) return { format: 'Субтитри', data: Promise.resolve(result) };
        }

        // --- Пошта ---
        try { result = window.Parsers.msg(buffer); } catch (e) {}
        if (result) return { format: 'Outlook MSG', data: Promise.resolve(result) };
        try { result = window.Parsers.eml(buffer, ext); } catch (e) {}
        if (result) return { format: 'EML', data: Promise.resolve(result) };

        // --- Ебуки ---
        try { result = window.Parsers.mobi(buffer); } catch (e) {}
        if (result) return { format: 'MOBI/AZW', data: Promise.resolve(result) };

        // --- 3D/CAD ---
        try { result = window.Parsers.stl(buffer, ext); } catch (e) {}
        if (result) return { format: 'STL', data: Promise.resolve(result) };
        try { result = window.Parsers.obj(buffer, ext); } catch (e) {}
        if (result) return { format: 'OBJ', data: Promise.resolve(result) };
        try { result = window.Parsers.fbx(buffer); } catch (e) {}
        if (result) return { format: 'FBX', data: Promise.resolve(result) };
        try { result = window.Parsers.dwg(buffer, ext); } catch (e) {}
        if (result) return { format: 'DWG', data: Promise.resolve(result) };
        try { result = window.Parsers.dxf(buffer, ext); } catch (e) {}
        if (result) return { format: 'DXF', data: Promise.resolve(result) };

        // --- GIS ---
        try { result = window.Parsers.shp(buffer, ext); } catch (e) {}
        if (result) return { format: 'Shapefile', data: Promise.resolve(result) };
        try { result = window.Parsers.gpx(buffer); } catch (e) {}
        if (result) return { format: 'GPX', data: Promise.resolve(result) };
        try { result = window.Parsers.kml(buffer, ext); } catch (e) {}
        if (result) return { format: 'KML/KMZ', data: Promise.resolve(result) };

        // --- Наукові дані ---
        try { result = window.Parsers.fits(buffer, ext); } catch (e) {}
        if (result) return { format: 'FITS', data: Promise.resolve(result) };
        try { result = window.Parsers.hdf5(buffer); } catch (e) {}
        if (result) return { format: 'HDF5', data: Promise.resolve(result) };
        try { result = window.Parsers.netcdf(buffer); } catch (e) {}
        if (result) return { format: 'NetCDF', data: Promise.resolve(result) };

        // --- Образи дисків/ВМ ---
        try { result = window.Parsers.iso(buffer, ext); } catch (e) {}
        if (result) return { format: 'ISO 9660', data: Promise.resolve(result) };
        try { result = window.Parsers.qcow2(buffer); } catch (e) {}
        if (result) return { format: 'QCOW2', data: Promise.resolve(result) };
        try { result = window.Parsers.vhdx(buffer); } catch (e) {}
        if (result) return { format: 'VHDX', data: Promise.resolve(result) };
        try { result = window.Parsers.vhd(buffer); } catch (e) {}
        if (result) return { format: 'VHD', data: Promise.resolve(result) };
        try { result = window.Parsers.vmdk(buffer); } catch (e) {}
        if (result) return { format: 'VMDK', data: Promise.resolve(result) };

        // --- Виконувані файли ---
        try { result = window.Parsers.pe(buffer); } catch (e) {}
        if (result) return { format: 'PE (EXE/DLL)', data: Promise.resolve(result) };
        try { result = window.Parsers.elf(buffer); } catch (e) {}
        if (result) return { format: 'ELF', data: Promise.resolve(result) };

        // --- ZIP-похідні офісні/пакетні формати (перед загальним ZIP) ---
        try { result = window.Parsers.xps(buffer, ext); } catch (e) {}
        if (result) return { format: 'XPS/OXPS', data: Promise.resolve(result) };
        try { result = window.Parsers.iwork(buffer, ext); } catch (e) {}
        if (result) return { format: 'iWork', data: Promise.resolve(result) };
        try { result = window.Parsers.idml(buffer, ext); } catch (e) {}
        if (result) return { format: 'IDML', data: Promise.resolve(result) };
        try { result = window.Parsers.xlsb(buffer, ext); } catch (e) {}
        if (result) return { format: 'XLSB', data: Promise.resolve(result) };
        try { result = window.Parsers.apk(buffer, ext); } catch (e) {}
        if (result) return { format: 'APK/AAB', data: Promise.resolve(result) };
        try { result = window.Parsers.ipa(buffer, ext); } catch (e) {}
        if (result) return { format: 'IPA', data: Promise.resolve(result) };
        try { result = window.Parsers.msix(buffer, ext); } catch (e) {}
        if (result) return { format: 'MSIX/APPX', data: Promise.resolve(result) };
        try { result = window.Parsers.comicArchive(buffer, ext); } catch (e) {}
        if (result) return { format: 'Комікс-архів', data: Promise.resolve(result) };
        try { result = window.Parsers.openraster(buffer, ext); } catch (e) {}
        if (result) return { format: 'ORA/KRA', data: Promise.resolve(result) };
        try { result = window.Parsers.usd(buffer, ext); } catch (e) {}
        if (result) return { format: 'USD/USDZ', data: Promise.resolve(result) };
        try { result = window.Parsers.ovf(buffer, ext); } catch (e) {}
        if (result) return { format: 'OVF/OVA', data: Promise.resolve(result) };

        // --- Ебуки/комікси (не-ZIP) ---
        try { result = window.Parsers.djvu(buffer); } catch (e) {}
        if (result) return { format: 'DjVu', data: Promise.resolve(result) };
        try { result = window.Parsers.fb2(buffer, ext); } catch (e) {}
        if (result) return { format: 'FictionBook', data: Promise.resolve(result) };
        try { result = window.Parsers.pdb(buffer, ext); } catch (e) {}
        if (result) return { format: 'Palm Database', data: Promise.resolve(result) };

        // --- Аналітичні/статистичні дані ---
        try { result = window.Parsers.parquet(buffer); } catch (e) {}
        if (result) return { format: 'Parquet', data: Promise.resolve(result) };
        try { result = window.Parsers.avro(buffer); } catch (e) {}
        if (result) return { format: 'Avro', data: Promise.resolve(result) };
        try { result = window.Parsers.orc(buffer); } catch (e) {}
        if (result) return { format: 'ORC', data: Promise.resolve(result) };
        try { result = window.Parsers.feather(buffer); } catch (e) {}
        if (result) return { format: 'Arrow/Feather', data: Promise.resolve(result) };
        try { result = window.Parsers.statFile(buffer, ext); } catch (e) {}
        if (result) return { format: 'Статистичні дані', data: Promise.resolve(result) };
        try { result = window.Parsers.dif(buffer, ext); } catch (e) {}
        if (result) return { format: 'DIF', data: Promise.resolve(result) };
        try { result = window.Parsers.bson(buffer, ext); } catch (e) {}
        if (result) return { format: 'BSON', data: Promise.resolve(result) };

        // --- Linux-пакети ---
        try { result = window.Parsers.deb(buffer, ext); } catch (e) {}
        if (result) return { format: 'DEB', data: Promise.resolve(result) };
        try { result = window.Parsers.rpm(buffer, ext); } catch (e) {}
        if (result) return { format: 'RPM', data: Promise.resolve(result) };

        // --- Windows/macOS системні формати ---
        try { result = window.Parsers.msi(buffer, ext); } catch (e) {}
        if (result) return { format: 'MSI', data: Promise.resolve(result) };
        try { result = window.Parsers.lnk(buffer, ext); } catch (e) {}
        if (result) return { format: 'LNK', data: Promise.resolve(result) };
        try { result = window.Parsers.uf2(buffer, ext); } catch (e) {}
        if (result) return { format: 'UF2', data: Promise.resolve(result) };
        try { result = window.Parsers.machO(buffer); } catch (e) {}
        if (result) return { format: 'Mach-O', data: Promise.resolve(result) };
        try { result = window.Parsers.icns(buffer); } catch (e) {}
        if (result) return { format: 'ICNS', data: Promise.resolve(result) };

        // --- Шрифти (додатково) ---
        try { result = window.Parsers.eot(buffer, ext); } catch (e) {}
        if (result) return { format: 'EOT', data: Promise.resolve(result) };
        try { result = window.Parsers.fon(buffer, ext); } catch (e) {}
        if (result) return { format: 'FON', data: Promise.resolve(result) };

        // --- Графіка (додатково) ---
        try { result = window.Parsers.eps(buffer, ext); } catch (e) {}
        if (result) return { format: 'EPS', data: Promise.resolve(result) };
        try { result = window.Parsers.xcf(buffer); } catch (e) {}
        if (result) return { format: 'XCF', data: Promise.resolve(result) };
        try { result = window.Parsers.exr(buffer); } catch (e) {}
        if (result) return { format: 'OpenEXR', data: Promise.resolve(result) };
        try { result = window.Parsers.hdr(buffer, ext); } catch (e) {}
        if (result) return { format: 'Radiance HDR', data: Promise.resolve(result) };

        // --- CAD-обмін / 3D (додатково) ---
        try { result = window.Parsers.step(buffer, ext); } catch (e) {}
        if (result) return { format: 'STEP', data: Promise.resolve(result) };
        try { result = window.Parsers.iges(buffer, ext); } catch (e) {}
        if (result) return { format: 'IGES', data: Promise.resolve(result) };
        try { result = window.Parsers.ifc(buffer, ext); } catch (e) {}
        if (result) return { format: 'IFC', data: Promise.resolve(result) };
        try { result = window.Parsers.gltf(buffer, ext); } catch (e) {}
        if (result) return { format: 'glTF/GLB', data: Promise.resolve(result) };
        try { result = window.Parsers.blend(buffer); } catch (e) {}
        if (result) return { format: 'Blender', data: Promise.resolve(result) };
        try { result = window.Parsers.dae(buffer, ext); } catch (e) {}
        if (result) return { format: 'COLLADA', data: Promise.resolve(result) };
        try { result = window.Parsers.skp(buffer, ext); } catch (e) {}
        if (result) return { format: 'SketchUp', data: Promise.resolve(result) };
        try { result = window.Parsers.revit(buffer, ext); } catch (e) {}
        if (result) return { format: 'Revit', data: Promise.resolve(result) };

        // --- Пошта/календарі (додатково) ---
        try { result = window.Parsers.pst(buffer, ext); } catch (e) {}
        if (result) return { format: 'PST/OST', data: Promise.resolve(result) };
        try { result = window.Parsers.ics(buffer, ext); } catch (e) {}
        if (result) return { format: 'iCalendar', data: Promise.resolve(result) };
        try { result = window.Parsers.vcf(buffer, ext); } catch (e) {}
        if (result) return { format: 'vCard', data: Promise.resolve(result) };
        try { result = window.Parsers.mbox(buffer, ext); } catch (e) {}
        if (result) return { format: 'MBOX', data: Promise.resolve(result) };

        // --- Мережа/безпека ---
        try { result = window.Parsers.pcap(buffer); } catch (e) {}
        if (result) return { format: 'PCAP/PCAPNG', data: Promise.resolve(result) };
        try { result = window.Parsers.har(buffer, ext); } catch (e) {}
        if (result) return { format: 'HAR', data: Promise.resolve(result) };
        try { result = window.Parsers.kdbx(buffer); } catch (e) {}
        if (result) return { format: 'KDBX', data: Promise.resolve(result) };
        try { result = window.Parsers.pgp(buffer, ext); } catch (e) {}
        if (result) return { format: 'OpenPGP', data: Promise.resolve(result) };

        // --- Медичні/наукові дані ---
        try { result = window.Parsers.dicom(buffer); } catch (e) {}
        if (result) return { format: 'DICOM', data: Promise.resolve(result) };
        try { result = window.Parsers.matlab(buffer); } catch (e) {}
        if (result) return { format: 'MATLAB', data: Promise.resolve(result) };
        try { result = window.Parsers.nifti(buffer, ext); } catch (e) {}
        if (result) return { format: 'NIfTI', data: Promise.resolve(result) };
        try { result = window.Parsers.las(buffer, ext); } catch (e) {}
        if (result) return { format: 'LAS/LAZ', data: Promise.resolve(result) };
        try { result = window.Parsers.grib(buffer); } catch (e) {}
        if (result) return { format: 'GRIB', data: Promise.resolve(result) };

        // --- Образи дисків (додатково) ---
        try { result = window.Parsers.vdi(buffer); } catch (e) {}
        if (result) return { format: 'VDI', data: Promise.resolve(result) };

        // --- Бінарні модулі ---
        try { result = window.Parsers.wasm(buffer); } catch (e) {}
        if (result) return { format: 'WASM', data: Promise.resolve(result) };
        try { result = window.Parsers.pyc(buffer, ext); } catch (e) {}
        if (result) return { format: 'Python compiled', data: Promise.resolve(result) };

        // --- Стиснення (додатково) ---
        try { result = window.Parsers.bzip2(buffer); } catch (e) {}
        if (result) return { format: 'BZip2', data: Promise.resolve(result) };
        try { result = window.Parsers.xz(buffer); } catch (e) {}
        if (result) return { format: 'XZ', data: Promise.resolve(result) };
        try { result = window.Parsers.zstd(buffer); } catch (e) {}
        if (result) return { format: 'Zstandard', data: Promise.resolve(result) };
        try { result = window.Parsers.lz4(buffer); } catch (e) {}
        if (result) return { format: 'LZ4', data: Promise.resolve(result) };
        try { result = window.Parsers.cab(buffer); } catch (e) {}
        if (result) return { format: 'CAB', data: Promise.resolve(result) };
        try { result = window.Parsers.dmg(buffer, ext); } catch (e) {}
        if (result) return { format: 'DMG', data: Promise.resolve(result) };

        // --- 3D/ігрові рушії (додатково) ---
        try { result = window.Parsers.max3ds(buffer, ext); } catch (e) {}
        if (result) return { format: '3DS', data: Promise.resolve(result) };
        try { result = window.Parsers.maya(buffer, ext); } catch (e) {}
        if (result) return { format: 'Maya', data: Promise.resolve(result) };
        try { result = window.Parsers.maxFile(buffer, ext); } catch (e) {}
        if (result) return { format: '3ds Max', data: Promise.resolve(result) };
        try { result = window.Parsers.unity(buffer, ext); } catch (e) {}
        if (result) return { format: 'Unity', data: Promise.resolve(result) };
        try { result = window.Parsers.godot(buffer, ext); } catch (e) {}
        if (result) return { format: 'Godot', data: Promise.resolve(result) };
        try { result = window.Parsers.unreal(buffer, ext); } catch (e) {}
        if (result) return { format: 'Unreal Engine', data: Promise.resolve(result) };
        try { result = window.Parsers.wad(buffer, ext); } catch (e) {}
        if (result) return { format: 'WAD', data: Promise.resolve(result) };
        try { result = window.Parsers.appimage(buffer, ext); } catch (e) {}
        if (result) return { format: 'AppImage', data: Promise.resolve(result) };
        try { result = window.Parsers.linuxAppPkg(buffer, ext); } catch (e) {}
        if (result) return { format: 'Flatpak/Snap', data: Promise.resolve(result) };

        // --- Дизайн/RAW-відео (додатково) ---
        try { result = window.Parsers.affinity(buffer, ext); } catch (e) {}
        if (result) return { format: 'Affinity', data: Promise.resolve(result) };
        try { result = window.Parsers.ari(buffer, ext); } catch (e) {}
        if (result) return { format: 'ARRIRAW', data: Promise.resolve(result) };
        try { result = window.Parsers.r3d(buffer, ext); } catch (e) {}
        if (result) return { format: 'RED RAW', data: Promise.resolve(result) };
        try { result = window.Parsers.braw(buffer, ext); } catch (e) {}
        if (result) return { format: 'Blackmagic RAW', data: Promise.resolve(result) };

        // --- БД внутрішні файли ---
        try { result = window.Parsers.innodb(buffer, ext); } catch (e) {}
        if (result) return { format: 'InnoDB', data: Promise.resolve(result) };
        try { result = window.Parsers.myisamFrm(buffer, ext); } catch (e) {}
        if (result) return { format: 'MySQL FRM', data: Promise.resolve(result) };
        try { result = window.Parsers.wiredtiger(buffer, ext); } catch (e) {}
        if (result) return { format: 'WiredTiger', data: Promise.resolve(result) };
        try { result = window.Parsers.redisAof(buffer, ext); } catch (e) {}
        if (result) return { format: 'Redis AOF', data: Promise.resolve(result) };

        // --- Аудіо (додатково) ---
        try { result = window.Parsers.aac(buffer, ext); } catch (e) {}
        if (result) return { format: 'AAC', data: Promise.resolve(result) };
        try { result = window.Parsers.amr(buffer); } catch (e) {}
        if (result) return { format: 'AMR', data: Promise.resolve(result) };
        try { result = window.Parsers.ac3(buffer, ext); } catch (e) {}
        if (result) return { format: 'AC-3', data: Promise.resolve(result) };

        // --- Інше ---
        try { result = window.Parsers.abiword(buffer, ext); } catch (e) {}
        if (result) return { format: 'AbiWord', data: Promise.resolve(result) };
        try { result = window.Parsers.age(buffer, ext); } catch (e) {}
        if (result) return { format: 'age', data: Promise.resolve(result) };
        try { result = window.Parsers.ociImage(buffer, ext); } catch (e) {}
        if (result) return { format: 'OCI Image', data: Promise.resolve(result) };

        // --- Архіви (загальні) ---
        try { result = window.Parsers.gzip(buffer); } catch (e) {}
        if (result) return { format: 'GZIP/TAR.GZ', data: Promise.resolve(result) };
        try { result = window.Parsers.tar(buffer); } catch (e) {}
        if (result) return { format: 'TAR', data: Promise.resolve(result) };
        try { result = window.Parsers.sevenZip(buffer); } catch (e) {}
        if (result) return { format: '7-Zip', data: Promise.resolve(result) };
        try { result = window.Parsers.rar(buffer); } catch (e) {}
        if (result) return { format: 'RAR', data: Promise.resolve(result) };
        try { result = window.Parsers.zipArchive(buffer, ext); } catch (e) {}
        if (result) return { format: 'ZIP', data: Promise.resolve(result) };

        try { result = window.Parsers.generic(buffer); } catch (e) {}
        return { format: 'не розпізнано', data: Promise.resolve(result || {}) };
    }

    function handleFile(file) {
        clearTerminal();
        fileNameLabel.textContent = file.name;
        reportBtn.disabled = true;
        currentFileInfo = null;
        currentMetadata = null;

        var lastModifiedStr = file.lastModified ? new Date(file.lastModified).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'невідома';

        printLine('> завантаження файлу: ' + file.name);
        printLine('> розмір: ' + humanSize(file.size) + ' (' + file.size + ' байт)');
        printLine('> MIME-тип (за даними браузера): ' + (file.type || 'не визначено браузером'));
        printLine('> дата останньої зміни: ' + lastModifiedStr);

        file.arrayBuffer().then(function (buffer) {
            var detected = detectAndParse(file, buffer);
            printLine('> визначений формат (за сигнатурою): ' + detected.format);
            printLine('> сканування метаданих...');

            return Promise.all([detected.data, sha256Hex(file), nativeImageDimensions(file)]).then(function (results) {
                var metadata = results[0], hash = results[1], nativeDim = results[2];
                currentFileInfo = {
                    name: file.name, size: humanSize(file.size) + ' (' + file.size + ' байт)',
                    type: detected.format, mime: file.type || 'не визначено браузером', modified: lastModifiedStr,
                    hash: hash, nativeDim: nativeDim
                };
                currentMetadata = metadata || {};

                if (hash) {
                    printLine('> контрольна сума SHA-256: ' + hash);
                } else if (file.size > 100 * 1024 * 1024) {
                    printLine('> контрольну суму не обчислено: файл завеликий для розрахунку в браузері.');
                }
                if (nativeDim) {
                    var g = gcd(nativeDim.w, nativeDim.h) || 1;
                    printLine('> фактичні розміри зображення (нативний декодер): ' + nativeDim.w + '×' + nativeDim.h +
                        ' (співвідношення ~' + (nativeDim.w / g) + ':' + (nativeDim.h / g) + ')');
                }

                var keys = Object.keys(currentMetadata);
                if (keys.length === 0) {
                    printLine('> метадані не знайдено або формат не підтримується.');
                } else {
                    printLine('> знайдено полів метаданих: ' + keys.length);
                    keys.forEach(function (k) {
                        var v = currentMetadata[k];
                        if (v instanceof Uint8Array) v = '[бінарні дані, ' + v.length + ' байт]';
                        else if (Array.isArray(v)) v = v.join(', ');
                        printLine('  ' + k + ' = ' + v);
                    });
                }
                printLine('> готово.');
                reportBtn.disabled = false;
            });
        }).catch(function (err) {
            printLine('> помилка обробки файлу: ' + err.message);
        });
    }

    reportBtn.addEventListener('click', function () {
        if (!currentFileInfo || !currentMetadata) return;
        printHtml(window.Report.render(currentFileInfo, currentMetadata));
    });

    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });

    dropZone.addEventListener('click', function () { fileInput.click(); });
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
})();
