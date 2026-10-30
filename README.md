# Eduvize – Kiosek

Samostatná interaktivní aplikace Eduvize pro školní dotykové obrazovky. Kiosek zobrazuje nabídku, podstránky a odkazy na samostatně nasazené moduly; **neobsahuje jejich implementace**.

## Stránky
- Administrace: https://pborovicka72-dotcom.github.io/eduvize-kiosek/config.html
- Kiosek: https://pborovicka72-dotcom.github.io/eduvize-kiosek/index.html

Konfigurace nabídky a tlačítek se spravuje v administraci. Při změnách je třeba ověřit uložení a obnovení konfigurace, režimy rozložení, dotykové ovládání a náhled.

## O škole
Sekce **O škole** v administraci upravuje název, motto, představení, adresu, kontakty, vedení, úřední hodiny, IČO, informace pro návštěvníky a volitelnou fotografii. Data jsou v objektu `school` stávající konfigurace `eduvize-kiosk-v1`, včetně sdílených odkazů. Podstránka má ID `school`; tlačítko náhledu ji umí znovu vytvořit. Nevyplněná pole se ve výstupu nezobrazují. Kontakty se zobrazují jako prostý text bez odkazů. Představení je omezené na 240 znaků, motto na 80 a informace pro návštěvníky na 240. Uložený starší text se nemaže. Centrální komponenta `fit-panel.js` přizpůsobuje celý přehled dostupnému oknu.

Kontroly: `node tests/kiosk-apps.test.mjs` a `node tests/school.test.mjs`.

## Sdílené závislosti
Vzhled administrace, aktivní styl, výběr šablon Newline a geometrie segmentů pocházejí z `eduvize-styly`. Lokální CSS smí definovat pouze rozložení a specifické prvky Kiosku, nikoliv další kopii centrálního design systému.

Změny administrace nesmějí neúmyslně ovlivnit zobrazení samotného Kiosku.

### Konfigurace na OneDrive

Administrace ukládá a načítá pojmenované konfigurace přes existující službu Dokumenty, se stejným administračním klíčem a připojením Microsoftu. Soubory jsou v `Eduvize-Dokumenty/_Eduvize-system/Kiosek/<název>.json`; nejsou součástí veřejného katalogu dokumentů. Před přepsáním se uloží `<název>.previous.json`. Klíč je pouze v paměti stránky, nikdy v konfiguraci, URL ani localStorage. Čtení i zápis vyžadují autorizaci. JSON stažení zůstává doplňkovou zálohou.

Obrázky sekcí mají vlastní ohraničený box vlevo vedle textu a vyplňují ho ořezem (`object-fit: cover`). Samostatný úvodní obrázek a text se již nezobrazují ani needitují; dříve uložená data zůstávají v konfiguraci kvůli zpětné kompatibilitě. Nedostupné obrázky se skryjí. Popisy obrázků a názvy odkazů se již nezadávají; přístupný název obrázku vychází z nadpisu a odkaz na podrobnosti má podobu malé sponky.

### Kompaktní stránky a stavový panel

Sdílené `EduvizePagedPanel.mountFlow` seskupuje celé obsahové sekce podle skutečné výšky a přepočítává stránky při změně velikosti okna a načtení obrázku. Stránkování se objeví pouze při nedostatku prostoru. Jedna nadměrně dlouhá sekce využije stávající přizpůsobení velikosti.

Přepínač `showInfoPanel` zobrazí nad aplikací logo Eduvize, místní datum a čas přes sdílenou komponentu `status-panel`. Ve výchozím stavu je vypnutý: v bočním rozložení pak aplikace vyplní i prostor od horní hrany vedle názvu nabídky. Preference se přenáší v JSON i OneDrive konfiguraci. Sdílený Newline picker podporuje volbu `interactivePreview`; Kiosek ji zapíná pro ovládání živého náhledu.

### Sdílené komponenty (v22)

Rozložení kiosku a stránkování vychází z `eduvize-styly/design-system/kiosk-layout.css` a `tile-navigation.js`; lokální kopie jsou odstraněny. Na šířku má boční nabídka 2 sloupce × 5 řad; horní/spodní nabídka má 7 míst v jedné řadě a lištu širokou jako 3 dlaždice. Na výšku má boční nabídka 3 × 3 místa, horní/spodní nabídka 5 sloupců × 2 řady. Lišta je na výšku nad menu. Hlavní stránka nemá kartu s názvem, ani v celoplošném rozložení. Při stránkování se zachová stejná kapacita mřížky. Celoplošné rozložení používá `tileCount` (3–25 míst včetně navigace). Rozměry mřížky se odvozují automaticky: 10 míst znamená 4 sloupce × 3 řady na šířku a 3 × 4 na výšku, dvě buňky zůstanou prázdné. Starší `tileColumns` a `tileRows` se převedou na jejich součin (nejvýše 25). Datum a čas jsou viditelné pouze na hlavní stránce; `showLogo` ovládá logo a `logoUrl` umožňuje vlastní veřejné HTTP(S) logo. Prázdná URL použije značku Eduvize. Navigační dlaždice jsou bez pevné pozice za poslední položkou. Starší `showInfoPanel` se čte pouze pro převzetí volby loga.

Dokumenty využívají sdílený `document-viewport.js/css` pro skutečné zvětšování, přizpůsobení šířce či výšce, posouvání a fullscreen. Stejné ovládání funguje v samostatných Dokumentech i při otevření z Kiosku. Web školy je volitelný bezpečný HTTP(S) odkaz v informační kartě školy.
