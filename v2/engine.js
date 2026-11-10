// PAALAAN! 2.0 – pelilogiikka (haara 1.0:sta). Ajotila on drive.js:ssä.
'use strict';

// ---------- DATA ----------
// [nimi, hinta, tyyppi(b=polttomoottori,h=hybridi,e=sähkö), kulut €/kk, arvonlasku %/v, liput, vika, vian hinta]
// liput: V=pakettiauto (iso alennus, muuttokeikat), F=ilmaiset superit (halpa ajaa, hajoaa usein), D=diesel (käyttövoimavero), N=uusi liikkeestä, T=Tesla, K=latausluukku (mikrobetoni käy), S=lyhyt toimintamatka (lomautusriski)
const CARS = [
 ['Ford Mondeo 2006',1000,'b',900,.10,'','Katsastus hylkäsi: jarruputket poikki',700],
 ['Opel Astra 2009',1800,'b',780,.08,'','Ruoste puhkesi kynnyksiin',900],
 ['Toyota Avensis 2010',3500,'b',650,.06,'','Jarrulevyt loppu',400],
 ['Toyota Prius 2012',6000,'h',480,.08,'','Hybridiakku väsyi',1800],
 ['Volvo V70 D5 2011',5500,'b',700,.08,'D','Turbo hajosi',1600],
 ['VW Passat TDI 2014',8000,'b',620,.09,'D','DSG-vaihteisto nykii',2200],
 ['Audi A6 quattro 2012',6000,'b',780,.09,'','Vaihdelaatikko hajosi',3000],
 ['BMW 530d 2015',12000,'b',720,.10,'D','Ruiskut vuotavat',2500],
 ['Mitsubishi Outlander PHEV 2016',9000,'h',430,.10,'','Latausakku hiipuu',1500],
 ['Nissan Leaf 2015',5000,'e',160,.12,'S','Akku heikkeni, toimintamatka romahti',1200],
 ['Renault Zoe 2017',4000,'e',250,.12,'S','Laturi hajosi (akkuvuokra juoksee silti)',900],
 ['VW e-Golf 2018',12000,'e',170,.12,'S','Lämpöpumppu hajosi',1100],
 ['BMW i3 2017',11000,'e',190,.13,'S','Hiilikuitukori kolhiintui',2500],
 ['Hyundai Ioniq 2019',14000,'e',150,.10,'','Ilmastointi hajosi',700],
 ['Kia e-Soul 2020',16000,'e',160,.10,'','12V-akku tyhjä',300],
 ['Peugeot e-208 2021',15000,'e',160,.15,'','Latausportti jumissa',600],
 ['Dacia Spring 2022',9000,'e',140,.14,'S','Pelti lommolle ostoskärrystä',800],
 ['Fiat 500e 2021',13000,'e',150,.14,'S','Infotainment pimeni',500],
 ['MG4 2023',18000,'e',170,.20,'','Ohjelmistovika: auto ei käynnisty',900],
 ['VW ID.3 2021',17000,'e',180,.13,'K','Latausluukku irtosi',650],
 ['Tesla Model 3 2019',20000,'e',190,.14,'T','Ovenkahva jumissa ja paneelirako',800],
 ['Tesla Model Y 2022',30000,'e',220,.15,'T','Tukivarsi katkesi',1400],
 ['Kia e-Niro 2021',20000,'e',170,.08,'','Latausyksikkö (OBC) hajosi',1500],
 ['Hyundai Kona 2020',18000,'e',170,.11,'','Akkutakaisinkutsu ja omavastuu',300],
 ['Skoda Enyaq 2022',29000,'e',200,.11,'','Ohjelmistopäivitys meni pieleen',500],
 ['VW ID.4 2022',28000,'e',200,.13,'','Ohjelmistobugit',600],
 ['Hyundai Ioniq 5 2022',32000,'e',210,.13,'','ICCU hajosi',2200],
 ['Kia EV6 2022',30000,'e',210,.12,'','Takaluukun moottori',700],
 ['Polestar 2 2021',27000,'e',220,.16,'','Keskinäyttö pimeni',900],
 ['Ford Mustang Mach-E 2021',30000,'e',230,.15,'','12V-akku tyhjeni taas',400],
 ['BYD Atto 3 2024',25000,'e',180,.18,'','Varaosaa odotetaan Kiinasta',1200],
 ['Volvo XC40 Recharge 2021',30000,'e',260,.13,'','Lasinpyyhkijän moottori ja kallis lasku',1300],
 ['Audi Q4 e-tron 2022',35000,'e',240,.14,'','Matriisivalo hajosi',1800],
 ['Kia EV6 GT (uusi)',70000,'e',320,.18,'N','Renkaat loppu (GT syö kumia)',1600],
 ['BMW i4 M60 (uusi)',80000,'e',340,.19,'N','Renkaat loppu taas',1800],
 ['Porsche Taycan 2021',55000,'e',420,.22,'','Jarrut ja levyt',4500],
 ['Audi e-tron GT 2022',60000,'e',400,.21,'','Ilmajousitus',3800],
 ['BMW iX 2022',55000,'e',330,.20,'','Kamera-anturit sekaisin',1600],
 ['Jaguar I-Pace 2019',25000,'e',300,.22,'','Akkumoduuli, takuu ei kata',6000],
 ['Mercedes EQS 2022',55000,'e',380,.20,'','Hyperscreen pimeni',3000],
 ['Mercedes EQS (uusi)',120000,'e',450,.22,'N','Ilmajousitus',3500],
 ['Mercedes EQS SUV 2023',70000,'e',460,.20,'','Takapyöräohjaus',3200],
 ['Maybach EQS SUV (uusi)',220000,'e',700,.24,'N','Takapenkin hierontatuoli',5000],
 ['BMW i7 2023',75000,'e',480,.21,'','Kattonäyttö jumissa',4000],
 ['Porsche Taycan Turbo S (uusi)',210000,'e',650,.23,'N','Keraamijarrut',9000],
 ['Porsche Macan Electric 2024',70000,'e',380,.17,'','Ohjelmistopäivitys',1500],
 ['Audi RS e-tron GT 2023',85000,'e',450,.21,'','Ilmajousitus',4200],
 ['Tesla Model S Plaid 2022',60000,'e',400,.20,'T','Ruori-ohjaus irtosi',2500],
 ['Lucid Air (harmaatuonti)',130000,'e',520,.24,'','Huolto vain Saksassa',5000],
 ['Lotus Eletre 2024',80000,'e',480,.22,'','Aktiivispoileri jumissa',3000],
 ['Polestar 3 2024',65000,'e',380,.18,'','Ohjelmisto kaatuu',1200],
 ['Rolls-Royce Spectre 2024',380000,'e',1200,.15,'','Tähtitaivas sammui',15000],
 ['Tesla Cybertruck (harmaatuonti)',150000,'e',600,.25,'T','Rekisteröinti evätty, auto seisoo',3000],
 ['Tesla Model S 85 2014 (650 000 km)',11000,'e',70,.10,'TF','Vetoyksikkö (drive unit) jumissa',4000],
 ['Toyota Proace Max EV (uusi)',72000,'e',200,.20,'NV','Takaovien sarana vääntyi muuttokeikalla',900],
];
const GENFAULTS = {
  b: [['Pakoputki irtosi',350],['Jakohihna vaihtoon',900],['Kytkin luistaa',1200],['Moottorin vikavalo palaa',300],['Iskunvaimennin vuotaa',500],['Akku kuoli pakkasella',180],['Näätä söi johtosarjan',700],['Lambda-anturi hajosi',250]],
  h: [['Näätä söi johtosarjan',700],['Akku kuoli pakkasella',180],['Invertterin jäähdytys vuotaa',900],['Moottorin vikavalo palaa',300]],
  e: [['12V-akku tyhjä pakkasella',200],['Näätä söi johtosarjan',700],['Latauspistoke suli',450],['Jarrut ruostuivat kiinni (regeneraatio hoiti jarrutukset)',600],['Ohjelmistopäivitys jumitti auton',300],['Peruutuskameran linssi rikki',250],['Lämpöpumppu vinkuu',800]],
};
const FFAULTS = [['MCU-näyttö pimeni, auto ei käynnisty',1500],['Ovenkahvat eivät tule ulos',400],['Ilmajousitus laski auton maahan',2500],['Latausportin lukko jumissa',300],['Vetoyksikkö ulvoo',4000],['12V-akku kuoli',250]];
// viat, joiden kanssa auto kulkee (muut pysäyttävät auton)
const DRIVABLE = new Set([
 'Ruoste puhkesi kynnyksiin','Jarrulevyt loppu','Hybridiakku väsyi','DSG-vaihteisto nykii','Latausakku hiipuu','Akku heikkeni, toimintamatka romahti',
 'Lämpöpumppu hajosi','Hiilikuitukori kolhiintui','Ilmastointi hajosi','Pelti lommolle ostoskärrystä','Infotainment pimeni','Ovenkahva jumissa ja paneelirako',
 'Ohjelmistopäivitys meni pieleen','Ohjelmistobugit','Takaluukun moottori','Lasinpyyhkijän moottori ja kallis lasku','Matriisivalo hajosi',
 'Renkaat loppu (GT syö kumia)','Renkaat loppu taas','Jarrut ja levyt','Kamera-anturit sekaisin','Hyperscreen pimeni','Takapyöräohjaus',
 'Takapenkin hierontatuoli','Kattonäyttö jumissa','Keraamijarrut','Ohjelmistopäivitys','Aktiivispoileri jumissa','Ohjelmisto kaatuu','Tähtitaivas sammui',
 'Takaovien sarana vääntyi muuttokeikalla',
 'Pakoputki irtosi','Jakohihna vaihtoon','Kytkin luistaa','Moottorin vikavalo palaa','Iskunvaimennin vuotaa','Lambda-anturi hajosi',
 'Jarrut ruostuivat kiinni (regeneraatio hoiti jarrutukset)','Peruutuskameran linssi rikki','Lämpöpumppu vinkuu','Ovenkahvat eivät tule ulos','Vetoyksikkö ulvoo',
]);
// ---------- AKUN HINNAT (pelilukuja) ----------
const BATT = [
 ['Nissan Leaf',6000],['Renault Zoe',0],['VW e-Golf',9000],['BMW i3',9000],['Hyundai Ioniq 2019',8000],['Kia e-Soul',12000],['Peugeot e-208',10000],
 ['Dacia Spring',6000],['Fiat 500e',9000],['MG4',9000],['VW ID.3',12000],['Tesla Model 3',14000],['Tesla Model Y',15000],['Kia e-Niro',13000],
 ['Hyundai Kona',14000],['Skoda Enyaq',15000],['VW ID.4',15000],['Hyundai Ioniq 5',18000],['Kia EV6 GT',22000],['Kia EV6',18000],['Polestar 2',7000],
 ['Ford Mustang Mach-E',20000],['BYD Atto 3',10000],['Volvo XC40',16000],['Audi Q4',18000],['BMW i4 M60',25000],['Porsche Taycan Turbo S',80000],
 ['Porsche Taycan',80000],['Audi RS e-tron GT',60000],['Audi e-tron GT',60000],['BMW iX',30000],['Jaguar I-Pace',25000],['Mercedes EQS SUV',40000],
 ['Mercedes EQS (uusi)',40000],['Mercedes EQS',35000],['Maybach',60000],['BMW i7',40000],['Porsche Macan',30000],['Tesla Model S Plaid',22000],
 ['Lucid Air',50000],['Lotus Eletre',45000],['Polestar 3',15000],['Rolls-Royce Spectre',90000],['Tesla Cybertruck',35000],['Tesla Model S 85',14000],
 ['Toyota Proace',20000],
];
function battCost(k) { const b = BATT.find(([n]) => k.name.startsWith(n)); return b ? b[1] : (k.price > 50000 ? 30000 : 12000); }
// ---------- TAKUUT ----------
function brandWarrYears(k) {
  const n = k.name;
  if (/harmaatuonti/.test(n)) return 0;
  if (/^Kia|^MG/.test(n)) return 7;
  if (/^BYD/.test(n)) return 6;
  if (/^Hyundai/.test(n)) return 5;
  if (/^Tesla/.test(n)) return 4;
  return 3;
}
function modelAge(i) { const k = C(i); if (k.fl.includes('N')) return 0; const y = +(k.name.match(/20\d\d/)||[2024])[0]; return Math.max(0, 2027 + (S.m-1)/12 - y); }
function setWarranty(car, dealer) {
  const k = C(car.c), age = modelAge(car.c), wy = brandWarrYears(k);
  car.warr = S.m + Math.max(0, Math.round((wy - age) * 12));
  car.bwarr = k.type==='e' && wy > 0 ? S.m + Math.max(0, Math.round((8 - age) * 12)) : 0;
  car.dealer = dealer ? S.m + 6 : 0;
  car.ageAtBuy = age;
}
const wVoid = car => car.mb > 0 || car.skip;
const warrLeft = car => Math.max(0, (car.warr||0) - S.m);
const bwarrLeft = car => Math.max(0, (car.bwarr||0) - S.m);
function warrTxt(car) {
  const p = [];
  if (warrLeft(car)) p.push(`tehdastakuu ${warrLeft(car)} kk`);
  if (bwarrLeft(car)) p.push(`akkutakuu ${bwarrLeft(car)} kk`);
  if (car.dealer > S.m) p.push(`liikkeen virhevastuu ${car.dealer - S.m} kk`);
  if (car.ext) p.push(`jatkotakuu ${eur(car.ext)}/kk`);
  let t = p.length ? p.join(', ') : 'ei takuuta';
  if ((warrLeft(car) || bwarrLeft(car)) && wVoid(car)) t += ' (RAUENNUT: ' + (car.mb ? 'mikrobetoni' : 'huolto laiminlyöty') + ')';
  return t;
}
// palauttaa, kuinka suuren osan korjauksesta joku muu maksaa, ja selityksen
function coverage(car) {
  if (warrLeft(car) && !wVoid(car)) return [1, 'Tehdastakuu kattaa korjauksen.'];
  if (car.dealer > S.m) return [0.5, 'Autoliikkeen virhevastuu: liike maksaa puolet.'];
  if (car.ext && !car.mb) return [0.8, 'Jatkotakuu maksaa 80 %.'];
  if (warrLeft(car) && wVoid(car)) return [0, `!Tehdastakuu olisi ollut voimassa, mutta se raukesi (${car.mb ? 'mikrobetoni' : 'huolto laiminlyöty'}).`];
  return [0, ''];
}
const tierMult = k => k.price > 50000 ? 2.5 : k.price > 25000 ? 1.5 : 1;
const C = i => { const a = CARS[i]; return {name:a[0],price:a[1],type:a[2],run:a[3],dep:a[4],fl:a[5],fault:a[6],fcost:a[7]}; };

