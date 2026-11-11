const rows = `H|Hydrogen|1.008;He|Helium|4.0026;Li|Lithium|6.94;Be|Beryllium|9.0122;B|Boron|10.81;C|Carbon|12.011;N|Nitrogen|14.007;O|Oxygen|15.999;F|Fluorine|18.998;Ne|Neon|20.180;Na|Sodium|22.990;Mg|Magnesium|24.305;Al|Aluminium|26.982;Si|Silicon|28.085;P|Phosphorus|30.974;S|Sulfur|32.06;Cl|Chlorine|35.45;Ar|Argon|39.948;K|Potassium|39.098;Ca|Calcium|40.078;Sc|Scandium|44.956;Ti|Titanium|47.867;V|Vanadium|50.942;Cr|Chromium|51.996;Mn|Manganese|54.938;Fe|Iron|55.845;Co|Cobalt|58.933;Ni|Nickel|58.693;Cu|Copper|63.546;Zn|Zinc|65.38;Ga|Gallium|69.723;Ge|Germanium|72.630;As|Arsenic|74.922;Se|Selenium|78.971;Br|Bromine|79.904;Kr|Krypton|83.798;Rb|Rubidium|85.468;Sr|Strontium|87.62;Y|Yttrium|88.906;Zr|Zirconium|91.224;Nb|Niobium|92.906;Mo|Molybdenum|95.95;Tc|Technetium|[98];Ru|Ruthenium|101.07;Rh|Rhodium|102.91;Pd|Palladium|106.42;Ag|Silver|107.87;Cd|Cadmium|112.41;In|Indium|114.82;Sn|Tin|118.71;Sb|Antimony|121.76;Te|Tellurium|127.60;I|Iodine|126.90;Xe|Xenon|131.29;Cs|Caesium|132.91;Ba|Barium|137.33;La|Lanthanum|138.91;Ce|Cerium|140.12;Pr|Praseodymium|140.91;Nd|Neodymium|144.24;Pm|Promethium|[145];Sm|Samarium|150.36;Eu|Europium|151.96;Gd|Gadolinium|157.25;Tb|Terbium|158.93;Dy|Dysprosium|162.50;Ho|Holmium|164.93;Er|Erbium|167.26;Tm|Thulium|168.93;Yb|Ytterbium|173.05;Lu|Lutetium|174.97;Hf|Hafnium|178.49;Ta|Tantalum|180.95;W|Tungsten|183.84;Re|Rhenium|186.21;Os|Osmium|190.23;Ir|Iridium|192.22;Pt|Platinum|195.08;Au|Gold|196.97;Hg|Mercury|200.59;Tl|Thallium|204.38;Pb|Lead|207.2;Bi|Bismuth|208.98;Po|Polonium|[209];At|Astatine|[210];Rn|Radon|[222];Fr|Francium|[223];Ra|Radium|[226];Ac|Actinium|[227];Th|Thorium|232.04;Pa|Protactinium|231.04;U|Uranium|238.03;Np|Neptunium|[237];Pu|Plutonium|[244];Am|Americium|[243];Cm|Curium|[247];Bk|Berkelium|[247];Cf|Californium|[251];Es|Einsteinium|[252];Fm|Fermium|[257];Md|Mendelevium|[258];No|Nobelium|[259];Lr|Lawrencium|[266];Rf|Rutherfordium|[267];Db|Dubnium|[268];Sg|Seaborgium|[269];Bh|Bohrium|[270];Hs|Hassium|[277];Mt|Meitnerium|[278];Ds|Darmstadtium|[281];Rg|Roentgenium|[282];Cn|Copernicium|[285];Nh|Nihonium|[286];Fl|Flerovium|[289];Mc|Moscovium|[290];Lv|Livermorium|[293];Ts|Tennessine|[294];Og|Oganesson|[294]`;

