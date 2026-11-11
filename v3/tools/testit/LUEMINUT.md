# 3.0-kokeilun testit (Playwright)

Käynnistä repon juuressa `python3 -m http.server 8765` ja aja:

- `node func.js` – toiminnallinen testi: aloitusruudun Grafiikka-valinta, pikavalinta näppäimellä ja napautuksella, autoliikkeen pihaan pysähtyminen, vähintään kolme kuukautta ajoa oikeassa pelisilmukassa, liittymästä valikkoon, tallennus ja lataus, päivän haasteen toistettavuus, ei pyyntöjä localhostin ulkopuolelle, ei virheitä konsolissa.
- `node fps.js low|med|high` – ruudunpäivitys, latauskoko ja piirtokutsut.
- `node nogl.js` – WebGL pois päältä: ilmoitus ja linkki 2.0:aan.

Ilman näytönohjainta Chromium piirtää ohjelmallisesti (SwiftShader), jolloin peli pyörii muutaman ruudun sekunnissa ja `func.js` kestää kymmeniä minuutteja. Kuvat tallentuvat kansioon `$KUVAT` (oletus: järjestelmän tmp).
