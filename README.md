# Витоки Даних / Data Origins Suite
https://itstiamushchy.github.io/-Data-Origins-Suite/
Браузерний аналізатор метаданих файлів. Працює повністю локально (без сервера й без завантаження файлів кудись назовні) — відкрийте `index.html` у браузері, перетягніть файл, отримайте звіт.

**Автор:** Хоменко Олексій Григорович · **Бренд:** ITS_tiamushchy · **Версія:** v0.0.18

## Що робить

Визначає формат файлу за сигнатурою (а не лише за розширенням) і витягує з нього всі доступні метадані: автора, дати створення/зміни, технічні параметри (роздільність, тривалість, кодек тощо), GPS-координати, вбудовані теги — залежно від того, що передбачає сам формат.

Кнопка **«Звіт»** формує результат прямо у вікні терміналу зрозумілою мовою: зеленим — значення з файлу, білим — пояснення, що це за поле.

## Підтримувані формати

- **Графіка:** JPEG, PNG, GIF, WEBP, BMP, SVG, TIFF, ICO, PSD, HEIC/AVIF, JPEG2000, RAW-формати камер (CR2/NEF/ARW/DNG/ORF/RAF/RW2), EPS, XCF, ORA/KRA, OpenEXR, HDR, ICNS
- **Аудіо:** MP3, FLAC, OGG/Vorbis/Opus, WAV, AIFF, MP4/M4A, CAF, DSF, WMA, MIDI, APE, трекерні модулі, AAC, AMR, AC-3
- **Відео:** MP4/MOV, AVI, MKV/WebM, WMV, субтитри SRT/VTT/ASS
- **Документи:** DOCX/XLSX/PPTX, legacy DOC/XLS/PPT, ODT/ODS/ODP, RTF, PDF, EPUB, XPS, iWork, AbiWord
- **Текст/дані:** CSV, JSON, XML, YAML та ще ~90 розширень мов програмування й конфігів
- **Бази даних:** SQLite, DBF, MDB/ACCDB, Redis, аналітичні формати (Parquet/Avro/ORC/Feather), SAS/SPSS/Stata
- **Архіви:** ZIP, TAR, GZIP, RAR, 7-Zip, BZip2, XZ, Zstandard, LZ4, CAB, JAR
- **Пошта/календарі:** EML, MSG, MBOX, PST/OST, ICS, VCF
- **Ебуки/комікси:** MOBI/AZW, DjVu, FictionBook, CBZ/CBR
- **Шрифти:** TTF, OTF, WOFF, WOFF2, EOT, FON
- **Вектор/дизайн:** Illustrator, CorelDRAW, InDesign, Affinity
- **3D/CAD:** STL, OBJ, FBX, DWG, DXF, STEP, IGES, IFC, glTF/GLB, Blender, COLLADA, SketchUp, Revit
- **RAW-відео камер:** ARRIRAW, RED R3D, Blackmagic BRAW
- **Виконувані файли:** PE (EXE/DLL), ELF, Mach-O
- **Мобільні/пакети:** APK/AAB, IPA, MSIX/APPX, DEB, RPM, MSI, AppImage, Flatpak, Snap
- **Образи дисків/ВМ:** ISO 9660, VHD/VHDX, VMDK, QCOW2, VDI, OVF/OVA, DMG
- **Безпека:** сертифікати (PEM/CRT/DER/P12), PCAP/PCAPNG, HAR, KDBX, OpenPGP, age, LNK, UF2
- **GIS:** KML/KMZ, GPX, Shapefile
- **Наукові/медичні:** FITS, NetCDF, HDF5, DICOM, MATLAB, NIfTI, LAS/LAZ, GRIB
- **Ігрові рушії:** Unity, Godot, Unreal, Doom WAD
- **Інше:** WASM, Python class/pyc, Java class, BSON, OCI-образи

Для закритих пропрієтарних форматів (RAR, 7-Zip, P12, WOFF2, MDB, DWG, NetCDF/HDF5 тощо) парсер підтверджує сигнатуру й базові поля, але не розкриває внутрішню структуру — це прямо позначено в полі `Note` відповідного звіту.

## Архітектура

Багатофайлова: спільні рушії (`tiff-reader.js` для EXIF/TIFF, `zip-reader.js` для ZIP-контейнерів, `ole2-reader.js` для CFB/OLE2) + один файл-парсер на формат у `js/parsers/`, словник назв і пояснень у `js/labels.js`, диспетчер у `js/app.js`.

## Запуск

Відкрити `index.html` у браузері — жодних залежностей, збірки чи інтернету не потрібно.