const superscript = value => String(value).replace(/[0-9]/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)]);
const orbitals = [[1,'s',2],[2,'s',2],[2,'p',6],[3,'s',2],[3,'p',6],[4,'s',2],[3,'d',10],[4,'p',6],[5,'s',2],[4,'d',10],[5,'p',6],[6,'s',2],[4,'f',14],[5,'d',10],[6,'p',6],[7,'s',2],[5,'f',14],[6,'d',10],[7,'p',6]];
const cores = [[2,'He'],[10,'Ne'],[18,'Ar'],[36,'Kr'],[54,'Xe'],[86,'Rn']];
const exceptions = {
  24:['[Ar]',[[3,'d',5],[4,'s',1]]],29:['[Ar]',[[3,'d',10],[4,'s',1]]],41:['[Kr]',[[4,'d',4],[5,'s',1]]],42:['[Kr]',[[4,'d',5],[5,'s',1]]],44:['[Kr]',[[4,'d',7],[5,'s',1]]],45:['[Kr]',[[4,'d',8],[5,'s',1]]],46:['[Kr]',[[4,'d',10]]],47:['[Kr]',[[4,'d',10],[5,'s',1]]],57:['[Xe]',[[5,'d',1],[6,'s',2]]],58:['[Xe]',[[4,'f',1],[5,'d',1],[6,'s',2]]],64:['[Xe]',[[4,'f',7],[5,'d',1],[6,'s',2]]],78:['[Xe]',[[4,'f',14],[5,'d',9],[6,'s',1]]],79:['[Xe]',[[4,'f',14],[5,'d',10],[6,'s',1]]],89:['[Rn]',[[6,'d',1],[7,'s',2]]],90:['[Rn]',[[6,'d',2],[7,'s',2]]],91:['[Rn]',[[5,'f',2],[6,'d',1],[7,'s',2]]],92:['[Rn]',[[5,'f',3],[6,'d',1],[7,'s',2]]],93:['[Rn]',[[5,'f',4],[6,'d',1],[7,'s',2]]],96:['[Rn]',[[5,'f',7],[6,'d',1],[7,'s',2]]],103:['[Rn]',[[5,'f',14],[7,'s',2],[7,'p',1]]]
};
function orbitalCounts(number) {
  const values = new Map();
  const special = exceptions[number];
  if (special) {
    const coreCount = cores.find(([,name]) => `[${name}]` === special[0])?.[0] || 0;
    const core = orbitalCounts(coreCount);
    for (const [key,count] of core) values.set(key,count);
    for (const [n,orbital,count] of special[1]) values.set(`${n}${orbital}`,count);
    return values;
  }
  let remaining=number;
  for (const [n,orbital,capacity] of orbitals) {
    const take=Math.min(remaining,capacity);
    if(take) values.set(`${n}${orbital}`,take);
    remaining-=take;
    if(!remaining)break;
  }
  return values;
}
function electronConfiguration(number) {
  const values=orbitalCounts(number);
  const core=[...cores].reverse().find(([count])=>count<number);
  if(!core)return orbitals.map(([n,orbital])=>{const count=values.get(`${n}${orbital}`)||0;return count?`${n}${orbital}${superscript(count)}`:'';}).filter(Boolean).join(' ');
  const [coreCount,coreName]=core,coreValues=orbitalCounts(coreCount),parts=[];
  for(const [n,orbital] of orbitals){const count=(values.get(`${n}${orbital}`)||0)-(coreValues.get(`${n}${orbital}`)||0);if(count>0)parts.push(`${n}${orbital}${superscript(count)}`);}
  return [`[${coreName}]`,...parts].join(' ');
}

