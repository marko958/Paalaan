# PAALAAN! – kehitysideoita (lisää optimoitavaa pelaajalle)

> **Toteutettu 2.0 alpha 17:ssä** (yksinkertaistettuina): energiamittari ja latausasemat, vetomassat, kärrytyypit ja ajokortit (B/B96/BE), romukeikat autotrailerilla, dieselin DPF-tukos kärryn kanssa (60 %), kahdet renkaat / toiset vanteet ja rengashotellin sekoittamat porrastetut kiekot, 0 %-kampanjat vs. käteisalennus, romutuspalkkio ja polttomoottoriautojen jälkimarkkina, reissut (Kuopio, Levi, harmaatuonti Saksasta). 
>
> **1.0 (beta v32):** samat ideat tekstinä niiltä osin kuin ajotilaa ei tarvita: kahdet renkaat ja hotellin kiekkojokeri, 0 %-kampanjat, romutus ja polttomoottorimarkkina, reissut (vauhti valitaan, peli laskee lataukset, ajan ja sattumukset). 1.0:ssa ei ole peräkärryä, joten vetomassat ja DPF ovat vain 2.0:ssa.
>
> Alla alkuperäiset ideat; toteutus poikkeaa niistä paikoin.

Ideat on kirjoitettu 2.0:n päälle: ne käyttävät olemassa olevia rakenteita (`S.trailer`, `towOK`, `tireSwap`, `tireEvent`, `CAMPAIGNS`, `rateOffers`, `S.rate`, `runCosts`, `drive.js`:n `limitOf`). Jokaisessa on sama kaava: **pelaajalla on kaksi tai kolme järkevää vaihtoehtoa, eikä yksikään voita aina.** Paras valinta riippuu autosta, vuodenajasta, kassasta ja lainasta.

Pääpaino on kohdassa 3 (energiamittari): useimmat ideat tarvitsevat sitä, joten sen tekeminen kannattaa aikaistaa.

---

## 1. Vetomassat

Nyt kärryn kanssa on vain kyllä/ei (`NO_TOW`). Tehdään siitä numeroita:

- `CARS`-riville uusi kenttä **suurin sallittu perävaunun massa (kg)**: Mondeo 1 500, V70 D5 1 800, Model Y 1 600, e-tron 55 1 800, EV6 1 600, MG4 0 → 500 (lisävaruste), Proace Max 0 (paku), Spring 0.
- **Kärrytyypit** Huutokaupat.comissa:
  - kevyt kärry 750 kg (ei jarruja, B-kortti riittää aina)
  - jarrullinen 1 300 kg (isommat muuttokeikat, parempi palkkio)
  - autotrailer 2 000 kg (ks. kohta 4 *Romuralli*)
  - asuntovaunu (Lapin reissu, ks. kohta 2)
- **Kortti:** B-kortilla auto + vaunu yhteensä enintään 3 500 kg. Raskaampi yhdistelmä vaatii **B96-koulutuksen** (n. 300 €, vie liittymän verran aikaa) tai **BE-kortin** (n. 900 €).
- **Ylikuorma:** muuttokeikka voi olla painavampi kuin kärryn tai auton raja. Valinta: ota keikka silti (poliisin punnitus = rikesakko + kuorma jätetään tienvarteen, ei palkkiota) tai kieltäydy.
- **Ajossa:** vetomassa nostaa kulutusta. Sähköautolla kärry lyhentää toimintamatkaa 30–50 %, polttomoottorilla kulutus nousee 20–30 %. Mäet hidastavat, jarrutusmatka pitenee ja kärry heiluu yli 80 km/h.
- **Diesel ja kärry = tukkeutunut DPF:** kun dieselillä (`D`-lippu) vedetään kärryä, hiukkassuodatin (DPF) tukkeutuu **60 %:n todennäköisyydellä** per kärrykeikka/reissu. Seuraus: vikavalo, auto menee vikatilaan (vääntö pois, max 60 km/h) ja keikka myöhästyy. Korjausvaihtoehdot: regenerointi ja puhdistus korjaamolla (400–600 €), uusi suodatin (1 500–2 500 €) tai laiton DPF-poisto (halpa, mutta katsastus hylkää ja poliisi voi sakottaa).
- **Optimoitavaa:** iso kärry tuo enemmän per keikka, mutta vaatii vetokykyisen sähköauton, kortin ja latausstopit. Polttomoottorilla vetäminen näyttää halvalta, mutta DPF syö edun: pelin linja pysyy, eli sähköauto on oikea vetoauto, ja pelaaja oppii laskemaan latausstopit kärryn kanssa.