const TARGETS = [
 {name:'Kia EV6 GT', ids:[33], lvl:'HELPPO', mult:1},
 {name:'BMW i4 M60', ids:[34], lvl:'HELPPO', mult:1},
 {name:'Mercedes EQS', ids:[39,40], lvl:'NORMAALI', mult:1.5},
 {name:'Porsche Taycan', ids:[35,44], lvl:'NORMAALI', mult:1.5},
 {name:'Polestar 3', ids:[50], lvl:'NORMAALI', mult:1.5},
 {name:'BMW i7', ids:[43], lvl:'VAIKEA', mult:2},
 {name:'Audi RS e-tron GT', ids:[46], lvl:'VAIKEA', mult:2},
 {name:'Tesla Model S Plaid', ids:[47], lvl:'VAIKEA', mult:2},
 {name:'Maybach EQS SUV', ids:[42], lvl:'HULLU', mult:3},
 {name:'Rolls-Royce Spectre', ids:[51], lvl:'HULLU', mult:3},
];
const CAMPAIGNS = [[34,23500],[33,12000],[40,18000],[44,25000],[42,30000]];
const KK = ['tammi','helmi','maalis','huhti','touko','kesä','heinä','elo','syys','loka','marras','joulu'];
const LAST = 84;

// ---------- APU ----------
let RND = Math.random;
const rnd = (a,b) => a + RND()*(b-a);
const ri = (a,b) => Math.floor(rnd(a,b+1));
const pick = arr => arr[Math.floor(RND()*arr.length)];
const r100 = n => Math.round(n/100)*100;
const eur = n => Math.round(n).toLocaleString('fi-FI').replace(/ | /g,' ') + ' €';
const pct = n => (Math.round(n*10)/10).toString().replace('.',',') + ' %';
function annuity(L, rm, n, B) {
  B = B||0;
  if (n <= 0) return L;
  if (rm === 0) return (L - B) / n;
  return (L - B / Math.pow(1+rm, n)) * rm / (1 - Math.pow(1+rm, -n));
}

// ---------- TILA ----------
let S;
function newState(t) {
  return {
    m: 1, cash: 1000, income: 700, layoff: 0, vippi: 0, mark: 0,
    cars: [{c:0, base:1000, loan:null, broken:0, mb:0, sale:0}],
    M: {all:1, ev:1, tesla:1}, rate: 0, bubble: 0, spike: 0,
    camp: null, residual: 0, elon: 0, parking: false, pend: [], spikeAmt: 80, jail: 0, tsa: null, boss: 0, gigs: false, black: 0, wolt: false, taxi: false, taxiLic: false, flip: null, inv: {tsla:0, doge:0}, kimppa: false, kimppaPaid: 0, kimppaWon: 0,
    target: t, stock: null, auctionDone: false, log: [], over: false,
  };
}
const sohF = car => (C(car.c).type==='e' && car.soh!==undefined) ? Math.min(1, Math.max(0.5, (car.soh-50)/40)) : 1;
const mult = car => { const k = C(car.c); return S.M.all * (k.type==='e'?S.M.ev:1) * (k.fl.includes('T')?S.M.tesla:1) * sohF(car); };
function genSoh(i) { const k = C(i); if (k.fl.includes('F')) return ri(80,86); if (k.type!=='e' || k.fl.includes('N')) return k.type==='e' ? 100 : undefined; const y = +(k.name.match(/20\d\d/)||[2024])[0]; const age = Math.max(0, 2027 + (S.m-1)/12 - y); return Math.round(Math.max(62, Math.min(100, 100 - age*2.2*(k.fl.includes('S')?1.6:1) - rnd(0,4)))); }
const sohTxt = car => car.soh!==undefined ? ` · akku ${Math.round(car.soh)} %` : '';
// arvo: korjausvähennys enintään 60 % arvosta; pohjana osa- ja romuarvo (12 % mallin hinnasta, väh. 500 €)
const val = car => {
  const raw = car.base * mult(car);
  const ded = Math.min(raw * 0.6, car.broken*0.8 + (car.minor||0)*0.6);
  const floor = Math.max(500, C(car.c).price * 0.12) * S.M.all;
  return Math.max(floor, raw - ded);
};
const working = () => S.cars.filter(c => !c.broken);
const vanOK = () => S.cars.find(c => C(c.c).fl.includes('V') && !c.broken);
const slots = () => S.cars.length + (S.tsa ? 1 : 0);
const totalVal = () => S.cars.reduce((s,c)=>s+val(c),0);
const totalLoan = () => S.cars.reduce((s,c)=>s+(c.loan?c.loan.bal:0),0) + S.vippi + S.residual;
const ownsTarget = () => S.cars.some(c => TARGETS[S.target].ids.includes(c.c));

const shortR = car => C(car.c).fl.includes('S') || (C(car.c).type==='e' && car.soh!==undefined && car.soh < 80);
// ajettava auto: toimintamatkaltaan riittävä ensin, sitten halvin
const driveOrder = () => working().slice().sort((a,b)=>(shortR(a)-shortR(b)) || (C(a.c).run-C(b.c).run));
const drivenCar = () => S.tsa ? null : (driveOrder()[0] || null);
const shortCommute = () => { if (S.tsa) return false; const d = driveOrder()[0]; return d && shortR(d); };

function runCosts() {
  // ajettava auto = toimiva, jolla pienimmät kulut; muut seisovat (vakuutus 40 €)
  const w = S.tsa ? [] : driveOrder();
  let sum = 0, lines = [];
  if (S.tsa) { const T = S.tsa; const r = T.cost + (T.ev && S.spike>0 && T.kind==='käyttö' ? (S.spikeAmt||80) : 0);
    sum += r; lines.push([`Työsuhdeauto ${C(T.c).name}: ${T.kind}etu${T.kind==='käyttö'?' + omat ${T.ev?"lataukset":"tankkaukset"}':''}`, r]); }
  S.cars.forEach(car => {
    const k = C(car.c);
    if (car === w[0]) {
      let r = k.run + (k.type==='e' && S.spike>0 && !k.fl.includes('F') ? (S.spikeAmt||80) : 0);
      sum += r; lines.push([`Käyttökulut: ${k.name}`, r]);
    } else { sum += 20; lines.push([`Seisonnassa (vakuutus puolitettu, ei veroa): ${k.name}`, 20]); }
  });
  S.cars.forEach(car => { if (car.ext) { sum += car.ext; lines.push([`Jatkotakuu: ${C(car.c).name}`, car.ext]); } });
  if (S.parking) { sum += 105; lines.push(['Kolme autopaikkaa (pysäköit keskimmäiseen)', 105]); }
  if (!w.length && !S.tsa) { sum += 850; lines.push(['Ei toimivaa autoa: taksit ja bussit', 850]); }
  return {sum, lines};
}

// ---------- KUUKAUSIKÄSITTELY ----------
let Q = [];
function monthTick() {
  const R = []; // raportti
  const inc = S.layoff>0 ? Math.round(S.income/2) : S.income;
  R.push(['+', `Autobudjetti${S.layoff>0?' (LOMAUTETTU)':''}`, inc]);
  if (S.layoff>0) S.layoff--;
  let cash = S.cash + inc;
  S.cars.forEach(car => { if (car.loan) { cash -= car.loan.pay; R.push(['-', `Lainan erä: ${C(car.c).name}`, car.loan.pay]); }});
  const rc = runCosts(); rc.lines.forEach(l => R.push(['-', l[0], l[1]])); cash -= rc.sum;
  if (S.gigs) {
    const van = vanOK();
    if (van) { const g = ri(2,7)*100; cash += g; S.black += g; van.tire -= 1; van.base *= 0.995; R.push(['+', 'Pimeät muuttokeikat (käteinen, ei kirjanpitoon)', g]); }
    else R.push(['!', 'Muuttokeikat jäivät väliin: pakettiauto ei ole ajokunnossa', 0]);
  }
  const dc = drivenCar();
  if (S.wolt) { if (dc) { const w = ri(15,40)*10; cash += w; dc.base *= 0.996; dc.tire -= 1; if (dc.soh!==undefined) dc.soh -= 0.15; R.push(['+', 'Wolt- ja Foodora-keikat', w]); } else R.push(['!', 'Wolt-keikat jäivät väliin: ei autoa', 0]); }
  if (S.taxi) { if (taxiOK(dc)) { const w = ri(50,110)*10; cash += w; dc.base *= 0.985; dc.tire -= 2; if (dc.soh!==undefined) dc.soh -= 0.4; R.push(['+', 'Taksin ajo (verotettu)', w]); } else R.push(['!', 'Taksi seisoi: ajossa ei ole taksiksi kelpaavaa autoa', 0]); }
  if (S.flip) { S.flip.left--; if (S.flip.left<=0) { const f = S.flip; S.flip = null; cash += f.sale; R.push([f.sale>=f.cost?'+':'!', `Flippikohde ${f.name} myyty (${f.sale>=f.cost?'voittoa':'tappiota'} ${eur(Math.abs(f.sale-f.cost))})`, f.sale]); } }
  if (S.inv.tsla) S.inv.tsla = Math.max(0, S.inv.tsla * (1 + rnd(-0.11, 0.13)));
  if (S.inv.doge) S.inv.doge = Math.max(0, S.inv.doge * (1 + rnd(-0.28, 0.32)));
  if (S.kimppa) {
    cash -= 15; S.kimppaPaid += 15; R.push(['-','Sähköautomiesten kimppa-Eurojackpot',15]);
    const x = RND();
    let w = 0;
    if (x < 1/20000) w = 150000; else if (x < 1/400) w = 2000; else if (x < 1/10) w = ri(1,6)*5;
    if (w) { cash += w; S.kimppaWon += w; R.push(['+', w>=150000?'JÄTTIPOTTI!!! Kimpan osuus':'Kimpan voitto', w]);
      if (w>=150000) Q.push(()=>scr('JÄTTIPOTTI!', ['+Sähköautomiesten kimppa osui. Osuutesi on 150 000 €.','Kassa ei ole ikinä näyttänyt tältä.'], [['Hyvä!', next]])); }
  }
  if (S.vippi>0) { const k = S.vippi*0.20; S.vippi += k; R.push(['-','Pikavipin korko 20 %/kk (lisätty vippiin)', k]); }
  if (cash>0 && S.vippi>0) { const p = Math.min(cash, S.vippi); cash -= p; S.vippi -= p; R.push(['-','Pakkolyhennys pikavippiin', p]); }
  if (cash<0 && invTotal()>0) R.push(['!','KASSA MIINUKSELLA: päätä seuraavaksi, realisoidaanko sijoituksia', -cash]);
  else if (cash<0) { const v = -cash + 60; S.vippi += v; cash = 0; S.mark = 12; R.push(['!','PIKAVIPPI MYÖNNETTY (sis. avausmaksu 60 €)', v]); }
  S.cash = cash;
  if (S.mark>0) S.mark--;
  if (S.tsa) { S.tsa.left--; if (S.tsa.left<=0) Q.push(()=>tsaReturn('SOPIMUS PÄÄTTYI', 'Työsuhdeauton sopimus päättyi.', true)); }
  if (totalLoan() > totalVal() && totalLoan() > 0) S.jail++;
  // lainat lyhenevät
  S.cars.forEach(car => {
    const L = car.loan; if (!L) return;
    const it = L.bal*L.r; L.bal = Math.max(0, L.bal + it - L.pay); L.n--;
    if (L.n<=0) {
      if (L.bal > 1) {
        const b = L.bal;
        if (S.cash >= b) { S.cash -= b; car.loan = null; Q.push(()=>scr('JÄMÄRI ERÄÄNTYI', [`${C(car.c).name}: jämäri ${eur(b)} maksettiin kassasta.`], [['Jatka', next]])); }
        else { L.r = 0.08/12; L.n = 36; L.pay = annuity(L.bal, L.r, 36); Q.push(()=>scr('JÄMÄRI ERÄÄNTYI', [`!${C(car.c).name}: jämäri ${eur(b)} erääntyi, eikä kassa riittänyt.`, `Rahoitusyhtiö jatkorahoitti sen 36 kk:lle 8 %:n korolla. Uusi erä on ${eur(L.pay)}/kk.`], [['Voi ei', next]])); }
      } else car.loan = null;
    }
  });
  // arvonlasku ja myynnit
  S.cars.forEach(car => {
    const k = C(car.c);
    car.base *= (1 - k.dep/12 * (car === drivenCar() ? 1 : 0.6)) * (car.broken ? 0.99 : 1); // seisonnassa ei kerry kilometrejä
    car.base = Math.max(car.base, 300 / Math.max(0.3, mult(car)));
  });
  // akun heikkeneminen
  S.cars.forEach(car => {
    const k = C(car.c);
    if (k.type !== 'e') return;
    if (car.soh === undefined) { car.soh = 100; car.held = 0; }
    if (car.battFail && !car.broken) { car.soh = 100; car.held = 0; car.battFail = false; car.w85 = car.w80 = false; }
    car.held++;
    car.soh -= (0.05 + 0.006*car.held) * (k.fl.includes('S') ? 1.6 : k.fl.includes('F') ? 1.3 : 1);
    if (car.soh < 85 && !car.w85) { car.w85 = true; Q.push(()=>say('AKKU HEIKKENEE', [`${k.name}: akun kunto ${Math.round(car.soh)} %.`, '!Talviaamuna toimintamatka näytti huolestuttavan pientä. Heikkeneminen kiihtyy, mitä pidempään autoa pitää.', 'Nyt olisi hyvä hetki miettiä myyntiä, kun arvo vielä pysyy.'])); }
    if (car.soh < 80 && !car.w80) { car.w80 = true; Q.push(()=>say('AKKU ROMAHTAA', [`${k.name}: akun kunto ${Math.round(car.soh)} %.`, '!Työmatka vaatii nyt latausstopin. Myöhästelyt nostavat lomautusriskiä, ja auton arvo laskee jyrkästi.', `!Alle 72 %:ssa akku menee vikatilaan: uusi akku maksaa ${eur(battCost(k))}.`])); }
    if (car.soh < 72 && !car.battFail && !car.broken) Q.push(()=>batteryFail(car));
    else if (!car.battFail && !car.broken && RND() < 0.0012) Q.push(()=>{ if (S.cars.includes(car)) say('YLLÄTTÄVÄ AKKUVIKA', [`${k.name}: kennomoduuli petti varoittamatta. Akun kunto ei liittynyt asiaan.`]); batteryFail(car); });
  });
  S.cars.slice().forEach(car => { if (car.sale>0) { car.sale--; if (car.sale===0) Q.push(()=>privateSaleDone(car)); }});
  // markkinat
  if (S.bubble>0) { S.M.all *= 1.04; S.bubble--; if (S.bubble===0) { S.M.all *= 0.70; Q.push(()=>scr('HINTAKUPLA PUHKESI!', ['!Käytettyjen autojen hinnat romahtivat noin 30 %.','Laina ei romahtanut.'], [['Auts', next]])); } }
  else S.M.all += (1-S.M.all)*0.06;
  S.M.ev += (1-S.M.ev)*0.08; S.M.tesla += (1-S.M.tesla)*0.06;
  if (S.spike>0) S.spike--;
  if (S.elon>0) S.elon--;
  if (S.slip>0) S.slip--;
  if (S.boss>0 && S.m%12===0) S.boss--;
  if (S.camp && S.m > S.camp.until) S.camp = null;
  S.stock = null; S.auctionDone = false;
  // ajoneuvovero helmikuussa
  // ajoneuvovero kuukausittain vain ajossa olevasta autosta (seisonta pysäyttää veron)
  { const d = drivenCar(); if (d) { const k = C(d.c); const tax = Math.round((k.type==='e' ? (k.price>50000?450:200) : k.type==='h' ? 150 : 300 + (k.fl.includes('D')?450:0)) / 12);
    S.cash -= tax; fixNeg(); R.push(['-', `Ajoneuvovero: ${k.name}`, tax]); } }
  if (S.insPlus && S.cars.length) { const d = drivenCar(); const ip = S.cars.reduce((s,c)=>s + (c===d ? S.insPlus : S.insPlus/2), 0); S.cash -= ip; fixNeg(); R.push(['-', 'Vakuutusmaksujen korotukset', ip]); }
  // huollot ja renkaat
  S.cars.forEach(car => {
    if (car.svc === undefined) { car.svc = S.m + ri(2,10); car.tire = ri(6,30); }
    if (C(car.c).fl.includes('T')) car.svc = Infinity; // Teslalla ei ole määräaikaishuoltoa
    if (car === drivenCar()) car.tire--;
    if (S.m >= car.svc && !car.broken) Q.push(()=>serviceEvent(car)); // huoltoväli täyttyy ajalla, myös seisonnassa
    else if (car.svc - S.m === 3 && car.svcWarned !== car.svc) { car.svcWarned = car.svc; const k = C(car.c);
      Q.push(()=>say('HUOLTO LÄHESTYY', [`${k.name}: huolto on edessä 3 kuukauden päästä. Perushuolto noin ${eur(svcCost(k))}.`, '!Joka kolmannessa huollossa löytyy lisäksi jotain korjattavaa. Nyt ehtii vielä vaihtaa auton ennen huoltoa.'])); }
    else if (car.tire <= 0 && !car.broken && car === drivenCar()) Q.push(()=>tireEvent(car));
  });
  if (((S.m-1)%12 === 3 || (S.m-1)%12 === 9) && drivenCar()) Q.push(tireSwap);
  // viat
  working().forEach(car => {
    const k = C(car.c);
    const p = (k.type==='b' ? (k.price<5000?0.10:0.06) : k.type==='h' ? 0.05 : 0.035) + 0.04*car.mb + (car.skip ? 0.03 : 0) + (k.fl.includes('F') ? 0.08 : 0) + (k.fl.includes('V') && S.gigs ? 0.03 : 0) + (car === drivenCar() && S.taxi ? 0.04 : 0);
    if (RND() < p) Q.push(()=>faultEvent(car));
  });
  // ennakoidut tapahtumat
  S.pend.filter(p=>p.m<=S.m).forEach(p => {
    const ok = p.k==='lomautus' ? (!S.layoff && RND() < Math.min(0.95, (shortCommute()?0.9:0.7) + 0.1*S.boss)) : RND() < 0.8;
    if (ok) Q.push(()=>fire(p.k));
    else Q.push(()=>say('HUHU EI TOTEUTUNUT', [p.k==='elon'?'Elon twiittasikin vain meemin.':p.k==='korkoup'?'Keskuspankki piti korot ennallaan.':'Yt-neuvottelut päättyivät ilman lomautuksia. Tällä kertaa.']));
  });
  S.pend = S.pend.filter(p=>p.m>S.m);
  // satunnaistapahtuma
  if (RND() < 0.5) Q.push(randomEvent);
  return R;
}