const alkali = new Set(['Li','Na','K','Rb','Cs','Fr']);
const alkaline = new Set(['Be','Mg','Ca','Sr','Ba','Ra']);
const noble = new Set(['He','Ne','Ar','Kr','Xe','Rn','Og']);
const halogens = new Set(['F','Cl','Br','I','At','Ts']);
const nonmetals = new Set(['H','C','N','O','P','S','Se']);
const metalloids = new Set(['B','Si','Ge','As','Sb','Te','Po']);
const postTransition = new Set(['Al','Ga','In','Sn','Tl','Pb','Bi','Nh','Fl','Mc','Lv']);
const lanthanoids = new Set(rows.split(';').slice(56,71).map(row=>row.split('|')[0]));
const actinoids = new Set(rows.split(';').slice(88,103).map(row=>row.split('|')[0]));
const discoveries = { H:'Known since antiquity; recognized as a distinct gas by Henry Cavendish in 1766.',He:'First detected in the Sun’s spectrum in 1868 and isolated on Earth in 1895.',Li:'Identified in 1817 by Johan August Arfwedson in petalite.',B:'Isolated independently in 1808 by Gay-Lussac and Thénard, and by Humphry Davy.',C:'Known since antiquity in charcoal, soot and diamond.',N:'Characterized as a distinct part of air by Daniel Rutherford in 1772.',O:'Discovered independently by Carl Wilhelm Scheele and Joseph Priestley in the 1770s.',F:'Isolated in 1886 by Henri Moissan after decades of difficult experiments.',Ne:'Identified in 1898 by William Ramsay and Morris Travers.',Al:'Identified by Hans Christian Ørsted in 1825 and isolated in purer form by Friedrich Wöhler.',Si:'Isolated by Jöns Jacob Berzelius in 1824.',P:'Discovered in 1669 by Hennig Brand.',S:'Known since antiquity and used in early medicines and metalworking.',Cl:'Recognized as an element by Humphry Davy in 1810.',Ar:'Identified in 1894 by Lord Rayleigh and William Ramsay.',K:'Isolated in 1807 by Humphry Davy using electrolysis.',Ca:'Isolated in 1808 by Humphry Davy.',Fe:'Known since antiquity; iron meteorites were used before iron smelting.',Cu:'Worked by humans since at least 8000 BCE.',Zn:'Known in alloys for centuries; isolated as a metal in India by the 13th century.',Br:'Discovered in 1826 by Antoine Jérôme Balard.',I:'Discovered in 1811 by Bernard Courtois.',Tc:'First artificially produced element, identified in 1937 by Carlo Perrier and Emilio Segrè.',Pm:'Identified in 1945 in uranium fission products.',Po:'Discovered in 1898 by Marie and Pierre Curie.',At:'First synthesized in 1940 by Dale Corson, Kenneth MacKenzie and Emilio Segrè.',Fr:'Identified in 1939 by Marguerite Perey.',Np:'Synthesized in 1940 by Edwin McMillan and Philip Abelson.',Pu:'Synthesized in 1940 by Glenn Seaborg and collaborators.',Am:'Synthesized in 1944 by Glenn Seaborg and collaborators.',Cm:'Synthesized in 1944 by Glenn Seaborg and collaborators.',Bk:'Synthesized in 1949 by Stanley Thompson, Albert Ghiorso and Glenn Seaborg.',Cf:'Synthesized in 1950 at the University of California, Berkeley.',Es:'Identified in 1952 in debris from the first thermonuclear test.',Fm:'Identified in 1952 in debris from the first thermonuclear test.',Md:'Synthesized in 1955 by Albert Ghiorso and collaborators.',No:'First reported in 1957; later confirmed by independent teams.',Lr:'First synthesized in 1961 by Albert Ghiorso and collaborators.',Rf:'First reported in 1964; its discovery was later confirmed by international review.',Db:'Synthesized in 1968 by a team in Dubna and independently at Berkeley.',Sg:'Synthesized in 1974 by a team at Berkeley.',Bh:'Synthesized in 1981 at GSI in Darmstadt.',Hs:'Synthesized in 1984 at GSI in Darmstadt.',Mt:'First reported in 1982 at GSI in Darmstadt.',Ds:'Synthesized in 1994 at GSI in Darmstadt.',Rg:'Synthesized in 1994 at GSI in Darmstadt.',Cn:'Synthesized in 1996 at GSI in Darmstadt.',Nh:'First reported in 2004 by the RIKEN collaboration.',Fl:'Synthesized in 1998 by the Joint Institute for Nuclear Research and Lawrence Livermore National Laboratory.',Mc:'Synthesized in 2003 by the Dubna–Livermore collaboration.',Lv:'Synthesized in 2000 by the Dubna–Livermore collaboration.',Ts:'Synthesized in 2010 by the Dubna–Livermore collaboration.',Og:'First reported in 2002 by the Dubna–Livermore collaboration.' };
const applications = { H:'Fuel cells, ammonia production and the chemistry of stars.',He:'Cryogenic cooling, leak detection and protective atmospheres.',Li:'Rechargeable batteries, light alloys and specialty glass.',Be:'Aerospace alloys, X-ray windows and neutron sources.',B:'Borosilicate glass, detergents and semiconductor doping.',C:'Structural materials, fuels, electrodes and the chemistry of life.',N:'Fertilizers, inert atmospheres and cryogenic cooling.',O:'Medical oxygen, steelmaking and water treatment.',F:'Fluoropolymers, dental care and uranium processing.',Ne:'Gas-discharge lighting, indicators and high-voltage equipment.',Na:'Chemical production, heat transfer and sodium-vapor lamps.',Mg:'Lightweight alloys, flares and biological chemistry.',Al:'Transport, construction, packaging and electrical conductors.',Si:'Semiconductors, glass, silicones and solar cells.',P:'Fertilizers, detergents and biological molecules.',S:'Sulfuric acid, vulcanized rubber and agricultural chemistry.',Cl:'Water disinfection, polymers and chemical manufacture.',Ar:'Welding shields, lighting and scientific instruments.',K:'Fertilizers, specialty glass and biological electrolytes.',Ca:'Cement, steelmaking, mineral materials and biological structures.',Fe:'Steel, catalysts, tools and biological oxygen transport.',Cu:'Electrical wiring, heat exchangers and antimicrobial surfaces.',Au:'Electronics, dentistry, precision coatings and jewelry.',U:'Nuclear fuel, isotope production and geologic dating.' };
const categoryColor = { 'alkali metal':'#dfb36e','alkaline earth metal':'#d6c27d','transition metal':'#80dfdf','post-transition metal':'#a5bec8','metalloid':'#b8a6f4','reactive nonmetal':'#a9d49a','halogen':'#c3a4ee','noble gas':'#83c9e1','lanthanoid':'#db9caf','actinoid':'#e58c72' };