## 2. Lapin reissu (hiihtoloma)

Kerran vuodessa (helmi–maaliskuussa) tulee tarjous: **”Hiihtoloma Levillä, mökki varattu”**. Matka kestää yhden kuukauden ajon, ja tie vaihtuu Lapin tieksi (pitkät suorat, porot, kaamos, −30 °C, latausasemia harvassa).

- **Vaihtoehdot:**
  1. omalla autolla
  2. vuokra-autolla (kallis, mutta oma auto ei kulu)
  3. junalla, auto mukaan autojunassa (kallis ja varma, ei ajoa)
  4. jäädään kotiin (ilmainen, mutta perhe on vihainen: seuraava kuukausi ilman sivutuloja)
- **Oma auto -vaihtoehdossa:**
  - Sähköauton toimintamatka putoaa pakkasessa. Ilman lämpöpumppua (`NO_HEATPUMP`) pudotus on vielä isompi, ja lämmitysvika (`HEATER`) tekee autosta ajokelvottoman.
  - Latausasemat ovat 150–250 km:n päässä toisistaan, ja osa on rikki tai jonossa. Jos akku loppuu, tulee hinaus Rovaniemelle 600 € ja reissu jää kesken.
  - Polttomoottori ei ole oikotie: tankkaus on kallis, diesel hyytyy −30 °C:ssa, jos tankissa on kesädieseliä, ja lyhyiden kaupunkiajojen jälkeen DPF on valmiiksi puolitukossa. Peli palkitsee sähköautolla onnistuneen reissun (bonus), ei polttomoottorilla ajettua.
  - **Porot** tiellä: eivät väistä, seisovat tiellä ja pysäyttävät liikenteen. Kolari maksaa enemmän kuin peura, ja paliskunta laskuttaa.
- **Palkinto:** reissun onnistuminen antaa ”loma-bonuksen” (esim. pomo-mittari `S.boss` laskee tai YT-riski pienenee seuraavaksi vuodeksi). Lisäksi Lapista voi ostaa halvan käytetyn auton (lappilaiset myyvät nelivetoja edullisesti keväällä).

## 3. ”5 h + paljon kamaa” – pitkän matkan haaste

Tämä on käytännössä kohdan 2 ja energiamittarin (SUUNNITELMA-2.0, kohta 3) yhdistelmä ja oma tehtävätyyppinsä:

- Tarjous: **”Vie anopin tavarat Kuopioon, 400 km, aikaa 5 h, palkkio 500 €”** (tai sukujuhlat, mökkimuutto).
- **Kuorma valitaan:** katteelle boksi, peräkärry tai paku. Jokainen vaihtoehto syö toimintamatkaa eri verran:
  - kattoboksi: +15 % ilmanvastus, sähköautolla isoin vaikutus moottoritievauhdissa
  - peräkärry: max 80 km/h, mutta toimintamatka −35 %
  - pakettiauto: vuokra 120 €/vrk, ei kulumista omaan autoon
