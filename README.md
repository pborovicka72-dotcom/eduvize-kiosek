# Eduvize – Kiosek

Samostatná interaktivní aplikace Eduvize pro školní dotykové obrazovky. Kiosek zobrazuje nabídku, podstránky a odkazy na samostatně nasazené moduly; **neobsahuje jejich implementace**.

## Stránky
- Administrace: https://pborovicka72-dotcom.github.io/eduvize-kiosek/config.html
- Kiosek: https://pborovicka72-dotcom.github.io/eduvize-kiosek/index.html

Konfigurace nabídky a tlačítek se spravuje v administraci. Při změnách je třeba ověřit uložení a obnovení konfigurace, režimy rozložení, dotykové ovládání a náhled.

## O škole
Sekce **O škole** v administraci upravuje název, motto, představení, adresu, kontakty, vedení, úřední hodiny, IČO, informace pro návštěvníky a volitelnou fotografii. Data jsou v objektu `school` stávající konfigurace `eduvize-kiosk-v1`, včetně sdílených odkazů. Podstránka má ID `school`; tlačítko náhledu ji umí znovu vytvořit. Nevyplněná pole se ve výstupu nezobrazují. Text se vykresluje jako prostý text a web školy se otevírá uvnitř Kiosku.

Kontroly: `node tests/kiosk-apps.test.mjs` a `node tests/school.test.mjs`.

## Sdílené závislosti
Vzhled administrace, aktivní styl, výběr šablon Newline a geometrie segmentů pocházejí z `eduvize-styly`. Lokální CSS smí definovat pouze rozložení a specifické prvky Kiosku, nikoliv další kopii centrálního design systému.

Změny administrace nesmějí neúmyslně ovlivnit zobrazení samotného Kiosku.
