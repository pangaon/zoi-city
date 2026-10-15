// Controlled boundary only. Actual Profile, normalization, Food model/component
// execute unchanged; unrelated Auth/native route panels have no fixture journey.
const client={request:(...args)=>window.foodRequest(...args)};
export function useAuth(){return{client};}
export function BookingPanel(){return null;}
export function EventHomeTools(){return null;}
export function ArtistHome(){return null;}