- **Optimointi:** ajonopeus vs. kulutus. 120 km/h on nopein mutta vaatii ehkä kolmannen latausstopin; 90 km/h pärjää kahdella. HUD näyttää arvioidun saapumisajan ja akun riittävyyden (GPS-vika piilottaa sen, kuten alpha 15:ssä).
- **Latausstopit:** 150 kW:n asema on 2 km sivussa (kääntyminen maksaa minuutteja), 50 kW:n asema on tien varressa. Asemalla voi olla jono. Kärryn kanssa moni asema ei mahdu, ja kärry pitää irrottaa.
- **Lopputulos:** ajoissa = täysi palkkio; myöhässä = puolet; tavarat rikki (kova jarrutus, kärry ojaan) = korvaat itse.

## 4. Polttisvehkeen arvo vs. romutuspalkkio

Pelaajan Mondeo (tai Astra, Avensis) on kohta vain kuluerä. Nyt ainoa vaihtoehto on myydä tai vaihtaa. Lisätään **romutuspalkkiokampanja** omaksi tapahtumakseen:

- **Valtion romutuspalkkio:** ”Romuta yli 10 vuotta vanha polttomoottoriauto ja saat 2 000 € (2 500 €, jos ostat täyssähköauton)”. Voimassa 2–3 kuukautta, ja raha voi loppua kesken (”määräraha käytetty” – kuka ehtii ensin).
- **Merkkiliikkeen romutusbonus:** ”Tuo mikä tahansa vanha auto, saat 3 000 € uuden MG4:n hinnasta”. Ei voi yhdistää ylihyvityskampanjaan (`S.camp`).
- **Dilemma:** pelaajan pitää vertailla
  - vaihtoauton hyvitystä (`val(car)*0.88`) ja mahdollista ylihyvitystä
  - yksityismyyntiä Marketplacessa (parempi hinta, mutta vie aikaa ja ostaja voi tulla takaisin)
  - romutuspalkkiota (varma summa, ei riippuvainen auton kunnosta)
  - **pitämistä** kakkosautona: houkutteleva (vetokoukku, ”varmuus pakkasella”), mutta peli tekee siitä huonon kaupan: vakuutus, käyttövoimavero ja katsastus juoksevat, auto hajoaa seistessään, DPF tukkeutuu kärryn kanssa ja romutuspalkkion määräraha voi loppua odotellessa
- **Lisämauste – polttomoottorin jälkimarkkina vaihtelee:** tapahtuma ”Ukrainan/Afrikan vientikysyntä” nostaa vanhojen dieselien hintaa 30 %, ja ”käyttövoimaveron korotus” painaa sitä alas. Pelaajan kannattaa ajoittaa myynti, aivan kuten Teslan osakkeiden kanssa (`S.inv`).
- **Romuralli-sivutulo:** autotrailerilla voi hakea romuja autopurkamoon (50–150 €/auto). Vaatii jarrullisen trailerin ja vetokykyisen auton (kohta 1).

## 5. Uusien autojen 0 %:n korkokampanjat

Nyt `rateOffers` antaa uudelle autolle 60 %:n todennäköisyydellä 0 %:n koron. Tehdään siitä oikea ansa ja oikea mahdollisuus:

- **0 % ei ole ilmainen:** 0 %:n korolla ei saa käteisalennusta eikä ylihyvitystä. Valinta liikkeessä:
  - **A:** 0 % korko, listahinta, avausmaksu 390 € ja tilinhoito 12 €/kk
  - **B:** 4,9 % korko, mutta 4 000 € käteisalennus
  - Peli näyttää kummankin **kokonaishinnan** (maksut yhteensä), jotta pelaaja voi laskea. Lyhyellä lainalla A voittaa, pitkällä B.