// ---------- RUUDUT ----------
let UI = { show(){} };
function scr(title, lines, choices) { UI.show({title, lines, choices: choices.map(c=>({t:c[0], f:c[1], dis:!!c[2]}))}); }
function next() { if (S.over) return; if (S.cash < 0 && invTotal() > 0) return deficitPrompt(); const f = Q.shift(); if (f) f(); else if (Drive.active) Drive.resume(); else menu(); }
function say(title, lines) { scr(title, lines, [['Jatka', next]]); }
function sayTo(title, lines, back) { scr(title, lines, [['Jatka', back]]); }

function start() {
  scr('PAALAAN!', [
    'Autolainavankilapeli 2.0 (alpha)',
    '+Uutta: PAALAAN!-napista lähdetään ajamaan. Kuukausi vaihtuu 30 sekunnin välein, peuroja pitää väistellä, ja liittymästä pääset takaisin valikkoon.',
    '',
    'Pihassa on vuoden 2006 Mondeo, joka juo bensaa ja rahaa. Kassassa on tonni.',
    'Sinulla on 84 kuukautta aikaa päästä unelma-autoon niin, ettei laina ylitä auton arvoa.',
    'Jos lainaa on enemmän kuin autossa arvoa, olet VANKILASSA.',
    '',
    'Valitse tavoiteauto:'
  ], TARGETS.map((t,i)=>[`${t.name} (${t.lvl})`, ()=>{ S = newState(i); beginMonth(); }]));
}

function beginMonth() {
  Q = [];
  const R = monthTick();
  if (S.vippi > 3000) return repossess();
  const lines = R.map(r => (r[0]==='+'?'+':r[0]==='!'?'!':'') + `${r[1]}: ${r[0]==='+'?'+':'−'}${eur(r[2])}`);
  scr(`${monthName()}: TILIOTE`, lines, [['Jatka', next]]);
}
function monthName() { const y = 2027 + Math.floor((S.m-1)/12); return `KK ${S.m}/${LAST} · ${KK[(S.m-1)%12].toUpperCase()}KUU ${y}`; }

function menu() {
  if (Drive.active) Drive.stop();
  if (S.cash < 0 && invTotal() > 0) return deficitPrompt();
  if (S.cash < 0) { fixNeg(); if (S.vippi > 3000) return repossess(); }
  const ch = [];
  ch.push(['Autoliike (osta tai vaihda)', dealer]);
  ch.push([S.auctionDone ? 'Huutokaupat.com (käyty tässä kuussa)' : 'Huutokaupat.com', auction, S.auctionDone]);
  if (S.cars.length) ch.push(['Myy auto', sellMenu]);
  if (S.cars.some(c=>c.broken || c.minor)) ch.push(['Korjaamo', repairMenu]);
  ch.push([S.parking ? 'Luovu kolmesta autopaikasta' : 'Vuokraa kolme autopaikkaa (105 €/kk)', toggleParking]);
  if (S.tsa) ch.push(['Luovu työsuhdeautosta (500 € sopimussakko)', ()=>{ payOrVippi(500); tsaReturn('LUOVUIT AUTOSTA', 'Palautit työsuhdeauton kesken sopimuksen. Sopimussakko 500 €.', false); }]);
  ch.push(['Sivutulot ja sijoitukset', sideMenu]);
  ch.push(['Omat autot ja lainat', info]);
  ch.push([S.m>=LAST ? 'PAALAAN! (pelin loppu)' : 'PAALAAN! (tien päälle)', paalaan]);
  const lines = [];
  if (S.camp) lines.push(`+KAMPANJA: ${C(S.camp.id).name}, ylihyvitys ${eur(S.camp.amt)} vaihtoautosta (voimassa ${KK[(S.camp.until-1)%12]}kuun loppuun)`);
  if (S.layoff>0) lines.push(`!Lomautusta jäljellä ${S.layoff} kk`);
  if (S.bubble>2) lines.push('Hintakupla paisuu…');
  else if (S.bubble>0) lines.push('!Naapurikin myy autoja Marketplacessa, ja taksikuski suosittelee autokauppaa. Kupla on puhkeamassa.');
  if (S.boss) lines.push(`!Pomo muistaa ${S.boss} ilmoitettua kolhua. Lomautusriski on koholla.`);
  if (S.pend.length) lines.push('!Huhuja ilmassa: ' + S.pend.map(p=>({elon:'Elon',korkoup:'koronnosto',lomautus:'yt-neuvottelut'})[p.k]).join(', '));
  if (!working().length) lines.push('!Sinulla ei ole toimivaa autoa.');
  else if (shortCommute() && !S.layoff) lines.push('!Työmatka-auton toimintamatka ei riitä. Pomo on huomannut myöhästelyt.');
  lines.push('Mitä tehdään?');
  scr(monthName(), lines, ch);
}
// ---------- SIVUTULOT ----------
const taxiOK = car => car && C(car.c).type==='e' && !C(car.c).fl.includes('S') && !C(car.c).fl.includes('V') && C(car.c).price >= 15000;
function sideMenu() {
  const d = drivenCar(), ch = [];
  ch.push([S.wolt ? 'Lopeta Wolt-keikat' : 'Wolt- ja Foodora-kuskiksi iltaisin (+150–400 €/kk)', ()=>{ S.wolt = !S.wolt; if (S.wolt) S.taxi = false;
    sayTo('RUOKALÄHETTI', [S.wolt ? '+Iltaisin ruokaa kuljettamaan. Tulot ovat verotettuja, joten verottaja ei kiinnostu.' : 'Lopetit illat Woltilla.', S.wolt ? '!Auto, renkaat ja akku kuluvat. Väsyneenä tulee kolhuja ja sakkoja.' : ''], sideMenu); }, !S.wolt && !d]);
  ch.push([S.taxi ? 'Lopeta taksin ajo' : S.taxiLic ? 'Aja taksia (+500–1 100 €/kk)' : 'Hanki taksilupa (800 €) ja aja taksia', ()=>{
    if (!S.taxi && !S.taxiLic) { payOrVippi(800); S.taxiLic = true; }
    S.taxi = !S.taxi; if (S.taxi) S.wolt = false;
    sayTo('TAKSI', [S.taxi ? '+Taksivalo katolle. Tulot ovat hyvät, mutta kilometrejä kertyy hurjasti.' : 'Taksivalo talliin.', S.taxi ? '!Akku ja renkaat kuluvat moninkertaisesti, ja vikoja tulee useammin.' : ''], sideMenu); }, !S.taxi && !taxiOK(d)]);
  if (!S.taxi && !taxiOK(d)) ch[ch.length-1][0] += ' (vaatii vähintään 15 000 €:n sähköauton)';
  if (vanOK() || S.gigs) ch.push([S.gigs ? 'Lopeta pimeät muuttokeikat' : 'Pimeät muuttokeikat pakulla (+200–700 €/kk)', ()=>{ S.gigs = !S.gigs; sayTo('MUUTTOKEIKAT', [S.gigs ? '+Marketplace-ilmoitus on nettiin: "Muutot ja kuljetukset, edullisesti, käteinen ok."' : 'Lopetit keikat. Selkä kiittää.', S.gigs ? '!Pakettiauto kuluu, keikoilla sattuu, ja verottaja voi kiinnostua.' : ''], sideMenu); }]);
  ch.push([S.flip ? `Flippikohde: ${S.flip.name} (myynnissä, ${S.flip.left} kk)` : 'Flippaa huutokauppakohde', flipStart, !!S.flip]);
  ch.push([`Sijoitukset (TSLA ${eur(S.inv.tsla)}, DOGE ${eur(S.inv.doge)})`, invest]);
  ch.push([S.kimppa ? 'Eroa kimppa-Eurojackpotista' : 'Liity kimppa-Eurojackpotiin (15 €/kk)', toggleKimppa]);
  ch.push(['Takaisin', menu]);
  scr('SIVUTULOT', ['Lisätuloja ja riskejä. Sinulla on kassassa ' + eur(S.cash) + '.'], ch);
}
function flipStart() {
  const pool = CARS.map((_,i)=>i).filter(i=>C(i).price<=9000 && !C(i).fl.includes('N'));
  const id = pick(pool), V = listPrice(id, genSoh(id));
  const price = r100(V * rnd(0.45, 0.75));
  const hidden = RND() < 0.3;
  const go = (fix) => { if (S.cash < price + fix) return sayTo('FLIPPAUS', ['!Kassa ei riitä. Flippaus tehdään käteisellä.'], sideMenu);
    S.cash -= price + fix;
    let sale = V * (fix ? rnd(0.95, 1.18) : rnd(0.7, 1.0));
    const lines = [`+${C(id).name} ostettu ${eur(price)}${fix?`, korjattu ${eur(fix)}`:''}. Ilmoitus nettiin.`];
    if (hidden) { sale *= 0.55; lines.push('!Pesussa paljastui ruostereikä, jota kuvissa ei näkynyt. Myyntihinta romahtaa.'); }
    S.flip = {name: C(id).name, sale: r100(sale), left: ri(1,3), cost: price+fix};
    sayTo('FLIPPAUS', lines, sideMenu); };
  scr('FLIPPAUS', [`Huutokaupassa: ${C(id).name}. Markkina-arvo noin ${eur(V)}.`, `Saisit sen noin hintaan ${eur(price)}. Käteiskauppa, ei mahdu autopaikkoihin: seisoo naapurin pihassa.`], [
    [`Osta ja kunnosta (300 €)`, ()=>go(300), S.cash < price+300],
    ['Osta ja myy sellaisenaan', ()=>go(0), S.cash < price],
    ['Ei tällä kertaa', sideMenu],
  ]);
}
function invest() {
  const ch = [];
  [['tsla','Tesla-osakkeet'],['doge','Dogecoin']].forEach(([k,n]) => {
    [500,2000].forEach(a => ch.push([`Osta ${n} ${eur(a)}`, ()=>{ S.cash -= a; S.inv[k] += a; sayTo('SIJOITUS', [`${n}: sijoitit ${eur(a)}. Salkussa nyt ${eur(S.inv[k])}.`], invest); }, S.cash < a]));
    ch.push([`Myy kaikki ${n} (${eur(S.inv[k])})`, ()=>{ S.cash += S.inv[k]; const v = S.inv[k]; S.inv[k] = 0; sayTo('SIJOITUS', [`+${n} myyty, kassaan ${eur(v)}.`], invest); }, S.inv[k] <= 0]);
  });
  ch.push(['Takaisin', sideMenu]);
  scr('SIJOITUKSET', ['Tesla-osake heiluu, Dogecoin heiluu enemmän. Elonin twiitit liikuttavat kumpaakin.', `Salkku: TSLA ${eur(S.inv.tsla)}, DOGE ${eur(S.inv.doge)}`], ch);
}
// 2.0: kuukaudet vaihtuvat ajaessa (drive.js)
function paalaan() { if (S.m>=LAST) return endGame(); Drive.start(); }

