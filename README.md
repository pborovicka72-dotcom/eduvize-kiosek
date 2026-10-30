# Eduvize – Kiosek

Samostatná interaktivní aplikace Eduvize pro školní dotykové obrazovky. Kiosek zobrazuje nabídku, podstránky a odkazy na samostatně nasazené moduly; **neobsahuje jejich implementace**.

## Stránky
- Administrace: https://pborovicka72-dotcom.github.io/eduvize-kiosek/config.html
- Kiosek: https://pborovicka72-dotcom.github.io/eduvize-kiosek/index.html

Konfigurace nabídky a tlačítek se spravuje v administraci. Při změnách je třeba ověřit uložení a obnovení konfigurace, režimy rozložení, dotykové ovládání a náhled.

## Sdílené závislosti
Vzhled administrace, aktivní styl, výběr šablon Newline a geometrie segmentů pocházejí z `eduvize-styly`. Lokální CSS smí definovat pouze rozložení a specifické prvky Kiosku, nikoliv další kopii centrálního design systému.

Změny administrace nesmějí neúmyslně ovlivnit zobrazení samotného Kiosku.
