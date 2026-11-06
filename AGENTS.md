
## Testovací a ostré nasazení

- Nové funkce připravujte ve větvi a přes pull request. Změny v `main` se automaticky nasazují pouze na `https://test.skola.eduvize.cz`.
- Ostrý provoz `https://skola.eduvize.cz` smí přejít pouze na aktuální úspěšně otestované vydání přes workflow `eduvize-styly/.github/workflows/eduvize-production.yml`.
- Schválení prostředí `production` provádí vlastník projektu. AI agent za něj nekliká na Approve and deploy, neobchází schvalování a neposílá přímé změny na produkční server. Příprava testu není schválení ostrého vydání.
- Nikdy nekopírujte produkční data, Microsoft/OneDrive tokeny, SMTP/CRM údaje ani produkční klíče do testu. Test používá samostatné přístupy.
- Nasazujte stejné obrazy a statické soubory ověřené na testu; při publikaci nic znovu nesestavujte. Databázové změny musí být zpětně kompatibilní; destruktivní migrace vyžadují samostatný schválený plán.
- Provozní postup vlastní `eduvize-admin/deployment/README.md`. Rozhodnutí uživatele 6. 11. 2026 a `../EDUVIZE-OUTPUT-CONTRACT.md` ruší povinnost zachovávat staré vývojové odkazy GitHub Pages/Render. Data škol, materiály, konfigurace a licence se tím nemažou. Od prvního stabilního vydání nového kontraktu jsou adresy stálé.
- Nové publikované výstupy používají společný registry/API v1 a runtime z `eduvize-admin`/`eduvize-styly`. Kopírování a otevření nesmějí publikovat koncept nebo vytvářet duplicity. Veřejný kontext nesmí pocházet z relace správce či localStorage. Starý kiosk-output-link.js je přechodový kód, nikoli implementace v1.
- Test a produkce musí fungovat bez Renderu i po studeném startu bez cache; žádný onrender fallback. Služby konfigurujte pro stejné prostředí. Závislosti vložených aplikací ověřujte také na serveru. Kiosek adaptér nezapínejte před integrací a testy; změny společného modelu vložených výstupů koordinujte s vlastníkem API.