function toggleKimppa() {
  S.kimppa = !S.kimppa;
  sayTo('KIMPPA', [S.kimppa ? 'Olet mukana Sähköautomiesten kimpassa. Tällä kertaa se osuu.' : 'Erosit kimpasta. Juuri tällä viikolla se varmaan osuu.'], sideMenu);
}

function toggleParking() {
  S.parking = !S.parking;
  say('AUTOPAIKAT', [S.parking ? 'Vuokrasit kolme vierekkäistä autopaikkaa 105 €/kk. Pysäköit keskimmäiseen, eikä kukaan avaa ovea kylkeesi. Melkein.' : 'Luovuit autopaikoista. Ovet aukeavat taas vapaasti kylkeesi.']);
}

function info() {
  const lines = [];
  S.cars.forEach(car => {
    const k = C(car.c);
    lines.push(`${k.name}${car.mb?' [MB×'+car.mb+']':''}${car.broken?' [RIKKI '+eur(car.broken)+']':''}${car.minor?' [pikkuvikoja '+eur(car.minor)+']':''}${car.sale?' [myynnissä]':''}`);
    lines.push(`  Arvo ${eur(val(car))}, laina ${car.loan?eur(car.loan.bal):'0 €'}`);
    if (car.loan) lines.push(`  Erä ${eur(car.loan.pay)}/kk, ${car.loan.n} kk jäljellä, korko ${pct(car.loan.r*1200)}${car.loan.B?', jämäri '+eur(car.loan.B):''}`);
    lines.push(`  Kulut ${eur(k.run)}/kk, arvonlasku ~${Math.round(k.dep*100)} %/v${sohTxt(car)}`, `  Takuu: ${warrTxt(car)}`);
  });
  if (S.tsa) { const T = S.tsa; lines.push(`TYÖSUHDEAUTO: ${C(T.c).name}${T.mb?' [MB×'+T.mb+']':''}`, `  ${T.kind}etu ${eur(T.cost)}/kk, sopimusta jäljellä ${T.left} kk`, `  Salattuja vaurioita ${T.dmg.length} kpl${T.mb?', mikrobetonipaikkoja '+T.mb:''} (tarkastaja huomaa noin 3/4)`); }
  if (!S.cars.length && !S.tsa) lines.push('Ei autoja.');
  lines.push(`Pikavippi: ${eur(S.vippi)}${S.mark?' · maksuhäiriö (korot kalliimpia)':''}`);
  if (S.parking) lines.push('Kolme autopaikkaa vuokralla (105 €/kk)');
  lines.push(`Kimppaan maksettu ${eur(S.kimppaPaid)}, voitettu ${eur(S.kimppaWon)}`);
  lines.push(`Tavoite: ${TARGETS[S.target].name}${ownsTarget()?' (PIHASSA!)':''}`);
  say('OMAT AUTOT', lines);
}

// ---------- TAPAHTUMAT ----------
const pend = k => S.pend.some(p=>p.k===k);
function randomEvent() {
  const month = (S.m-1)%12;
  const ev = [
    ['elon',S.elon>0||pend('elon')?0:2],['kupla',S.bubble?0:3],['korkoup',pend('korkoup')?0:4],['korkodown',3],['sahko',[10,11,0,1,2].includes(month)?5:[5,6,7].includes(month)?2:0],
    ['korotus',S.layoff?0:4],['lomautus',S.layoff||pend('lomautus')?0:(shortCommute()?12:3)+3*S.boss],['kampanja',S.camp?0:8],['sakko',3+(S.wolt?2:0)+(S.taxi?2:0)],['verottaja',S.gigs&&S.black>0?2.5:0],['muuttokolhu',S.gigs&&vanOK()?3:0],['kivenisku',drivenCar()?3:0],['vakuutus',S.cars.length?2:0],['varkaus',S.cars.some(c=>C(c.c).type==='e')?1.5:0],['tsa',(!S.tsa && S.m>3)?(S.income>=800?5:3):0],['tyopaikka',S.tsa?1:0],
    ['kolhu',(S.tsa||drivenCar())?(S.wolt?1.5:0)+(S.taxi?2:0)+(S.parking?0.75:3)+(S.slip?3:0):0],['peura',0], // 2.0: peurat ovat tiellä (drive.js)
    ['katsastus',S.cars.some(c=>(C(c.c).type!=='e'||c.mb||c.minor)&&!c.broken)?4+2*S.cars.reduce((s,c)=>s+c.mb,0):0],
  ];
  const tot = ev.reduce((s,e)=>s+e[1],0); let x = RND()*tot, e;
  for (e of ev) { x -= e[1]; if (x<0) break; }
  const k = e[0];
  if (k==='elon' || k==='korkoup' || k==='lomautus') return omen(k);
  return fire(k);
}
function fire(k) {
  if (k==='verottaja') { const b = Math.max(1000, r100(S.black*0.55)); const tot = S.black; S.black = 0; payOrVippi(b);
    return say('VEROTTAJAN KIRJE', [`!Verohallinto kiinnostui Marketplace-ilmoituksistasi ("Muutot ja kuljetukset, edullisesti, käteinen ok").`, `Ilmoittamattomia tuloja ${eur(tot)}. Jälkivero ja veronkorotus yhteensä ${eur(b)}.`, 'Keikkoja voi jatkaa. Verottaja ei unohda, mutta se ei myöskään lue jokaista ilmoitusta.']); }
  if (k==='muuttokolhu') { const van = vanOK(); const p = pick([['Pianon kulma naarmutti tavaratilan seinän',300,0.98],['Asiakkaan peruutustutka ei ollut sinun autossasi: lyhtypylväs',1200,0.94],['Pakkaamaton akvaario kaatui. Tavaratila haisee',400,0.97],['Kolmannen kerroksen asiakas ei maksanut',0,1]]);
    if (p[1]) payOrVippi(p[1]); van.base *= p[2];
    return say('MUUTTOKEIKKA', [`!${p[0]}.${p[1]?' Kulut '+eur(p[1])+'.':' Menetit keikan tulot.'}`, 'Pimeillä keikoilla ei ole vakuutusta.']); }
  if (k==='sakko') { const p = pick([['Nopeuskamera: 7 km/h ylinopeutta Kehä III:lla. Rikesakko', 140],['Pysäköintivirhemaksu kauppakeskuksessa', 80],['Latauspaikalla pysäköinnistä lappu (lataus oli jo valmis)', 60],['Yksityinen pysäköintivalvonta: "valvontamaksu"', 90]]);
    payOrVippi(p[1]); return say('SAKKO', [`!${p[0]}: ${eur(p[1])}.`]); }
  if (k==='kivenisku') { const car = drivenCar(); if (!car) return next();
    return scr('KIVENISKU', [`${C(car.c).name}: rekka heitti kiven tuulilasiin.`], [
      ['Lasivakuutus: omavastuu 150 €', ()=>{ payOrVippi(150); say('KIVENISKU', ['Uusi tuulilasi. Kalibroinnit päälle.']); }],
      ['Paikkaus 60 € (pieni jälki jää)', ()=>{ payOrVippi(60); car.base *= 0.99; say('KIVENISKU', ['Hartsi täytti kolon. Melkein näkymätön.']); }],
      ['Jätä (halkeama voi kasvaa)', ()=>{ car.base *= 0.97; if (RND()<0.4) { car.broken = 600; say('KIVENISKU', ['!Pakkasyönä halkeama juoksi koko lasin poikki. Katsastuskelvoton, korjaus 600 €.']); } else say('KIVENISKU', ['Halkeama pysyi pienenä. Toistaiseksi.']); }],
    ]); }
  if (k==='vakuutus') { S.insPlus = (S.insPlus||0) + 10; return say('VAKUUTUSYHTIÖN KIRJE', ['!Vakuutusmaksut nousevat indeksikorotuksella 10 €/kk autoa kohden.', 'Kilpailutus olisi pitänyt tehdä viime vuonna.']); }
  if (k==='varkaus') { payOrVippi(320); return say('LATAUSKAAPELI VIETIIN', ['!Joku katkaisi latauskaapelin julkisella laturilla ja vei kuparit. Uusi kaapeli 320 €.']); }
  if (k==='tsa') return tsaOffer();
  if (k==='tyopaikka') { S.income += 100; return tsaReturn('UUSI TYÖPAIKKA', '+Sait paremman työpaikan (+100 €/kk), mutta työsuhdeauto jää vanhalle firmalle.', false); }
  if (k==='elon') { S.elon = 12; S.M.ev *= 0.88; S.M.tesla *= 0.78; const hadInv = S.inv.tsla || S.inv.doge; S.inv.tsla *= 0.8; S.inv.doge *= RND()<0.5 ? 1.7 : 0.5;
    if (hadInv) Q.unshift(()=>say('SALKKU', [`Elonin twiitti liikutti myös salkkua: TSLA ${eur(S.inv.tsla)}, DOGE ${eur(S.inv.doge)}.`]));
    return say('ELON TWIITTASI', ['!"Hinnanalennus kaikkiin malleihin. Lol."','Teslojen käytettyjen hinnat romahtivat noin 25 %, muiden sähköautojen noin 12 %.','Hinnat palautuvat hiljalleen. Ostajalle hyvä hetki, omistajalle ei.']); }
  if (k==='kupla') { S.bubble = ri(3,8); return say('HINTAKUPLA', ['+Käytettyjen autojen hinnat lähtivät nousuun.','Kaikki ovat yhtäkkiä autokauppiaita. Mikä voisi mennä pieleen?']); }
  if (k==='korkoup') { S.rate = Math.min(3, S.rate+1); S.inv.tsla *= 0.9; S.inv.doge *= 0.85; return say('KORKO NOUSI', ['!Keskuspankki nosti korkoja. Uusien lainojen korot +1 %.','Vanhat lainasi pysyvät ennallaan.']); }
  if (k==='korkodown') { S.rate = Math.max(-2, S.rate-1); return say('KORKO LASKI', ['+Keskuspankki laski korkoja. Uusien lainojen korot −1 %.']); }
  if (k==='sahko') { const w = [10,11,0,1,2].includes((S.m-1)%12); S.spike = 2; S.spikeAmt = w ? 80 : 40;
    return say('SÄHKÖN HINTAPIIKKI', [w ? '!Tuulettomat pakkaset. Sähköauton käyttökulut +80 €/kk kahden kuukauden ajan.' : '!Kuiva kesä, vesivoima vähissä ja ydinvoimala vuosihuollossa. Sähköauton käyttökulut +40 €/kk kahden kuukauden ajan.']); }
  if (k==='korotus') { const a = ri(1,3)*50; S.income += a; return say('PALKANKOROTUS', [`+Autobudjetti nousee pysyvästi ${eur(a)}/kk. Nyt on ${eur(S.income)}/kk.`,'Älä heti osta isompaa.']); }
  if (k==='lomautus' && S.tsa && RND()<0.5) { S.layoff = ri(2,4); Q.unshift(()=>tsaReturn('AUTO PALAUTETAAN', 'Lomautuksen ajaksi työsuhdeauto pitää palauttaa.', false)); return say('LOMAUTUS', [S.boss ? '!Pomo kävi listan läpi ja muisti työsuhdeauton kolhut: "Tuollainen töhö joutaa lähteä."' : '!Yt-neuvottelut päättyivät.', `!Sinut lomautetaan ${S.layoff} kuukaudeksi. Autobudjetti puolittuu.`]); }
  if (k==='lomautus') { const sc = shortCommute(); S.layoff = ri(2,4)+(sc?1:0); return say('LOMAUTUS', [sc ? `!Myöhästyit taas palaverista, kun ${C(driveOrder()[0].c).name} piti ladata kesken työmatkan. Pomo valitsi lomautettavat.` : S.boss ? '!Pomo kävi listan läpi ja muisti työsuhdeauton kolhut: "Tuollainen töhö joutaa lähteä."' : '!Yt-neuvottelut päättyivät.', `!Sinut lomautetaan ${S.layoff} kuukaudeksi. Autobudjetti puolittuu.`,'Lainan erät juoksevat normaalisti.']); }
  if (k==='kampanja') { const c = pick(CAMPAIGNS); S.camp = {id:c[0], amt:c[1], until:S.m+1};
    return say('KAMPANJA!', [`+${C(c[0]).name}: ylihyvitys vaihtoautosta ${eur(c[1])}!`, 'Voimassa tämän ja ensi kuun. Löytyy autoliikkeestä.','Ylihyvitys on hinnanalennus, joka on piilotettu vaihtoautoon. Uuden auton arvo on heti pienempi kuin hinta.']); }
  if (k==='kolhu' || k==='peura') return damageEvent(k);
  if (k==='katsastus') { const car = pick(S.cars.filter(c=>(C(c.c).type!=='e'||c.mb||c.minor)&&!c.broken)); car.broken = ri(4,9)*100*(1+car.mb) + (car.minor||0); car.minor = 0;
    return repairChoice(car, 'KATSASTUS HYLKÄSI', `${C(car.c).name} ei mennyt läpi katsastuksesta${car.mb?'. Katsastaja koputteli mikrobetonipaikkoja':''}. Korjaus maksaa ${eur(car.broken)}.`); }
}

