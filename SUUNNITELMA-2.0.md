# PAALAAN! 2.0 – suunnitelma

**Perusajatus:** 2.0 rakennetaan 1.0-pelin päälle. Lainat, autoliike, tapahtumat, työsuhdeauto ja vippi pysyvät. Kun pelaaja painaa PAALAAN!, hän ei siirry suoraan seuraavaan kuukauteen vaan lähtee tielle ajamaan sillä autolla, joka hänellä silloin on. Ajossa väistellään peuroja, ladataan, ajetaan keikkoja ja käännytään autoliikkeisiin.

## Päätökset

| Asia | Päätös |
|---|---|
| Kuukauden pituus | **30 sekuntia ajoa.** Koko peli (84 kk) kestää noin 42 minuuttia, jos ajaa putkeen. |
| 1.0-versio | Jää ennalleen omaksi versiokseen osoitteeseen https://marko958.github.io/Paalaan/ |
| 2.0:n osoite | https://marko958.github.io/Paalaan/v2/ |
| Peurakolari | Vahinko riippuu vauhdista. Kova kolari johtaa **lunastukseen**. Jos uutta autoa ei saa ostettua tai rahoitettua, **peli päättyy**. |
| Wolt ja taksi | Ajotilassa **oikeita kyytejä ja toimituksia**. |
| Tiedostot | Ks. kohta 8. |

## 1. Pelisilmukka

```
Valikko (1.0)  →  PAALAAN!  →  AJOTILA  ──(liittymä, auto rikki tai pakollinen tapahtuma)──→  Valikko
                                  ↑  kuukaudet vaihtuvat ajaessa  │
                                  └───────────────────────────────┘
```

- **Kuukausi on 30 s ajoa.** Kun kuukausi vaihtuu, nykyinen `monthTick()` ajetaan taustalla. Tiliote näkyy ruudun yläreunassa lyhyenä ilmoituksena (”+Autobudjetti 1 200 €, −Laina 480 €…”), eikä se pysäytä peliä.
- **Liittymä joka kuukauden lopussa:** kyltti ”LIITTYMÄ: Kotiin / asioille”. Jos pelaaja kääntyy siitä, hän pääsee nykyiseen valikkoon (autoliike, huutokauppa, myynti, korjaamo, sivutulot). Jos hän ajaa ohi, kuukaudet jatkuvat putkeen.
- **Pakotettu poistuminen tieltä:** auto ei kulje (`car.broken`), lunastus, rahoittaja vie auton tai kuukausi 84 tulee täyteen.

## 2. Tapahtumat ajotilassa

Nykyinen `randomEvent()` jaetaan kolmeen ryhmään:

| Ryhmä | Esimerkit | Toiminta |
|---|---|---|
| **Tiellä tapahtuvat** | peura, kivenisku, kolhu, liukkaus | Näkyvät esteinä tiellä. Osuma käynnistää vahinkotapahtuman (`damageEvent`, työsuhdeautolla `tsaDamage`). Väistö ei maksa mitään. |
| **Pikavalinnat** | huhut, kampanja, sakko, sähköpiikki, vakuutus | Peli hidastuu ja ruudulle tulee ponnahdus, josta valitaan näppäimillä 1–3. Jos pelaaja ei valitse 5 sekunnissa, toteutuu oletusvalinta. |
| **Odottavat** | huolto, katsastus, työsuhdeauton tarjous, verottaja | Jäävät jonoon seuraavaan liittymään. Jos pelaaja ajaa monta liittymää ohi, katsastus jää välistä (`car.skip`, takuu raukeaa) ja huolto myöhästyy. |

### Peurat ja lunastus

- Syys–joulukuussa peuroja on enemmän, kuten 1.0:ssa. Kaamosaikaan ne näkyvät vasta ajovalojen valokeilassa.
- **Osumanopeus ratkaisee:**
  - **alle 50 km/h:** kolhu (nykyinen kolhutapahtuma)
  - **50–100 km/h:** nykyinen peuratapahtuma (omavastuu, mikrobetoni tai jätetään korjaamatta, 40 %:n lunastusmahdollisuus)
  - **yli 100 km/h:** **pakollinen lunastus.** Vakuutus maksaa markkina-arvon tai uusarvon, laina kuitataan siitä ja yli jäävä velka siirtyy jäännösvelaksi (`S.residual`), kuten nykyisessä lunastuksessa.