- **Jäännösarvo (jämäri) + 0 %:** pieni kuukausierä, mutta iso viimeinen erä. Jos auton arvo on silloin alle jämärin, pelaaja on veden alla. Tämä on se, mikä vie vankilaan (`endGame`).
- **Kampanja ajoittuu:** 0 %:n kampanjat tulevat kvartaalin lopussa (maalis-, kesä-, syys- ja joulukuu), kun liikkeet tekevät tavoitteitaan. Mainostaulut tien varressa (SUUNNITELMA-2.0, kohta 4) kertovat niistä etukäteen: pelaaja voi odottaa, mutta silloin vanha auto ehtii hajota.
- **Korkoympäristö:** kun `S.rate` nousee, 0 %-kampanjoita tulee enemmän (valmistaja tukee myyntiä), mutta käteisalennukset pienenevät. Kun korot laskevat, 0 %:n etu häviää.
- **Pienellä präntätty:** osa kampanjoista vaatii **pakollisen huoltosopimuksen** (+60 €/kk) tai **merkkivakuutuksen**, joka on kalliimpi kuin pelaajan oma.

## 6. Kahdet renkaat -dilemma: ostetaanko toiset vanteet?

Ydinkysymys on **vanteet**, ei pelkät renkaat. Jos autossa on vain yhdet vanteet, kesä- ja talvirenkaat vaihdetaan samoille vanteille joka kerta. Silloin vaihto on rengastyötä: vanhat renkaat puretaan vanteilta, uudet asennetaan ja pyörät tasapainotetaan. Pihalla tunkilla sitä ei tehdä.

**Valinta tehdään kerran per auto** (auton oston yhteydessä tai ensimmäisessä renkaanvaihdossa):

| | Yhdet vanteet | Toiset vanteet |
|---|---|---|
| Hankinta | 0 € | **400–1 200 €** (peltivanteet halvat, sähköauton isot alumiinivanteet kalliit; Taycanin ja i4 M60:n vanteet vielä kalliimmat) |
| Vaihto keväällä ja syksyllä | **rengastyö 120–220 €**: purku, asennus ja tasapainotus | rengashotelli 90 € tai **itse 0 €** |
| Itse vaihtaminen | **ei mahdollista** (vaatii rengaskoneen) | mahdollinen (nykyinen ”Vaihda itse” ja löysän mutterin riski 15 %) |
| Ajoitus | rengasliikkeen jonot: lokakuun ensilumella aikaa saa vasta 2–3 viikon päähän (ks. alla) | pyörät vaihdetaan samana päivänä |
| Kuluminen | jokainen purku voi vaurioittaa rengasta tai vannetta (pieni riski: ”vanne naarmuuntui koneessa”, ”rengas ei pidä ilmaa”) | ei purkuja |
| Auton myynti | ostaja saa yhdet vanteet ja irtorenkaat | **”kahdet renkaat vanteilla”** nostaa myyntihintaa 400–800 €, tai vanteet myydään erikseen Marketplacessa |

- **Laskettava pelaajalle:** toiset vanteet maksavat itsensä takaisin 2–5 vuodessa, kun vaihtaa itse, mutta autoa vaihdetaan pelissä usein, joten takaisinmaksu jää usein kesken. Jos vanteet sopivat myös seuraavaan autoon (sama merkki, sama pulttijako ja koko), ne siirtyvät mukana. Tämä on hyvä syy pysyä samassa merkissä.
- **Ensilumen jono:** jos pelaajalla on yhdet vanteet ja hän ei varannut aikaa syyskuussa, lokakuun vaihto viivästyy. Siihen asti ajetaan kesärenkailla: ajotilassa pito on heikko (`S.slip` kasvaa), peura- ja ulosajoriski nousee ja poliisi voi sakottaa marraskuussa. Toisilla vanteilla tämä ei koske pelaajaa.
- **Toteutus nykykoodiin:** autolle lippu `car.rims2`. `tireSwap` näyttää sen mukaan joko vaihtoehdot ”Rengashotelli 90 € / Vaihda itse 0 €” tai ”Rengastyö (purku + asennus + tasapainotus) X €”, jossa X riippuu auton hintaluokasta (`tierMult`) ja sähköautolla isommasta vannekoosta. Lisäksi valinta ”Osta toiset vanteet (Y €)”. Myyntiarvoon lisä, kun `car.rims2` on tosi.
- **Jokeri rengashotellissa:** porrastetuissa (staggered) kiekoissa edessä on kapeammat ja takana leveämmät. Hotelli voi sekoittaa ne: alle menee kolme leveää ja yksi kapea, auto vaeltaa ja ESP vilkkuu. Korjaus: hae oikeat hotellilta (työpäivä jää kesken) tai osta naamakirjasta kolme kapeampaa.
- **Lisämauste (myöhemmin):** talvirenkaiksi nastat, kitkat tai ympärivuotiset. Ympärivuotiset poistavat koko vannedilemman, mutta talven pito on heikompi ja kesällä kuluminen nopeampaa.