const OMENS = {
  elon: ['HUHU', 'Elon on ollut X:ssä epäilyttävän hiljaa. Tesla-foorumeilla povataan hinnanalennuksia.'],
  korkoup: ['HUHU', 'Keskuspankin pääjohtaja vihjaili haastattelussa, että inflaatio vaatii toimia.'],
  lomautus: ['HUHU', 'Kahvihuoneessa kuiskitaan yt-neuvotteluista.'],
};
function omen(k) {
  S.pend.push({k, m: S.m+1});
  const lines = [OMENS[k][1], 'Tämä voi toteutua jo ensi kuussa. Varaudu, jos pystyt.'];
  if (k==='lomautus' && shortCommute()) lines.push('!Myöhästelysi ovat pomon tiedossa.');
  say(OMENS[k][0], lines);
}
function damageEvent(k) {
  if (S.tsa) return tsaDamage(k);
  const car = drivenCar();
  if (!car) return next();
  const kk = C(car.c);
  const lux = kk.price > 50000;
  const omav = k==='peura' ? (lux?800:500) : (lux?500:300);
  const t = k==='peura' ? 'PEURA!' : 'KOLHU';
  const txt = k==='peura' ? `Peura loikkasi ${kk.name}n keulaan.` : (S.parking ? `${kk.name}: joku pysäköi kolmen paikan keskelle kahden paikan väliin ja avasi oven silti kylkeen.` : `${kk.name}: parkkipaikalla joku avasi oven kylkeen.`);
  const ch = [
    [`Vakuutus: omavastuu ${eur(omav)}`, ()=>{ payOrVippi(omav); say(t,['Korjattu kunnolla. Arvo säilyi.']); }],
    [`Mikrobetoni (${eur(k==='peura'?60:40)}): arvo −${k==='peura'?25:20} %`, ()=>{ S.cash -= (k==='peura'?60:40); car.base *= (k==='peura'?0.75:0.8); car.mb++; fixNeg(); say(t,['Mikrobetonia, hiekkapaperia ja spraymaalia. Melkein huomaamaton.', mbWarn(car)]); }],
  ];
  if (k==='kolhu') ch.push(['Jätä korjaamatta (arvo −6 %)', ()=>{ car.base *= 0.94; say(t,['Kolhu jää muistoksi.']); }]);
  else ch.push(['Jätä korjaamatta: auto ei kulje (korjaus 3 000 €)', ()=>{ car.broken = 3000; say(t,['!Auto seisoo pihassa.']); }]);
  const lines = [txt];
  if (k==='peura' && RND() < 0.4) {
    const uus = car.newBuy && S.m - (car.bought||0) <= 24;
    const pay = r100(uus ? car.paid : val(car)) - omav;
    lines.push(`Vauriot ylittävät korjauskynnyksen: vakuutusyhtiö tarjoaa lunastusta${uus ? ' uusarvolla, koska auto on ostettu uutena alle kaksi vuotta sitten' : ' markkinahintaan'}.`);
    ch.unshift([`Lunastus: vakuutus maksaa ${eur(pay)} (omavastuu vähennetty)`, ()=>{
      const L = car.loan ? car.loan.bal : 0, net = pay - L;
      S.cars.splice(S.cars.indexOf(car), 1);
      const out = [`Vakuutusyhtiö lunasti auton ja maksoi ${eur(pay)}.`];
      if (L) out.push(`Siitä ${eur(Math.min(L, pay))} meni rahoitusyhtiölle lainan maksuun.`);
      if (net >= 0) { S.cash += net; out.push(`+Kassaan ${eur(net)}.${uus ? ' Uusarvolunastus: peura teki sinulle palveluksen.' : ''}`); }
      else { S.residual += -net; out.push(`!Laina oli lunastushintaa suurempi. Jäännösvelkaa jäi ${eur(-net)}.`); }
      if (!working().length && !S.tsa) out.push('!Sinulla ei ole nyt autoa. Taksit maksavat 850 €/kk.');
      say('LUNASTUS', out); }]);
  }
  scr(t, lines, ch);
}

function svcCost(k) { return Math.round((k.type==='b' ? 450 : k.type==='h' ? 350 : 250) * tierMult(k) / 10) * 10; }
function serviceEvent(car) {
  if (!S.cars.includes(car) || car.broken) return next();
  const k = C(car.c), c = svcCost(k);
  car.svc = S.m + (k.type==='e' ? 24 : 12);
  scr('MÄÄRÄAIKAISHUOLTO', [`${k.name}: ${k.type==='e'?'määräaikaishuolto (2 vuoden välein)':'vuosihuolto'} on ajankohtainen${car===drivenCar()?'':' (huoltoväli täyttyy ajalla, vaikka auto seisoo)'}.`, 'Huoltohistoria näkyy myyntihinnassa, ja huoltamaton auto hajoaa herkemmin.'], [
    [`Merkkihuolto ${eur(c)}${/^Toyota/.test(k.name)&&modelAge(car.c)<10?' (pidentää Toyotan takuuta vuodella)':''}`, ()=>{ payOrVippi(c); car.skip = 0; if (/^Toyota/.test(k.name) && modelAge(car.c) < 10) car.warr = Math.max(car.warr||0, S.m + 12); svcExtra(car, 'Leima huoltokirjaan. Kahvi oli hyvää.'); }],
    [`Pikahuolto ${eur(c/2)} (arvo −3 %)`, ()=>{ payOrVippi(c/2); car.skip = 0; car.base *= 0.97; svcExtra(car, 'Öljyt vaihdettiin, muusta ei kysytty.'); }],
    [`Ohita (arvo −8 %, vikariski kasvaa${warrLeft(car)||bwarrLeft(car)?', TAKUU RAUKEAA':''})`, ()=>{ car.skip = 1; car.base *= 0.92; say('HUOLTO', ['!Huoltokirjaan jäi aukko. Ostajat huomaavat sen.']); }],
  ]);
}
const SVC_EXTRA = {
  all: [['Jarrunesteen vaihto',120],['Jarrulevyt ja -palat',600],['Raidetangon päät',450],['Ilmastoinnin huolto',180],['Pyöränlaakeri',550],['Kallistuksenvakaajan nivelet',300],['Tuulilasinpyyhkijät ja valot',90]],
  b: [['Jakohihna ja vesipumppu',950],['Pakosarja vuotaa',700],['Öljyvuoto venttiilikopasta',400],['Hehkutulpat',350]],
  h: [['Invertterin jäähdytysneste',250],['Jakohihna',800]],
  e: [['Siitepölysuodatin ja lämpöpumpun huolto',250],['Akun jäähdytysnesteen vaihto',380],['Jarrusatulat jumissa',650]],
};
function svcExtra(car, okText) {
  if (RND() >= 1/3) return say('HUOLTO', [okText]);
  const k = C(car.c);
  const it = pick(SVC_EXTRA.all.concat(SVC_EXTRA[k.type]));
  const cost = Math.round(it[1] * tierMult(k) * rnd(0.85, 1.3) / 10) * 10;
  scr('HUOLLOSSA LÖYTYI', [okText, `!Huoltomies soitti: "${it[0]} pitäisi hoitaa." Lisälasku ${eur(cost)}.`], [
    [`Korjaa samalla (${eur(cost)})`, ()=>{ payOrVippi(cost); say('HUOLTO', ['Korjattu samalla käynnillä.']); }],
    ['Jätä korjaamatta (näkyy myyntihinnassa ja katsastuksessa)', ()=>{ car.minor = (car.minor||0) + cost; say('HUOLTO', ['Kuitattu huoltokirjaan: "Asiakas ei halunnut korjausta."']); }],
  ]);
}
function tireEvent(car) {
  if (!S.cars.includes(car)) return next();
  const k = C(car.c);
  const c = Math.round((k.type==='e' ? 700 : 500) * tierMult(k) * (k.name.includes('GT')||k.name.includes('M60')||k.name.includes('Plaid')||k.name.includes('Turbo') ? 1.6 : 1) / 10) * 10;
  scr('RENKAAT LOPPU', [`${k.name}: urat ovat kuluneet loppuun.${k.type==='e'?' Sähköauton paino ja vääntö syövät kumia.':''}`], [
    [`Laaturenkaat ${eur(c)}`, ()=>{ payOrVippi(c); car.tire = 36; say('RENKAAT', ['Uudet kumit alle.']); }],
    [`Halvat nettirenkaat ${eur(c*0.5)} (pito heikompi)`, ()=>{ payOrVippi(c*0.5); car.tire = 24; S.slip = (S.slip||0) + 3; say('RENKAAT', ['Merkki on joku, josta kukaan ei ole kuullut. Pito tuntuu siltä.']); }],
    ['Ajetaan loppuun', ()=>{ car.tire = 4; S.slip = (S.slip||0) + 4; say('RENKAAT', ['!Kaljuilla kumeilla liukastumisen ja kolhujen riski kasvaa.']); }],
  ]);
}
function tireSwap() {
  const winter = (S.m-1)%12 === 9;
  scr('RENKAANVAIHTO', [winter ? 'Lokakuu: talvirenkaat alle ennen ensilunta.' : 'Huhtikuu: kesärenkaat alle.'], [
    ['Rengashotelli 90 €', ()=>{ payOrVippi(90); say('RENKAANVAIHTO', ['Hoidettu, renkaat pestään ja säilötään.']); }],
    ['Vaihda itse (0 €)', ()=>{ if (RND()<0.15) { const car = working()[0]; if (car) car.broken = 300; say('RENKAANVAIHTO', ['!Yksi mutteri jäi löysäksi, ja pyörä alkoi heilua. Korjaus 300 €.']); } else say('RENKAANVAIHTO', ['Pihalla tunkin kanssa säästit 90 €. Selkä on eri mieltä.']); }],
  ]);
}
function batteryFail(car) {
  if (!S.cars.includes(car) || car.battFail) return next();
  const k = C(car.c), cost = battCost(k);
  if (cost === 0) { car.soh = 100; car.held = 0; car.w85 = car.w80 = false; return say('AKKUVUOKRA', [`${k.name}: akku vikaantui.`, '+Akku on vuokralla, joten Renault vaihtoi sen veloituksetta. Akkuvuokra kerrankin kannatti.']); }
  if (bwarrLeft(car) && !wVoid(car)) { car.soh = 100; car.held = 0; car.w85 = car.w80 = false;
    return say('AKKUTAKUU', [`${k.name}: ajovoima-akku vikaantui.`, '+Akkutakuu on voimassa: uusi akku asennettiin veloituksetta. Säästit ' + eur(cost) + '.']); }
  car.battFail = true; car.broken = cost;
  scr('AKKU VIKATILASSA', [`${k.name}: akun kunto ${Math.round(car.soh)} %. Auto ei suostu lataamaan, ja mittaristossa palaa punainen kilpikonna.`, `Akkuremontti maksaa ${eur(cost)}.`].concat(bwarrLeft(car) ? ['!Akkutakuu olisi ollut voimassa, mutta se raukesi (' + (car.mb ? 'mikrobetoni' : 'huolto laiminlyöty') + ').'] : []), [
    [`Uusi akku ${eur(cost)}`, ()=>{ payOrVippi(cost); car.broken = 0; car.battFail = false; car.soh = 100; car.held = 0; car.w85 = car.w80 = false; say('AKKU', ['+Uusi akku, uusi toimintamatka. Kassa ei ole samaa mieltä.', S.vippi?'!Remontti meni osin pikavipillä.':'']); }],
    [`Akkuremontti osamaksulla 24 kk (9,9 %)`, ()=>{ const L = car.loan || {bal:0, r:0.099/12, n:24, B:0, pay:0};
        L.bal += cost; L.r = Math.max(L.r, 0.099/12); L.n = Math.max(L.n, 24); L.pay = annuity(L.bal, L.r, L.n, L.B||0); car.loan = L;
        car.broken = 0; car.battFail = false; car.soh = 100; car.held = 0; car.w85 = car.w80 = false;
        say('AKKU', ['Korjaamon rahoitusyhtiö lisäsi remontin auton lainaan.', `!Erä on nyt ${eur(L.pay)}/kk. Laina kasvoi ${eur(cost)}, mutta auton arvo ei.`]); }],
    ['Myy romuna Autovexille', ()=>settle(car, r100(val(car)*0.5), 'Autovex')],
    ['Jätä seisomaan (korjaamolla myöhemmin)', ()=>say('AKKU', ['!Auto seisoo pihassa. Arvo valuu, ja laina juoksee.'])],
  ]);
}
function faultEvent(car) {
  if (!S.cars.includes(car) || car.broken) return next();
  const k = C(car.c);
  let fault = k.fault, cost = k.fcost;
  if (k.fl.includes('F') && RND() < 0.6) { const g = pick(FFAULTS); fault = g[0]; cost = g[1]; }
  else if (RND() < 0.5) { const g = pick(GENFAULTS[k.type]); fault = g[0]; cost = g[1] * tierMult(k); }
  car.broken = Math.round(cost*rnd(0.9,1.3)/10)*10;
  let txt = `${k.name}: ${fault}. Korjausarvio ${eur(car.broken)}.`;
  if (car.mb && RND() < 0.4) { car.broken *= 2; txt = `${k.name}: mikrobetonipaikka lohkesi ja vei mukanaan muutakin. Korjausarvio ${eur(car.broken)} (tuplana).`; }
  else {
    const [cov, ctxt] = coverage(car);
    if (cov >= 1) { car.broken = 0; return say('TAKUUKORJAUS', [`${k.name}: ${fault}.`, '+' + ctxt + ' Sinulle 0 €. Sijaisautokin saatiin.']); }
    if (cov > 0) { car.broken = Math.round(car.broken * (1-cov) / 10) * 10; txt = `${k.name}: ${fault}. ${ctxt} Sinun osuutesi ${eur(car.broken)}.`; }
    else if (ctxt) txt += ' ' + ctxt.slice(1);
    if (DRIVABLE.has(fault)) { const c = car.broken; car.broken = 0; return minorChoice(car, c, txt); }
  }
  repairChoice(car, 'AUTO HAJOSI', txt + ' Auto ei ole ajokunnossa.');
}