function groupFor(number) {
  if (number===1) return 1; if (number===2) return 18;
  if (number>=3&&number<=4) return number-2;
  if (number>=5&&number<=10) return number+8;
  if (number>=11&&number<=12) return number-10;
  if (number>=13&&number<=18) return number+0;
  if (number>=19&&number<=36) return number-18;
  if (number>=37&&number<=54) return number-36;
  if (number===55) return 1; if (number===56) return 2; if (number===57) return 3;
  if (number>=58&&number<=71) return null;
  if (number>=72&&number<=86) return number-68;
  if (number===87) return 1; if (number===88) return 2; if (number===89) return 3;
  if (number>=90&&number<=103) return null;
  return number-100;
}
function categoryFor(symbol,number) {
  if (alkali.has(symbol)) return 'alkali metal';
  if (alkaline.has(symbol)) return 'alkaline earth metal';
  if (noble.has(symbol)) return 'noble gas';
  if (halogens.has(symbol)) return 'halogen';
  if (nonmetals.has(symbol)) return 'reactive nonmetal';
  if (metalloids.has(symbol)) return 'metalloid';
  if (postTransition.has(symbol)) return 'post-transition metal';
  if (lanthanoids.has(symbol)) return 'lanthanoid';
  if (actinoids.has(symbol)) return 'actinoid';
  if ((number>=21&&number<=30)||(number>=39&&number<=48)||(number>=72&&number<=80)||(number>=104&&number<=112)) return 'transition metal';
  return 'post-transition metal';
}

export const elementList = rows.split(';').map((row,index) => {
  const [symbol,name,mass]=row.split('|'),number=index+1,category=categoryFor(symbol,number),group=groupFor(number);
  const period=number<=2?1:number<=10?2:number<=18?3:number<=36?4:number<=54?5:number<=86?6:7;
  const rowPosition=(number>=58&&number<=71)?8:(number>=90&&number<=103)?9:period;
  const tableGroup=(number>=58&&number<=71)?number-54:(number>=90&&number<=103)?number-86:group;
  const config=electronConfiguration(number),shells=Array(7).fill(0);
  for(const [key,count] of orbitalCounts(number))shells[Number(key[0])-1]+=count;
  const neutrons=Number(String(mass).replace(/[\[\]]/g,'')) - number;
  return { symbol,name,number,mass,category,group,period,tableGroup,rowPosition,config,protons:number,neutrons:Number.isFinite(neutrons)?Math.round(neutrons):Math.round(number*1.5),shells,tint:categoryColor[category],note:`${name} is classified as a ${category}. Its ${number} protons define its atomic identity, while its electron structure shapes its chemical behavior.`,history:discoveries[symbol]||(number>=93?'First synthesized in nuclear research during the second half of the 20th century.':number>=57?'Identified through 19th- and early 20th-century mineral chemistry and spectroscopy.':'Known from early chemical records or isolated as analytical chemistry developed; discovery dates vary by source.'),uses:applications[symbol]||`Studied in materials research, analytical chemistry and specialized industrial or scientific applications.`,fact:`A neutral ${name} atom has ${number} protons and ${number} electrons. The isotope shown here uses a representative mass number near ${Math.round(Number(String(mass).replace(/[\[\]]/g,'')))}.`};
});

export const elements = Object.fromEntries(elementList.map(element=>[element.symbol,element]));
export const elementCategories = [...new Set(elementList.map(element=>element.category))];
