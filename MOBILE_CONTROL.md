# Mobilní ovládání kiosku

Na skutečné hlavní obrazovce kiosku je v liště data a času QR kód. V administraci lze funkci vypnout volbou „Povolit ovládání kiosku telefonem přes QR kód“. Náhledy a vložené podstránky vlastní spojení nevytvářejí. Stávající odkazy i konfigurace zůstávají platné; nové pole `remoteControl: false` funkci vypne.

Telefon po načtení QR kódu zobrazí aktuální tlačítka nabídky včetně Další/Zpět a Domů. Volba aktivuje stejný existující handler jako dotyk na obrazovce. Ovladač neotevírá školní konfiguraci v telefonu a neposílá URL k vykonání. Ovládá nabídku kiosku, nikoli formuláře a libovolné prvky uvnitř cizích webů.

Telefon a obrazovka potřebují internet; společná Wi-Fi není nutná. Připojit se může jeden telefon. QR kód je jednorázový a před připojením se obnovuje po dvou minutách. Ovládání vyprší po dvou minutách bez volby. Návštěvník je může ukončit v telefonu a obsluha tlačítkem Odpojit telefon na obrazovce. Nové spojení pak vyžaduje nový QR kód. Zavření telefonu nemusí vyvolat okamžité odpojení, platí časový limit nečinnosti.

## Protokol

`kiosk_remote.py` v dokumentové službě poskytuje izolované `/api/kiosk-remote` API. Stav je v samostatné PostgreSQL tabulce, bez přístupu k účtům, školním profilům a OneDrive. Náhodné capability klíče jsou oddělené pro obrazovku, jednorázové spárování a telefon. Klíč telefonu ani obrazovky se nevkládá do veřejného odkazu. QR obsahuje párovací klíč ve fragmentu; telefon fragment po načtení odstraní z historie.

Heartbeaty a příkazy používají krátké HTTP požadavky, které fungují i přes mobilní síť. Příkazy mají ID pro deduplikaci, revizi nabídky, pořadové číslo a platnost 5 sekund. Nabídka má omezenou velikost, fronta a frekvence příkazů jsou omezené, vznik anonymních spojení je omezený. Zaniklé relace se uklízejí při vytváření nových. Kiosek při výpadku sítě funguje dál lokálně; opožděné volby se neprovedou.

Testy protokolu: `python -m unittest discover -s tests -p test_kiosk_remote.py` v dokumentové službě. Pro návrat použijte větve `backup/kiosk-mobile-20261103` v obou repozitářích, případně funkci vypněte v administraci.