function minorChoice(car, cost, text) {
  scr('VIKA', [text, 'Auto kulkee, mutta vika näkyy myyntihinnassa ja voi kaataa katsastuksen.'], [
    [`Korjaa käteisellä (${eur(cost)})`, ()=>{ S.cash -= cost; say('VIKA', ['Korjattu.']); }, S.cash < cost],
    ['Korjaa pikavipillä', ()=>{ payOrVippi(cost); say('VIKA', ['Korjattu.', S.vippi ? '!Pikavippi otettu. Korko on 20 %/kk.' : '']); }],
    [`Aja korjaamattomana (arvo −${eur(cost*0.6)})`, ()=>{ car.minor = (car.minor||0) + cost; say('VIKA', ['Ajetaan näin. Vika jää odottamaan korjaamoa tai katsastusta.']); }],
  ]);
}
function repairChoice(car, title, text) {
  const k = C(car.c);
  const ch = [];
  ch.push([`Korjaa käteisellä (${eur(car.broken)})`, ()=>{ S.cash -= car.broken; car.broken = 0; say(title,['Korjattu.']); }, S.cash < car.broken]);
  ch.push(['Korjaa pikavipillä', ()=>{ addVippi(car.broken - Math.max(0,S.cash)); S.cash = Math.max(0, S.cash - car.broken); car.broken = 0; say(title,['Korjattu.','!Pikavippi otettu. Korko on 20 %/kk.']); }]);
  if (k.fl.includes('K')) ch.push(['Mikrobetoni luukkuun (40 €): arvo −20 %', ()=>{ S.cash -= 40; car.broken = 0; car.base *= 0.8; car.mb++; fixNeg(); say(title,['Luukku valettu kiinni mikrobetonilla. Lataus toimii, kun piuhan työntää raosta.', mbWarn(car)]); }]);
  ch.push(['Jätä odottamaan', ()=>{ say(title, ['!Auto seisoo. Arvo laskee seistessä nopeammin.', working().length ? '' : '!Ilman toimivaa autoa kuluu 850 €/kk takseihin ja busseihin. Harkitse hätäautoa.']); }]);
  scr(title, [text], ch);
}

function mbWarn(car) {
  if (car.mb >= 3) return `!MB×${car.mb}: auto on enemmän betonia kuin peltiä. Vikoja ja katsastushylkäyksiä tulee nyt usein.`;
  if (car.mb === 2) return '!Toinen mikrobetonipaikka. Vikariski kasvaa, ja paikat voivat lohjeta.';
  return '!Arvo putosi, ja autoon jäi MB-merkintä. Jokainen paikka lisää vikariskiä' + ((warrLeft(car)||bwarrLeft(car)) ? ', ja takuu raukesi.' : '.');
}
function addVippi(v) { if (v<=0) return; S.vippi += v + 60; S.mark = 12; }
const invTotal = () => S.inv.tsla + S.inv.doge;
// jos sijoituksia on, kassa saa hetkeksi mennä miinukselle, ja pelaajalta kysytään ennen pikavippiä
function payOrVippi(a) { if (S.cash >= a || invTotal() > 0) S.cash -= a; else { addVippi(a - S.cash); S.cash = 0; } }
function fixNeg() { if (S.cash < 0 && invTotal() <= 0) { addVippi(-S.cash); S.cash = 0; } }
function deficitPrompt() {
  const gap = -S.cash, ch = [];
  const sell = (k, n) => { const a = Math.min(S.inv[k], gap); S.inv[k] -= a; S.cash += a;
    if (S.cash < 0) return deficitPrompt();
    say('REALISOINTI', [`${n}: myytiin ${eur(a)}. Kassa on taas plussalla.`, `Salkkuun jäi TSLA ${eur(S.inv.tsla)}, DOGE ${eur(S.inv.doge)}.`]); };
  if (S.inv.tsla > 0) ch.push([`Myy Tesla-osakkeita (salkussa ${eur(S.inv.tsla)})`, ()=>sell('tsla','Tesla-osakkeet')]);
  if (S.inv.doge > 0) ch.push([`Myy Dogecoinia (salkussa ${eur(S.inv.doge)})`, ()=>sell('doge','Dogecoin')]);
  ch.push([`Ota pikavippi ${eur(gap)} (20 %/kk) ja pidä sijoitukset`, ()=>{ addVippi(gap); S.cash = 0; if (S.vippi > 3000) return repossess(); say('PIKAVIPPI', ['!Pikavippi myönnetty. Toivottavasti salkku tuottaa yli 20 % kuussa.']); }]);
  scr('KASSA LOPPUI', [`!Kassassa on vajetta ${eur(gap)}.`, 'Realisoidaanko sijoituksia, vai otetaanko pikavippi?'], ch);
}

function repossess() {
  if (Drive.active) Drive.stop();
  S.over = true;
  const lines = ['!Pikavippejä on yli 3 000 €. Perintä on edennyt ulosottoon.'];
  const iv = S.inv.tsla + S.inv.doge; if (iv) { const p = Math.min(iv, S.vippi); S.vippi -= p; S.cash += iv - p; S.inv = {tsla:0, doge:0}; lines.push(`Ulosottomies realisoi sijoitukset ${eur(iv)}.`); }
  lines.push('Autot haettiin pihasta ja myytiin pakkohuutokaupassa noin 70 %:lla arvosta:');
  S.cars.slice().forEach(car => {
    let p = r100(val(car) * 0.7);
    const L = car.loan ? car.loan.bal : 0;
    const toLoan = Math.min(p, L); p -= toLoan;
    S.residual += L - toLoan;
    const toVippi = Math.min(p, S.vippi); S.vippi -= toVippi; p -= toVippi;
    S.cash += p;
    lines.push(`${C(car.c).name}: ${eur(toLoan+toVippi+p)} → laina −${eur(toLoan)}${toVippi?`, vippi −${eur(toVippi)}`:''}${p?`, kassaan ${eur(p)}`:''}${L-toLoan>0?`. Jäännösvelkaa jäi ${eur(L-toLoan)}.`:''}`);
  });
  S.cars = [];
  lines.push('');
  scr('ULOSOTTO', lines.concat(endLines(true)), [['Uusi peli', start]]);
}

// ---------- TYÖSUHDEAUTO ----------
const TSA_POOL = { perus:[22,24,19,25], keski:[21,27,26,50], premium:[34,40,43,35], polttis:[7,5] };
function tsaPrice(i) { const k = C(i); return k.type==='b' ? 45000 : k.fl.includes('N') ? k.price : r100(k.price*1.6); }
function tsaCost(i, kind) {
  const k = C(i), ev = k.type==='e';
  const base = tsaPrice(i) * (ev ? 0.006 : 0.011);
  return Math.round((kind==='vapaa' ? base : base*0.6 + (ev ? 60 : 300))/10)*10;
}
function tsaOffer() {
  const opts = [pick(TSA_POOL.perus), pick(TSA_POOL.keski), RND()<0.35 ? pick(TSA_POOL.polttis) : pick(TSA_POOL.premium)];
  if (RND()<0.15) opts[2] = pick(TARGETS[S.target].ids.filter(i=>C(i).type==='e'));
  const full = S.cars.length >= 2;
  const ch = opts.map(i => [`${C(i).name}${C(i).type==='b'?' (polttomoottori)':''} · vapaa autoetu ${eur(tsaCost(i,'vapaa'))}/kk${TARGETS[S.target].ids.includes(i)?' ★':''}`, ()=>tsaTerms(i), full]);
  ch.push(['Ei kiitos', next]);
  const lines = ['+Pomo tarjoaa työsuhdeautoa!', 'Ei lainaa eikä vankilaa, mutta auto ei ole sinun. Luontoisetu pienentää autobudjettia joka kuukausi.', 'Sopimus on 12 kk. Lopussa on palautustarkastus: huomatut kolhut ja mikrobetonipaikat laskutetaan sinulta.'];
  if (full) lines.push('!Sinulla on jo kaksi autoa. Myy ensin yksi, jos haluat työsuhdeauton (seuraavalla kerralla).');
  scr('TYÖSUHDEAUTO', lines, ch);
}
function tsaTerms(i) {
  const k = C(i);
  const ch = [];
  [['vapaa',12],['käyttö',12]].forEach(([kind,n]) => {
    ch.push([`${kind==='vapaa'?'Vapaa autoetu':'Käyttöetu'}, ${n} kk · ${eur(tsaCost(i,kind))}/kk${kind==='käyttö'?(k.type==='e'?' (sis. omat lataukset)':' (sis. omat tankkaukset)'):''}`,
      ()=>{ S.tsa = {c:i, kind, cost:tsaCost(i,kind), left:n, dmg:[], mb:0, ev:k.type==='e'};
        say('TYÖSUHDEAUTO', [`+${k.name} odottaa firman parkkipaikalla.`, `Luontoisetu ${eur(S.tsa.cost)}/kk vähennetään autobudjetista. Omat autosi ovat seisonnassa: vakuutus puolittuu, vero pysähtyy ja arvonlasku hidastuu.`, 'Työsuhdeautolla et voi myöhästellä latausten takia, joten lomautusriski on normaali.']); }]);
  });
  ch.push(['Takaisin', tsaOffer]);
  scr('TYÖSUHDEAUTO', [`${k.name}`, 'Vapaassa autoedussa työnantaja maksaa kaiken: huollot, renkaat, rengasvaihdot ja omavastuut. Käyttöedussa etu on pienempi, mutta maksat polttoaineen tai sähkön itse. Omavastuut maksaa työnantaja kummassakin.'], ch);
}
// palautustarkastus: jokainen paikka tai vaurio huomataan 75 %:n todennäköisyydellä
function tsaInspect(T) {
  let mbF = 0, dF = [], missed = 0;
  for (let i = 0; i < T.mb; i++) { if (RND() < 0.75) mbF++; else missed++; }
  T.dmg.forEach(d => { if (RND() < 0.75) dF.push(d); else missed++; });
  return {mbF, dF, missed, bill: mbF*1200 + dF.reduce((s,d)=>s+d,0)};
}
function tsaBill() { return tsaInspect(S.tsa).bill; }
function tsaReturn(title, text, offerNew) {
  const T = S.tsa; if (!T) return next();
  const I = tsaInspect(T), b = I.bill;
  S.tsa = null;
  const lines = [text, `Palautustarkastus: ${C(T.c).name}.`];
  if (I.mbF) lines.push(`!Tarkastaja koputteli mikrobetonipaikkoja: ${I.mbF} kpl × 1 200 €.`);
  if (I.dF.length) lines.push(`!Korjaamattomat vauriot: ${I.dF.length} kpl, ${eur(I.dF.reduce((s,d)=>s+d,0))}.`);
  if (I.missed) lines.push(`+Tarkastajalta jäi huomaamatta ${I.missed} ${I.missed===1?'kohta':'kohtaa'}. Hiljaa nyt.`);
  if (b) { payOrVippi(b); lines.push(`!Lasku yhteensä ${eur(b)}.`); } else lines.push(I.missed ? '+Lasku 0 €. Kukaan ei huomannut mitään.' : '+Auto palautettiin moitteettomana.');
  if (!working().length) lines.push('!Sinulla ei ole nyt toimivaa omaa autoa.');
  if (offerNew && RND()<0.6) Q.unshift(tsaOffer);
  say(title, lines);
}
function tsaDamage(k) {
  const T = S.tsa, name = C(T.c).name;
  const t = k==='peura' ? 'PEURA!' : 'KOLHU';
  const txt = k==='peura' ? `Peura loikkasi työsuhdeauton (${name}) keulaan.` : `${name}: joku avasi oven työsuhdeauton kylkeen.`;
  const dsl = T.kind==='vapaa' ? 0 : (k==='peura' ? 120 : 60); // käyttöetu: vara-Scalan dieselit omasta pussista
  scr(t, [txt, T.kind==='vapaa' ? 'Vapaassa autoedussa firma maksaa omavastuun ja kaikki ajokulut, jos ilmoitat vahingosta.' : 'Käyttöedussa firma maksaa omavastuun, mutta ajokulut ovat sinun: korjauksen ajan tankkaat vara-auton itse.', '!Pomo on mulkero, joka miettii jo lomautuksia. Jokainen ilmoitettu kolhu nostaa lomautusriskiä.'], [
    [dsl ? `Ilmoita työnantajalle (käyttöetu: vara-auton dieselit ${eur(dsl)})` : 'Ilmoita työnantajalle (vapaa autoetu: firma maksaa kaiken)', ()=>{ payOrVippi(dsl + 48); S.boss++; say(t, ['Korjattiin firman sopimuskorjaamolla. Firma maksoi omavastuun.', '+Korjauksen ajaksi saat leasingyhtiöltä ilmaiseksi vara-autoksi Skoda Scalan.', dsl ? `!Käyttöetu: Scalan dieselit maksat itse, ${eur(dsl)}.` : '', '!Tästä ei kyllä selvitä ryyppäämättä: Coopin kaljat 48 €' + (dsl ? '.' : ', vaikka autosta ei kuluja tullutkaan.'), '!Pomo kirjasi vahingon ylös ja mulkaisi. Seuraavissa yt-neuvotteluissa sinulla on yksi miinus lisää.'].filter(Boolean)); }],
    ['Mikrobetoni (40 €): pomo ei saa tietää', ()=>{ S.cash -= 40; fixNeg(); T.mb++; say(t, ['Kukaan ei huomaa mitään. Ainakaan ennen palautustarkastusta, jossa noin kolme paikkaa neljästä jää kiinni.']); }],
    [`Salaa ja jätä (laskutetaan palautuksessa ${eur(k==='peura'?2500:800)})`, ()=>{ T.dmg.push(k==='peura'?2500:800); say(t, ['Ehkä sitä ei huomata. Tarkastaja huomaa noin kolme neljästä.']); }],
  ]);
}

