# PAALAAN!

C64-henkinen selainpeli. Lähdet liikkeelle bensaa juovalla Mondeolla ja tonnilla käteistä, ja tavoitteena on unelma-auto 84 kuukaudessa. Matkalla on ylihyvityskampanjoita, jämärilainoja, huutokauppoja, Elonin twiittejä, peuroja, mikrobetonia ja pikavippejä. Jos lainaa on lopussa enemmän kuin autossa arvoa, olet vankilassa.

Pelaa: https://marko958.github.io/Paalaan/ (1.0: kevyt tekstiversio, yksi HTML-tiedosto ilman canvasia, helppo portata kevyille järjestelmille)

**2.0 (alpha):** https://marko958.github.io/Paalaan/v2/ – PAALAAN!-napista lähdetään ajamaan omalla autolla: kuukausi vaihtuu 30 sekunnin välein, peuroja väistellään, ja kuukauden lopun liittymästä pääsee valikkoon. Alpha 17: akku ja latausasemat, vetomassat ja kärrytyypit, DPF, kahdet renkaat, 0 %-kampanjat, romutuspalkkio sekä reissut Kuopioon, Leville ja Saksaan. Alpha 30: peli tallentuu selaimeen, ennätykset, päivän haaste (kaikilla samat kuukausien tapahtumat ja jaettava tulos), loppuraportti, mainostaulut ja autoliikkeet tien varressa, pikavalinnat ajon aikana, keli (lumisade, sade, musta jää, lumipenkat) ja äänet. Alpha 34: ajotilan grafiikka on piirretty uusiksi niin, että se voisi olla C64-peli: kuva on aidosti 320×200 pikseliä ja siinä on vain C64:n 16 väriä, välisävyt on rasteroitu, ja pimeys on paletin porrastus, johon ajovalot, vastaantulijat, katuvalot ja mainostaulut leikkaavat valoa. Jokaisella automallilla on oma pikselikuvansa takaa ja edestä (korityyppi, mittasuhteet ja valosignatuuri, ei logoja), auto kääntyy ohjatessa, ja liikenteessä ajaa samoja malleja, busseja ja rekkoja. Maisemassa on mäntyjä, kuusia ja koivuja vuodenajan mukaan, peltojen vaot, järviä, sähkölinjoja, aurausviitat, lupiinit, heinäpaalit, auringonlasku, tähdet, kuu ja revontulet. Kaikki mallit näkee [autogalleriasta](https://marko958.github.io/Paalaan/v2/autot.html). Alpha 35: ajofysiikka uusittu: ratti kääntyy portaattomasti ja autolla on sivuttaishitaus, joten liukkaalla se jatkaa luisua vielä ratin suoristuttua. Pito riippuu kelistä ja renkaista (kuiva, sade, lumi talvirenkailla, kesärenkaat talvella, musta jää) ja vaikuttaa jarrutukseen, liikkeellelähtöön ja kaarrenopeuteen. Mäet syövät ja antavat vauhtia, ja peräkärry pidentää jarrutusmatkaa. Mittaukset: `node v2/tools/fysiikka.js`. Ideat: [KEHITYSIDEOITA.md](KEHITYSIDEOITA.md). Suunnitelma: [SUUNNITELMA-2.0.md](SUUNNITELMA-2.0.md).

**3.0 (grafiikkakokeilu):** https://marko958.github.io/Paalaan/v3/ – sama peli kuin 2.0, mutta ajotila piirretään three.js:llä realistisena 3D:nä: fysikaalinen valaistus ja HDRI-taivas, asfaltti ja talven polanne, kuusi- ja koivumetsät, vuodenajat ja kaamos, sää hiukkasina sekä koodissa mallinnetut autot (jokaisella korityypillä oma parametrinen malli ja mallikohtainen valosignatuuri, ei logoja). Pelilogiikka, säännöt, tekstit, valikot ja äänet ovat 2.0:n; simulaatio on sama, vain piirto on vaihdettu. Tallennus on erillään 2.0:sta (`paalaan3.*`). Aloitusruudussa on valinta "Grafiikka: Auto/Matala/Keski/Korkea". three.js ja Poly Havenin CC0-resurssit ovat repossa, joten peli ei tee pyyntöjä kolmansille osapuolille; lähteet ja lisenssit: [v3/assets/LISENSSIT.md](v3/assets/LISENSSIT.md). Jos WebGL ei toimi, sivu ohjaa 2.0:aan. Kehitystyökalut: `v3/tools/resurssit.py` (resurssien haku ja pakkaus) ja `v3/tools/autot.html` (autogalleria).

## C64-budjetti (1.0)

1.0 pidetään niin kevyenä, että sen voi portata C64:lle ja ladata yhdellä kerralla kasetilta. Kasetilta tekstejä ei voi ladata tarpeen mukaan, joten koko pelin pitää mahtua muistiin. Tarkistus:

```bash
python3 tools/c64budjetti.py
```

Skripti laskee 1.0:n pelaajalle näkyvät tekstit ja arvioi, kuinka paljon ne vievät C64:n muistista pakattuina. Rajat ovat arvioita:

- pakkaamatonta tekstiä enintään 40 000 merkkiä
- lohkoittain pakattua tekstiä enintään 21 000 tavua; turvaraja on 19 000, jotta koodille jää tilaa
- koko peli muistissa enintään noin 52 kt (konekieli, BASIC-ROM pois päältä)
- valinnan teksti enintään 38 merkkiä (yksi C64-rivi) ja ruudussa enintään 9 valintaa
- ei liukulukufunktioita (`Math.pow` ym.): C64-versiossa euroilla lasketaan kokonaisluvuin

Tekstejä ei lyhennetä budjetin takia ennen kuin peliä ollaan oikeasti porttaamassa, joten skripti vain raportoi eikä kaada mitään. Porttausvaiheessa `--raja` tekee tekstirajan ylityksestä virheen, ja `--tiukka` lisäksi pitkistä valinnoista ja liukuluvuista. `--pitkat` listaa liian pitkät valintatekstit. GitHub ajaa raportin automaattisesti, kun `index.html` muuttuu, jotta tilanne näkyy.