- **Lunastuksen jälkeen** pelaaja hinataan autoliikkeeseen. Jos hän ei pysty ostamaan eikä rahoittamaan uutta autoa ja hänellä ei ole muuta toimivaa autoa eikä työsuhdeautoa, **peli päättyy** (”LUNASTETTU JALANKULKIJAKSI”). Päättymisruutu näyttää velat ja vankilatilanteen samaan tapaan kuin `endGame()`.
- Työsuhdeautolla kova peurakolari menee `tsaDamage`-polun kautta (sijaisauto Skoda Scala). Työsuhdeautoa ei lunasteta pelaajalta.

## 3. Lataus, tankkaus, myöhästyminen ja YT-uhka

- **HUD:** akku- tai polttoainemittari. Kulutus riippuu autosta: `S`-lippu (lyhyt toimintamatka), akun kunto (`soh`), talvi ja vauhti.
- **Asemat tien varressa:** latausasemia ja huoltoasemia. Pysähdys vie aikaa. Pysähdyksen aikana kello juoksee ja muut autot ohittavat.
- **Huonorangeiset autot** (S-lippu tai `soh` alle 80 %) joutuvat lataamaan kesken työmatkan. Silloin ruudulle tulee **”OLET MYÖHÄSSÄ PALAVERISTA!”** ja myöhästelylaskuri nousee.
- Jos akku tai tankki loppuu kesken, auto hinataan. Hinaus maksaa 250 €, ja pelaaja myöhästyy varmasti.
- **YT-mittari HUDissa:** myöhästelyt ja pomolle ilmoitetut kolhut (`S.boss`) nostavat sitä, ja mittari syöttää lomautuksen painoon `randomEvent`issa. Nykyinen `shortCommute()`-oletus korvautuu oikeilla latausstopeilla.
- **Kulut:** kuukauden ajokulut pysyvät `runCosts()`:ssa, jotta pelin tasapaino pysyy. Pysähdys maksaa aikaa ja YT-riskiä, ei erikseen rahaa. Poikkeuksena työsuhdeauton käyttöedun sijaisauton dieselit.

## 4. Autoliikkeet tien varressa

- **Mainostaulut** näyttävät tarjouksia, esimerkiksi ”MG4 – ylihyvitys 12 000 €!”. Tarjoukset tulevat kampanjoista (`S.camp`) ja liikkeen tarjonnasta (`genStock`).
- **Liikkeen pihaan kääntyminen** avaa nykyisen `carDetail`in ja rahoituksen. Jos pelaaja ostaa auton, hän jatkaa matkaa uudella autolla: ajo-ominaisuudet ja kuva vaihtuvat heti.
- Huutokaupat, myynti ja sivutulot ovat vain liittymän takana valikossa.

## 5. Wolt- ja taksikeikat tiellä

- **Päälle ja pois** samasta valikosta kuin 1.0:ssa (Sivutulot). Kun keikat ovat päällä, tien varressa näkyy noutopisteitä.
- **Wolt:** pysähdy ravintolan kohdalle, jolloin ruokalaukku lähtee kyytiin. Toimita se merkitylle kohdalle aikarajan sisällä.
  - Ajoissa: 15–40 €.
  - Myöhässä: puolet palkkiosta.
  - Kova jarrutus tai kolhu matkalla: ”keitto kaatui”, ei palkkiota.
- **Taksi** (vaatii taksiluvan ja kelpaavan sähköauton, kuten `taxiOK`): asiakas viittoo tien varressa. Kyyti on pidempi ja tuottaa 50–110 €. Asiakas antaa tähtiä ajotavan mukaan, ja huonoista tähdistä seuraa vähemmän kyytejä.
- Keikat kuluttavat autoa samoin kuin 1.0:ssa (renkaat, akku, arvo) ja lisäävät sakkoriskiä.
- Kuukauden keikkatulot näkyvät tiliotteessa samoilla riveillä kuin 1.0:ssa. Pimeät muuttokeikat pakettiautolla jäävät kuukausituloiksi.

## 6. Auton ominaisuudet ajossa

Ominaisuudet johdetaan nykyisistä `CARS`-tiedoista, joten uutta autotietokantaa ei tarvita:

- **Huippunopeus ja kiihtyvyys:** hinnasta ja tyypistä (Tesla vetää, Dacia Spring ei, Mondeo yskii).
- **Toimintamatka:** tyypistä, `S`-lipusta ja akun kunnosta (`soh`).
- **Korjaamattomat viat (`car.minor`):** näkyvät ajossa, esimerkiksi auto vetää sivulle tai savuttaa.
- **Mikrobetonipaikat (`mb`):** näkyvät autossa harmaina läikkinä.
- **Työsuhdeauto:** sillä ajetaan normaalisti. Korjauksen ajan alla on vara-Skoda Scala.
- **Ei toimivaa autoa, mutta peli jatkuu** (esim. auto korjaamolla): pelaaja istuu bussissa. Bussi kulkee automaattisesti, kuukaudet kuluvat ja taksit ja bussit maksavat 850 €/kk kuten 1.0:ssa.

## 7. Ulkoasu, ohjaus ja ääni

- **Grafiikka:** canvasilla piirretty pseudo-3D-tie (segmenttitie, joka kaartuu ja mäkeilee). Kuva piirretään 320×200-resoluutiolla ja skaalataan pikselintarkasti. Värit ovat samat C64-värit kuin 1.0:ssa.
- **Oma suomalainen maisema:** männyt, peltoaukeat, lumipenkat talvella, kaamospimeä, valtatien kyltit sekä brändittömät marketit ja asemat. Tyylilaji on retroajopeli, mutta kaikki grafiikka, äänet ja reitti ovat omia.
- **Ohjaus:**
  - Tietokoneella nuolet tai A/D ohjaavat, ylös/W kaasuttaa ja alas/S tai välilyönti jarruttaa.
  - Puhelimessa ruudun vasen ja oikea puolisko ohjaavat, alareunan nappi jarruttaa ja kaasu on automaattinen.
  - Pikavalinnat valitaan näppäimillä 1–3 tai napauttamalla.
- **Ääni:** WebAudio-piippaukset SID-henkeen, sammutettavissa.

## 8. Tekninen rakenne

```
/index.html         1.0, ennallaan
/v2/index.html      2.0:n sivu: ruudut, HUD ja canvas
/v2/engine.js       1.0:n pelilogiikka kopiona (monthTick, tapahtumat, autoliike, rahoitus…)
/v2/drive.js        ajotila: tie, ohjaus, esteet, asemat, keikat, liikkeet
```

- **2.0 on haara 1.0:sta.** `engine.js` aloitetaan kopiona 1.0:n logiikasta, ja sitä muutetaan vapaasti, joten 1.0 ei voi rikkoutua 2.0:n muutoksista. Huono puoli: jos 1.0:aan tehdään korjauksia (kuten Scala-korjaus), ne pitää viedä 2.0:aan käsin.
- **Kytkentä:** moottori ja ajotila kytketään muutamalla kohdalla:
  - `paalaan()` → `Drive.start()`
  - ajotila kutsuu kuukauden vaihtuessa `monthTick()`iä ja törmäyksissä `damageEvent()`iä
  - `next()`/`Q`-jono osaa palata tielle valikon sijaan
- **Kehitys:** 2.0:n kehitys tehdään omassa haarassaan. Jokainen vaihe yhdistetään `main`iin pull requestilla, jolloin se julkaistaan `/v2/`-osoitteeseen. 1.0:n osoite ei muutu.
- Ei ulkoisia kirjastoja. VT323-fontti ladataan kuten nyt.
- **Versionumero** näkyy alapalkissa muodossa ”2.0 alpha N (pvm klo)”.

## 9. Toteutusjärjestys

1. **Tieprototyyppi:** tie, ohjaus, peurat, kuukausien vaihtuminen (30 s) ja liittymä takaisin valikkoon. Julkaistaan heti `/v2/`:een testattavaksi.
2. **Tapahtumat:** törmäykset vahingoiksi, nopeusriippuvainen lunastus ja pelin päättyminen, pikavalinnat ja jono.
3. **Energia:** mittari, lataus- ja huoltoasemat, myöhästymiset ja YT-mittari.
4. **Autoliikkeet ja mainostaulut tien varressa.**
5. **Wolt- ja taksikeikat.**
6. **Viimeistely:** vuodenajat, pimeys, äänet, puhelinohjaus ja tasapainotus.