// ---------- AUTOLIIKE ----------
function listPrice(i, soh) {
  const k = C(i);
  if (k.fl.includes('V')) return r100(k.price * (1 - rnd(0.32, 0.45)));
  if (k.fl.includes('N')) return k.price;
  const age = Math.pow(1-k.dep, (S.m-1)/12);
  const fake = {c:i, soh};
  return Math.max(500, r100(k.price * age * mult(fake) * rnd(0.92,1.08)));
}
function genStock() {
  const used = CARS.map((_,i)=>i).filter(i=>!C(i).fl.includes('N'));
  const cheap = used.filter(i=>C(i).price<=20000), mid = used.filter(i=>C(i).price>20000 && C(i).price<=60000);
  const ids = new Set([pick(cheap), pick(cheap), pick(cheap), pick(mid), pick(mid), ri(1,CARS.length-1)]);
  if (RND() < 0.15) ids.add(pick(TARGETS[S.target].ids));
  if (RND() < 0.5) ids.add(pick(CARS.map((_,i)=>i).filter(i=>C(i).fl.includes('N'))));
  if (RND() < 0.2) ids.add(CARS.findIndex(a=>a[5].includes('V')));
  if (S.camp) ids.add(S.camp.id);
  S.stock = [...ids].map(i => { const soh = genSoh(i); return {c:i, soh, price:listPrice(i, soh)}; }).sort((a,b)=>a.price-b.price);
}
function dealer() {
  if (!S.stock) genStock();
  const ch = S.stock.map(s => {
    const k = C(s.c), camp = S.camp && S.camp.id===s.c;
    const tgt = TARGETS[S.target].ids.includes(s.c);
    return [`${k.name}: ${eur(s.price)}${s.soh!==undefined&&s.soh<100?' · akku '+s.soh+' %':''}${camp?' · KAMPANJA':''}${tgt?' ★':''}`, ()=>carDetail(s)];
  });
  ch.push(['Takaisin', menu]);
  scr('AUTOLIIKE', ['Liikkeen tarjonta tässä kuussa. Rahoitus järjestyy aina, melkein.'], ch);
}
function newValue(s) {
  const k = C(s.c);
  if (k.fl.includes('N')) { const camp = S.camp && S.camp.id===s.c ? S.camp.amt : 0; return Math.min(s.price*0.85, (s.price - camp)*0.95); }
  return s.price * 0.93;
}
function carDetail(s) {
  const k = C(s.c);
  const lines = [
    `${k.name}`, `Hinta ${eur(s.price)}. Arvo heti oston jälkeen noin ${eur(newValue(s))}.`,
    `Käyttökulut ${eur(k.run)}/kk${k.type==='b'?' (bensa/diesel)':k.type==='h'?' (hybridi)':''}`,
    `Arvonlasku noin ${Math.round(k.dep*100)} % vuodessa`,
    `Tunnettu vika: ${k.fault}`,
  ];
  { const age = modelAge(s.c), wy = brandWarrYears(k), w = Math.max(0, Math.round((wy-age)*12)), bw = k.type==='e'&&wy>0 ? Math.max(0, Math.round((8-age)*12)) : 0;
    lines.push(`Takuu: ${w ? 'tehdastakuu '+w+' kk' : 'tehdastakuu päättynyt'}${bw ? ', akkutakuu '+bw+' kk' : ''}${k.fl.includes('N') ? '' : ', liikkeen virhevastuu 6 kk'}${/^Toyota/.test(k.name)&&age<10?' (Toyota: merkkihuolto pidentää)':''}`); }
  if (s.soh!==undefined) lines.push(`${s.soh<80?'!':''}Akun kunto ${s.soh} %${battCost(k)?' · uusi akku '+eur(battCost(k)):' · akku vuokralla'}${s.soh<80?': toimintamatka on jo heikko':''}`);
  if (k.fl.includes('V')) lines.push(`+Kova alennus listahinnasta (${eur(k.price)}). Iso pakettiauto: voit alkaa tehdä muuttokeikkoja.`, '!Pakettiautojen jälleenmyyntiarvo laskee nopeasti.');
  if (k.fl.includes('F')) lines.push('+Ilmaiset superit siirtyvät autolle: käyttökulut vain vakuutus, sähkön hintapiikit eivät koske.', '!650 000 km: vikoja tulee moninkertaisesti, ja ne ovat kalliita. Akku on vaihdettu kerran.');
  if (k.fl.includes('S')) lines.push('!Lyhyt toimintamatka: et ehdi työmatkoille latauksilta, ja lomautusriski moninkertaistuu.');
  const ch = [];
  S.cars.forEach(car => {
    const camp = S.camp && S.camp.id===s.c ? S.camp.amt : 0;
    const h = r100(val(car)*0.88) + camp;
    ch.push([`Osta, vaihtoon ${C(car.c).name} (hyvitys ${eur(h)}, laina ${eur(car.loan?car.loan.bal:0)})`, ()=>finance(s, car, h)]);
  });
  ch.push([`Osta ilman vaihtoa${slots()>=2?' (max 2 autoa)':''}`, ()=>finance(s, null, 0), slots()>=2]);
  ch.push(['Takaisin', dealer]);
  scr('AUTOLIIKE', lines, ch);
}
function rateOffers(isNew) {
  let base = isNew ? pick([1.9,3.9]) : pick([3.9,5.9,8]);
  let zero = isNew && RND()<0.6;
  const adj = r => Math.max(0, Math.min(8, S.mark ? Math.max(r+2,5.9) : r + S.rate));
  return {zero: zero && !S.mark ? 0 : adj(1.9), std: adj(base)};
}
function finance(s, trade, h, R0) {
  const k = C(s.c), isNew = k.fl.includes('N');
  const lo = trade && trade.loan ? trade.loan.bal : 0;
  const need = s.price - h + lo;   // rahoitettava ennen käsirahaa
  const nv = newValue(s);
  const R = R0 || rateOffers(isNew);     // tarjous pysyy samana koko kaupan ajan
  const lines = [`${k.name}: ${eur(s.price)}`];
  if (trade) lines.push(`Vaihtoauto ${C(trade.c).name}: hyvitys ${eur(h)}`);
  if (lo) lines.push(`Vaihtoauton laina ${eur(lo)} maksetaan pois hyvityksestä.`);
  if (trade && lo > h) lines.push(`!Vanhaa velkaa vyörytetään uuteen lainaan ${eur(lo-h)}.`);
  lines.push(`Maksettavaa ${eur(Math.max(0,need))}. Kassa ${eur(S.cash)}.`);
  lines.push(`Uuden auton arvo heti noin ${eur(nv)}.`);
  lines.push('Paljonko laitat käsirahaa?');
  const ch = [];
  if (need <= 0) {
    ch.push([`Kauppa: saat välirahaa ${eur(-need)}`, ()=>doBuy(s, trade, null, need)]);
  } else {
    if (S.cash >= need) ch.push([`Kaikki käteisellä ${eur(need)} (ei lainaa)`, ()=>doBuy(s, trade, null, need)]);
    const seen = new Set();
    const add = (lbl, d) => {
      d = Math.max(0, r100(d));
      if (seen.has(d) || d > S.cash || d >= need) return;
      seen.add(d);
      ch.push([`${lbl}: ${eur(d)}`, ()=>loanTerms(s, trade, h, need, nv, R, d)]);
    };
    add('Ei käsirahaa', 0);
    [10,20,30,50].forEach(p => add(`Käsiraha ${p} %`, s.price*p/100));
    if (S.cash - 300 >= 500) add('Koko kassa paitsi 300 €', S.cash - 300);
  }
  ch.push(['Peru', dealer]);
  scr('KÄSIRAHA', lines, ch);
}
function loanTerms(s, trade, h, need, nv, R, d) {
  const isNew = C(s.c).fl.includes('N');
  const L = need - d;
  const cap = nv * (S.mark ? 1.15 : 1.4);
  const ok = L <= cap;
  const other = S.cars.filter(c=>c!==trade && c.loan).reduce((s,c)=>s+c.loan.pay,0);
  const maxPay = S.income * 0.6 - other;
  const lines = [`${C(s.c).name}`, `Käsiraha ${eur(d)}, lainaa ${eur(L)} (${Math.round(L/nv*100)} % auton arvosta).`];
  if (!ok) lines.push(`!Rahoitusyhtiö hylkää: laina saa olla enintään ${Math.round(cap/nv*100)} % auton arvosta.`);
  lines.push(`Maksukyky: kaikki erät yhteensä enintään 60 % tulosta, eli tähän lainaan enintään ${eur(Math.max(0,maxPay))}/kk.`);
  if (S.layoff) lines.push('!Olet lomautettuna. Rahoittaja katsoo silti normaalia tuloa, mutta erät pitää maksaa puolikkaalla.');
  if (S.mark) lines.push('!Maksuhäiriömerkintä nostaa korkoa.');
  const opts = [
    {lbl:'84 kk + jämäri 35 %', n:84, B:0.35, r: isNew ? R.zero : R.std},
    {lbl:'84 kk', n:84, B:0, r:R.std},
    {lbl:'60 kk', n:60, B:0, r:R.std},
    {lbl:'36 kk', n:36, B:0, r:R.std},
  ];
  const ch = opts.map(o => {
    const B = Math.min(r100(s.price*o.B), r100(L*0.9));
    const pay = annuity(L, o.r/1200, o.n, B);
    const tot = pay*o.n + B + d;
    const aff = pay <= maxPay;
    return [`${o.lbl} · ${pct(o.r)} · ${eur(pay)}/kk · yht. ${eur(tot)}${aff?'':' · HYLÄTTY (maksukyky)'}`, ()=>doBuy(s, trade, {bal:L, r:o.r/1200, n:o.n, B, pay}, d), !ok || !aff];
  });
  ch.push(['Muuta käsirahaa', ()=>finance(s, trade, h, R)]);
  ch.push(['Peru', dealer]);
  scr('LAINA-AIKA', lines, ch);
}
function doBuy(s, trade, loan, paid) {
  const k = C(s.c);
  if (trade) S.cars.splice(S.cars.indexOf(trade), 1);
  if (!loan) S.cash -= paid; else S.cash -= paid;   // käteinen tai käsiraha (negatiivinen = väliraha)
  const nv = newValue(s);
  const car = {c:s.c, base:0, loan, broken:0, mb:0, sale:0, soh:s.soh, held:0, newBuy:C(s.c).fl.includes('N'), paid:s.price, bought:S.m};
  car.base = nv / mult(car);
  setWarranty(car, !C(s.c).fl.includes('N'));
  S.cars.push(car);
  S.stock = S.stock.filter(x=>x!==s);
  const lines = [`+${k.name} on sinun!`];
  if (loan) lines.push(`Laina ${eur(loan.bal)}, auton arvo ${eur(nv)}.`);
  if (loan && loan.bal > nv) lines.push('!Olet veden alla heti ensimmäisenä päivänä.');
  if (TARGETS[S.target].ids.includes(s.c)) lines.push('+TAVOITEAUTO PIHASSA! Nyt pitää vain pysyä pois vankilasta.');
  lines.push(`Takuu: ${warrTxt(car)}.`);
  const ext = k.price > 50000 ? 70 : 30;
  scr('KAUPPA TEHTY', lines, [
    ['Jatka', next],
    [`Osta jatkotakuu ${eur(ext)}/kk (maksaa 80 % vioista, ei akkua eikä mikrobetonia)`, ()=>{ car.ext = ext; say('JATKOTAKUU', ['Jatkotakuu voimassa niin kauan kuin omistat auton.']); }],
  ]);
}

