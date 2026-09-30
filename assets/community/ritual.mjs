export const WOTD = [
  ['Φιλοξενία', 'filo-xe-NEE-a', 'Love of the stranger — the duty to treat a guest as sacred'],
  ['Μεράκι', 'me-RA-ki', 'Doing something with your soul in it'],
  ['Κέφι', 'KE-fi', 'The high spirit that takes over a room'],
  ['Παρέα', 'pa-RE-a', 'The company you keep — the point of the evening'],
  ['Νόστος', 'NO-stos', 'The homecoming; the root of nostalgia'],
  ['Φιλότιμο', 'filo-TI-mo', 'Love of honour — doing right without being asked'],
  ['Ελευθερία', 'elef-the-REE-a', 'Freedom'],
  ['Αγάπη', 'a-GA-pi', 'Love'],
  ['Χαρά', 'ha-RA', 'Joy'],
  ['Γλέντι', 'GLEN-di', 'A feast that turns into music and dancing'],
  ['Σιγά σιγά', 'si-GA si-GA', 'Slowly, slowly — an instruction and a philosophy'],
  ['Ψυχή', 'psi-HEE', 'Soul'],
  ['Θάλασσα', 'THA-la-sa', 'The sea'],
  ['Παλικάρι', 'pali-KA-ri', 'A young man of courage'],
  ['Ευχαριστώ', 'efhari-STO', 'Thank you'],
];
export function todayISO(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dayIndex(iso){
  return Math.floor(Date.UTC(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)) / 86400000);
}

export function dailyRitual(calendar,date=todayISO()){const info=calendar.dayInfo(date);return{date,word:WOTD[((dayIndex(date)%WOTD.length)+WOTD.length)%WOTD.length],namedays:info.namedays,feasts:info.feasts,next:calendar.upcomingFeasts(date,60)[0]||null};}