## 7. Keski-Euroopan kitkat -haaste

Uusi kampanja-/tehtävätapahtuma, joka yhdistää renkaat, toimintamatkan ja harmaatuonnin:

- **Tapahtuma:** ”Saksasta löytyi halpa käytetty Taycan/Model Y, 8 000 € halvempi kuin Suomessa. Hae se itse.”
- **Haaste:** pelaaja lentää Saksaan ja ajaa auton kotiin (Travemünde–Helsinki-lautta tai ajo Ruotsin kautta). Matka on kaksi kuukautta ajoa ja tie on Autobahn: **ei nopeusrajoitusta**, joten sähköauto kuluttaa 200 km/h:ssa akun hetkessä.
- **Talvirengasongelma:**
  - Saksassa **nastat ovat kiellettyjä**. Auto tulee kesä- tai kitkarenkailla.
  - Pohjois-Ruotsissa ja Suomessa on joulu–maaliskuussa jäätä: kitkoilla pärjää, kesärenkailla ei.
  - Pelaajan pitää valita: ostaa kitkat Saksasta (halvempi, mutta auton mukana pitää kuljettaa omat nastat jälkikäteen), ajaa kitkoilla koko talven tai ottaa nastat matkalaukussa (ylimääräinen matkatavaramaksu 150 €).
- **Harmaatuonnin kitkat (toisessa merkityksessä):**
  - autovero Traficomille: arvioidaan auton arvosta, voi yllättää (”Tulli arvioi auton arvon 4 000 € korkeammaksi”)
  - auton vastaanottotarkastus ja rekisteröinti: auto seisoo kuukauden
  - takuu ei välttämättä päde Suomessa (vrt. Lucid Air: huolto vain Saksassa)
  - kilometrimittari voi olla viilattu (pieni riski: auton arvo romahtaa myöhemmin, kun asia paljastuu)
- **Palkinto:** onnistuneesti tuotu auto on 4 000–8 000 € alle Suomen hinnan. Epäonnistunut tuonti (vero, vika, kitkat ja jää) voi syödä koko säästön.

---

## Mitä kannattaisi tehdä ensin

1. **Energiamittari ja latausasemat** (SUUNNITELMA-2.0, kohta 3). Ilman sitä vetomassat, kattoboksi, Lapin reissu ja Autobahn eivät tunnu ajossa.
2. **Kahdet renkaat (toiset vanteet)** – pienin työ: yksi lippu `car.rims2` ja muutos `tireSwap`iin. Tuo heti uuden päätöksen kahdesti vuodessa.
3. **0 %:n kampanjan kokonaishintavertailu** – pieni muutos `rateOffers`- ja `finance`-funktioihin, mutta isompi vaikutus siihen, miten pelaaja ajattelee rahoitusta.
4. **Romutuspalkkio** – yksi uusi tapahtuma `randomEvent`iin ja vaihtoehto myyntivalikkoon.
5. **Vetomassat** – uusi kenttä `CARS`-dataan ja kärrytyypit.
6. **Pitkät reissut** (5 h + kamaa, Lappi, Saksa) – omat tehtävät, joissa on erilainen tie. Isoin työ, mutta myös isoin uusi sisältö.