// ---------- HUUTOKAUPPA ----------
function auction() {
  S.auctionDone = true;
  const used = CARS.map((_,i)=>i).filter(i=>!C(i).fl.includes('N') && C(i).price<=85000);
  const id = pick(used);
  const soh = genSoh(id);
  const V = listPrice(id, soh) * 0.95;
  const crazy = RND()<0.12;
  const A = {id, V, soh, est: r100(V*rnd(0.9,1.1)), bid: Math.max(100, r100(V*0.35)), lead:'opp', max: crazy ? V*rnd(1.05,1.2) : V*rnd(0.6,0.95), hidden: RND()<0.35};
  auctionRound(A, [`Kohde: ${C(id).name}`, `Myyjän arvio ${eur(A.est)}. Ei takuuta, ei koeajoa.`].concat(soh!==undefined ? [`Myyjän ilmoittama akun kunto ${soh} % (ei tarkistettu)`] : []));
}
function auctionRound(A, pre) {
  const lines = (pre||[]).concat([`Korkein tarjous ${eur(A.bid)} (${A.lead==='me'?'SINÄ':'muu huutaja'})`]);
  const slot = slots() < 2;
  const ch = [
    [`Huuda ${eur(A.bid+100)}`, ()=>myBid(A, A.bid+100), !slot],
    [`Huuda ${eur(A.bid+500)}`, ()=>myBid(A, A.bid+500), !slot],
    ['Luovuta', ()=>say('HUUTOKAUPPA', ['Annoit toisen viedä. Ehkä hyvä niin.'])],
  ];
  if (!slot) lines.push('!Sinulla on jo 2 autoa. Myy ensin yksi.');
  scr('HUUTOKAUPAT.COM', lines, ch);
}
function myBid(A, b) {
  A.bid = b; A.lead = 'me';
  if (b > A.max) return auctionWin(A);
  A.bid = Math.min(r100(A.max), b + ri(1,4)*100); if (A.bid <= b) A.bid = b + 100;
  A.lead = 'opp';
  if (A.bid > A.max + 100) { A.bid = b; A.lead = 'me'; return auctionWin(A); }
  auctionRound(A, [`${C(A.id).name}, arvio ${eur(A.est)}`, 'Joku huusi heti perään!']);
}
function auctionWin(A) {
  const total = Math.round(A.bid * 1.03);
  const rate = S.mark ? 14.9 : 12.9;
  const ch = [];
  ch.push([`Maksa käteisellä ${eur(total)}`, ()=>auctionPay(A, total, null), S.cash < total]);
  const pay = annuity(total, rate/1200, 36);
  const other = S.cars.reduce((s,c)=>s+(c.loan?c.loan.pay:0),0);
  const aff = other + pay <= S.income*0.6;
  ch.push([`Kulutusluotto ${pct(rate)}, 36 kk · ${eur(pay)}/kk${aff?'':' · HYLÄTTY (maksukyky)'}`, ()=>auctionPay(A, total, {bal:total, r:rate/1200, n:36, B:0, pay}), !aff]);
  ch.push(['En pysty maksamaan (sakko 300 €)', ()=>{ payOrVippi(300); S.mark = 12; say('HUUTOKAUPPA', ['!Kauppa purettiin. Sakko 300 € ja maksuhäiriömerkintä.']); }]);
  scr('VOITIT HUUTOKAUPAN!', [`${C(A.id).name} hintaan ${eur(A.bid)} + 3 % huutokauppapalkkio.`], ch);
}
function auctionPay(A, total, loan) {
  if (!loan) S.cash -= total;
  const car = {c:A.id, base:0, loan, broken:0, mb:0, sale:0, soh:A.soh, held:0};
  car.base = A.V / mult(car);
  setWarranty(car, false);
  S.cars.push(car);
  const lines = [`+${C(A.id).name} on sinun.`];
  if (A.hidden) {
    if (RND()<0.5) { car.base *= 0.75; lines.push('!Piilovika: kori on kitattu ja maalattu. Arvo −25 %.'); }
    else { const c = Math.round(C(A.id).fcost*rnd(0.8,1.2)/10)*10; if (DRIVABLE.has(C(A.id).fault)) car.minor = c; else car.broken = c; lines.push(`!Piilovika: ${C(A.id).fault}. Korjaus ${eur(c)}${car.broken?', ei ajokunnossa':', auto kulkee'}.`); }
  } else lines.push('Hyvä löytö, ei yllätyksiä!');
  say('HUUTOKAUPPA', lines);
}

// ---------- MYYNTI ----------
function sellMenu() {
  const ch = S.cars.map(car => [`${C(car.c).name}${sohTxt(car)}: arvo ${eur(val(car))}, laina ${eur(car.loan?car.loan.bal:0)}${car.sale?' (myynnissä)':''}`, ()=>sellCar(car), !!car.sale]);
  ch.push(['Takaisin', menu]);
  scr('MYY AUTO', ['Mikä auto myydään?'], ch);
}
function sellCar(car) {
  const v = val(car), av = r100(v * (car.broken ? 0.7 : 0.82) * Math.pow(0.9, car.mb));
  const L = car.loan ? car.loan.bal : 0;
  const ch = [
    [`Autovex heti: ${eur(av)}${av<L?' (ei kata lainaa)':''}`, ()=>settle(car, av, 'Autovex')],
    [`Yksityismyynti: noin ${eur(r100(v*0.97*Math.pow(0.88, car.mb)))}, kestää 1–3 kk`, ()=>{ car.sale = ri(1,3); say('MYYNTI', ['Ilmoitus jätetty. Erät juoksevat sillä välin.', car.mb?'!MB-merkintä näkyy kuvissa. Ostajat tinkivät.':'']); }, !!car.broken],
    ['Takaisin', sellMenu],
  ];
  scr('MYY AUTO', [`${C(car.c).name}`, `Laina ${eur(L)}`], ch);
}
function settle(car, price, who) {
  const L = car.loan ? car.loan.bal : 0, net = price - L;
  if (net >= 0) { S.cars.splice(S.cars.indexOf(car),1); S.cash += net; return say('MYYTY', [`${who} maksoi ${eur(price)}.`, L?`Laina ${eur(L)} maksettiin pois.`:'', `+Kassaan ${eur(net)}.`]); }
  const gap = -net;
  scr('VELKAA JÄÄ', [`${who} maksaa ${eur(price)}, mutta lainaa on ${eur(L)}.`, `!Erotus ${eur(gap)} pitää maksaa ennen kuin rahoitusyhtiö vapauttaa auton.`], [
    [`Maksa erotus käteisellä`, ()=>{ S.cash -= gap; S.cars.splice(S.cars.indexOf(car),1); say('MYYTY', ['Vapaus maksoi, mutta olet vapaa.']); }, S.cash < gap],
    ['Kuittaa erotus pikavipillä', ()=>{ addVippi(gap); S.cars.splice(S.cars.indexOf(car),1); say('MYYTY', ['!Auto lähti, velka jäi ja kasvaa nyt 20 %/kk.']); }],
    ['Peru kauppa', menu],
  ]);
}
function privateSaleDone(car) {
  if (!S.cars.includes(car)) return next();
  const price = r100(val(car) * 0.97 * Math.pow(0.88, car.mb) * rnd(0.95,1.05));
  const L = car.loan ? car.loan.bal : 0;
  if (price >= L || S.cash >= L - price) { const n = price - L; S.cars.splice(S.cars.indexOf(car),1); S.cash += n;
    return say('YKSITYISMYYNTI', [`+${C(car.c).name} myytiin hintaan ${eur(price)}.`, L?`Laina ${eur(L)} maksettiin pois.`:'', n>=0?`Kassaan ${eur(n)}.`:`!Erotus ${eur(-n)} maksettiin kassasta.`]); }
  say('YKSITYISMYYNTI', [`!Ostaja löytyi hintaan ${eur(price)}, mutta lainaa on ${eur(L)}, eikä kassa riitä erotukseen.`, 'Kauppa kaatui.']);
}

// ---------- KORJAAMO ----------
function repairMenu() {
  const ch = S.cars.filter(c=>c.broken).map(car => [`${C(car.c).name}: ${eur(car.broken)} (ei ajokunnossa)`, ()=>repairChoice(car, 'KORJAAMO', `${C(car.c).name}, korjaus ${eur(car.broken)}`)]);
  S.cars.filter(c=>c.minor).forEach(car => ch.push([`${C(car.c).name}: korjaamattomat pikkuviat ${eur(car.minor)}`, ()=>{ payOrVippi(car.minor); car.minor = 0; say('KORJAAMO', ['Pikkuviat korjattu. Myyntihinta palautui.']); }]));
  ch.push(['Takaisin', menu]);
  scr('KORJAAMO', ['Mikä korjataan?'], ch);
}

// ---------- LOPPU ----------
function endLines(seized) {
  const v = S.cars.reduce((s,c)=>s+val(c)*0.82*Math.pow(0.9,c.mb),0), l = totalLoan();
  const invV = S.inv.tsla + S.inv.doge;
  const eq = v - l + S.cash + invV;
  const t = TARGETS[S.target];
  const lines = [`Autojen arvo Autovexin hinnoin ${eur(v)}`, `Velat ${eur(l)}`, `Kassa ${eur(S.cash)}`].concat(invV ? [`Sijoitukset ${eur(invV)}`] : []).concat([ `Nettovarallisuus ${eur(eq)}`, `Kuukausia vankilassa: ${S.jail}/84`]);
  if (S.kimppaPaid) lines.push(`Kimppaan meni ${eur(S.kimppaPaid)}, takaisin tuli ${eur(S.kimppaWon)}.`);
  if (seized && l <= 0) { lines.push('', 'Velat saatiin maksettua autoilla, mutta autot ovat poissa. Vapaa, mutta jalan.'); S.score = Math.max(0, Math.round(eq/10)); lines.push(`+PISTEET: ${S.score}`); }
  else if (seized || l > v) { lines.push('', '!█ VANKILA █', seized ? '!Autot menivät, ja velkaa jäi silti.' : '!Lainaa on enemmän kuin autoista saisi Autovexiltä.'); S.score = 0; }
  else {
    const own = ownsTarget();
    const cage = !own && S.tsaEnd && t.ids.includes(S.tsaEnd.c);
    const jf = Math.max(0.3, 1 - S.jail/84);
    S.score = Math.max(0, Math.round(eq/10 * (own ? 1 + t.mult : cage ? 1 + t.mult/2 : 1) * jf));
    if (cage) lines.push(`Tavoiteauto oli työsuhdeautona: kultainen häkki, kerroin ×${(1+t.mult/2).toString().replace('.',',')}.`);
    if (S.jail) lines.push(`Vankilakuukaudet leikkaavat pisteitä: ×${(Math.round(jf*100)/100).toString().replace('.',',')}`);
    lines.push('', own ? `+${t.name} pihassa, eikä vankilaa! Tavoitekerroin ×${1+t.mult}.` : cage ? `+Vapaa, ja ${t.name} oli alla, mutta firman piikkiin.` : `Vapaa, mutta ${t.name} jäi haaveeksi.`);
    lines.push(`+PISTEET: ${S.score}`);
  }
  return lines;
}
function endGame() {
  if (Drive.active) Drive.stop();
  S.over = true;
  const pre = [];
  if (S.tsa) { const b = tsaBill(); S.cash -= b; pre.push(`Työsuhdeauton palautustarkastus: ${eur(b)}`, ''); S.tsaEnd = S.tsa; S.tsa = null; }
  scr('84 KK TÄYNNÄ', pre.concat(endLines(false)), [['Uusi peli', start]]);
}

// ---------- TILARIVI ----------
function status() {
  if (!S) return null;
  const v = totalVal(), l = totalLoan();
  const ratio = v>0 ? l/v : (l>0?9:0);
  return {month: S.m, cash: S.cash, income: S.layoff?Math.round(S.income/2):S.income, vippi: S.vippi, v, l, ratio,
    pay: S.cars.reduce((s,c)=>s+(c.loan?c.loan.pay:0),0), target: TARGETS[S.target].name, own: ownsTarget(),
    cars: S.cars.map(c=>({name:C(c.c).name + (c.soh!==undefined?` (akku ${Math.round(c.soh)} %)`:''), v:val(c), l:c.loan?c.loan.bal:0, broken:!!c.broken, mb:c.mb})).concat(S.tsa?[{name:C(S.tsa.c).name+' (TSA)', v:0, l:0, broken:false, mb:S.tsa.mb}]:[])};
}

if (typeof module !== 'undefined' && module.exports) module.exports = { start, setUI:u=>{UI=u;}, setRnd:f=>{RND=f;}, getS:()=>S, status, eur };

(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  let current = [];
  function renderStatus(){
    const st = status(), el = $('status');
    if (!st) { el.hidden = true; return; }
    el.hidden = false;
    const r = st.ratio, N = 20, fill = Math.min(N, Math.round(Math.min(r,2)/2*N));
    let bar = ''; for (let i=0;i<N;i++) bar += (i<fill ? '█' : (i===N/2 ? '|' : '·'));
    const jail = st.l > st.v && st.l > 0;
    const cars = st.cars.map(c => `${esc(c.name)}${c.mb?' [MB]':''}${c.broken?' [RIKKI]':''}`).join(' + ') || 'ei autoa';
    el.innerHTML =
      `<div class="row"><span>KK ${st.month}/84</span><span>KASSA ${eur(st.cash)}</span><span>TULO ${eur(st.income)}</span></div>`+
      `<div class="row"><span>ERÄT ${eur(st.pay)}/kk</span><span>${st.vippi>0?'<span class="jail">VIPPI '+eur(st.vippi)+'</span>':'VIPPI 0 €'}</span></div>`+
      `<div class="row"><span>ARVO ${eur(st.v)}</span><span>LAINAT ${eur(st.l)}</span></div>`+
      `<div class="row"><span class="bar">[${bar}]</span><span>${st.l>0?Math.round(r*100)+' %':'VELATON'} ${jail?'<span class="jail">VANKILA!</span>':''}</span></div>`+
      `<div>${cars}</div>`+
      `<div>TAVOITE: ${esc(st.target)}${st.own?' ★ PIHASSA':''}</div>`;
  }
  UI = ({ show(s){
    renderStatus();
    $('title').textContent = s.title;
    $('lines').innerHTML = s.lines.filter(l=>l!=='' || true).map(l => {
      if (l==='') return '<p>&nbsp;</p>';
      const c = l[0]==='!' ? 'r' : l[0]==='+' ? 'g' : '';
      return `<p class="${c}">${esc(c ? l.slice(1) : l)}</p>`;
    }).join('');
    const box = $('choices'); box.innerHTML = ''; current = s.choices;
    s.choices.forEach((c,i) => {
      const b = document.createElement('button');
      b.innerHTML = (i<9?`<span class="k">${i+1}</span>`:'') + esc(c.t);
      if (c.t.startsWith('PAALAAN')) b.className = 'paa';
      b.disabled = c.dis;
      b.onclick = () => { if (!c.dis) { c.f(); window.scrollTo(0,0); } };
      box.appendChild(b);
    });
  }});
  document.addEventListener('keydown', e => {
    if (Drive.blockKeys()) return;
    const n = parseInt(e.key,10);
    if (n>=1 && n<=9 && current[n-1] && !current[n-1].dis) { current[n-1].f(); window.scrollTo(0,0); }
  });
  start();
})();
