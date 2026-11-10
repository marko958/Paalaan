# PAALAAN!

C64-henkinen selainpeli. Lähdet liikkeelle bensaa juovalla Mondeolla ja tonnilla käteistä, ja tavoitteena on unelma-auto 84 kuukaudessa. Matkalla on ylihyvityskampanjoita, jämärilainoja, huutokauppoja, Elonin twiittejä, peuroja, mikrobetonia ja pikavippejä. Jos lainaa on lopussa enemmän kuin autossa arvoa, olet vankilassa.

Pelaa: https://marko958.github.io/Paalaan/ (1.0: kevyt tekstiversio, yksi HTML-tiedosto ilman canvasia, helppo portata kevyille järjestelmille)

**2.0 (alpha):** https://marko958.github.io/Paalaan/v2/ – PAALAAN!-napista lähdetään ajamaan omalla autolla: kuukausi vaihtuu 30 sekunnin välein, peuroja väistellään, ja kuukauden lopun liittymästä pääsee valikkoon. Alpha 17: akku ja latausasemat, vetomassat ja kärrytyypit, DPF, kahdet renkaat, 0 %-kampanjat, romutuspalkkio sekä reissut Kuopioon, Leville ja Saksaan. Ideat: [KEHITYSIDEOITA.md](KEHITYSIDEOITA.md). Suunnitelma: [SUUNNITELMA-2.0.md](SUUNNITELMA-2.0.md).

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

Ylitys pakkaamattoman tai pakatun tekstin rajassa kaataa tarkistuksen. Pitkät valinnat ja liukuluvut ovat huomautuksia, ja `--tiukka` tekee niistäkin virheitä. `--pitkat` listaa liian pitkät valintatekstit. GitHub ajaa tarkistuksen automaattisesti, kun `index.html` muuttuu.

