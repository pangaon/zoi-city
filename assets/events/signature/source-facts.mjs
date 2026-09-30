// Public source facts plus explicitly separated user-provided planning notes.
// No inventory, confirmed reservation, tax or checkout calculation is derived here.
export const SIGNATURE_EVENT=Object.freeze({
 id:'giannis-ploutarchos-andromache-toronto-2027',
 title:'Giannis Ploutarchos & Andromache',
 organizer:'Signature Productions',venue:'Parkview Manor',
 date:'2027-03-20',timezone:'America/Toronto',doors:'20:00',show:'22:00',
 source:'https://www.signatureproductions.ca/giannisploutarchosandromache',
 venueSource:'https://www.parkviewmanor.ca/',
 poster:'/assets/events/signature/poster.jpg',floorplan:'/assets/events/signature/floorplan.jpg',
 venueTour:'https://my.matterport.com/show/?m=kXAxeNYqWZ8',
 foodService:false,sourceSeatsPerTableOrBooth:10,
 priceBands:Object.freeze([100,125,150,175,200,275]),
 priceUnit:'per_guest',currency:null,taxesIncluded:null,
 inventoryStatus:'unconfigured',paymentStatus:'unconfigured',
});
export const BOOTH_PLANNING_NOTES=Object.freeze([
 Object.freeze({id:'front-facing-couches',name:'Front-stage lounge booth',description:'Two facing five-seat white couches with a table between them.',approximateCapacity:10,source:'user_description',confirmedTableIds:Object.freeze([]),sellableCapacity:null}),
 Object.freeze({id:'side-open-lounge',name:'Side-stage lounge booth',description:'White couch seating in an open rectangular arrangement with space through the middle.',approximateCapacity:25,capacityQualifier:'or more',source:'user_description',confirmedTableIds:Object.freeze([]),sellableCapacity:null}),
]);
