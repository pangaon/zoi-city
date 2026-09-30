// Exact streams published in the broadcaster's public data-player-source attributes.
// Reviewed 2026-09-30; no guessed stream paths or now-playing metadata.
export const RADIO_STATIONS=Object.freeze([
 {id:'ert-deftero',name:'Deftero Programma',greekName:'Δεύτερο Πρόγραμμα',description:'Greek songs and music programmes from ERT.',provider:'ERT εcho',source:'https://www.ertecho.gr/radio/deftero/player/',stream:'https://radiostreaming.ert.gr/ert-deftero',image:'https://www.ertecho.gr/wp-content/uploads/2025/07/deytero-logo.svg',checkedAt:'2026-09-30'},
 {id:'ert-kosmos',name:'Kosmos',greekName:'Kosmos Radio',description:'Music from around the world, selected by ERT.',provider:'ERT εcho',source:'https://www.ertecho.gr/radio/kosmos/player/',stream:'https://radiostreaming.ert.gr/ert-kosmos',image:'https://www.ertecho.gr/wp-content/uploads/2025/07/kosmos-logo-1.svg',checkedAt:'2026-09-30'},
 {id:'ert-voiceofgreece',name:'Voice of Greece',greekName:'Η Φωνή της Ελλάδας',description:'Greece’s international radio service.',provider:'ERT εcho',source:'https://www.ertecho.gr/radio/i-foni-tis-elladas/player/',stream:'https://radiostreaming.ert.gr/ert-voiceofgreece',image:'https://www.ertecho.gr/wp-content/uploads/2025/07/vog-logo.svg',checkedAt:'2026-09-30'}
]);
export function radioStation(id){return RADIO_STATIONS.find(s=>s.id===id)||null}
export function radioStatus(event,station){const name=station?.name||'Radio';return({loading:'Connecting to '+name+'…',playing:name+' is playing.',pause:'Radio paused.',stopped:'Radio stopped.',waiting:'Buffering '+name+'…',error:'This stream could not play. Retry or open the broadcaster’s player.'})[event]||'Choose a station.'}
