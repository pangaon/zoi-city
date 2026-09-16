export const ZOI_LISTING_TYPES = [
  {
    key: 'church',
    label: 'Church',
    summary: 'Parishes, churches, and worship communities.',
    route: '/explore?type=church',
    capabilities: [
      'Liturgical day and feast info',
      'Service times and clergy',
      'Sacraments and giving',
      'Livestream and bulletin',
    ],
  },
  {
    key: 'organization',
    label: 'Organization',
    summary: 'Associations, foundations, and community groups.',
    route: '/explore?type=organization',
    capabilities: [
      'Membership and join CTA',
      'Meetings and upcoming events',
      'Board and committee info',
      'Donations and mission',
    ],
  },
  {
    key: 'school',
    label: 'School',
    summary: 'Schools, classes, and learning centers.',
    route: '/explore?type=school',
    capabilities: [
      'Programs and enrolment',
      'Tuition and calendars',
      'Teachers and class times',
      'Applications and admissions',
    ],
  },
  {
    key: 'event',
    label: 'Event',
    summary: 'Festivals, gatherings, and ticketed experiences.',
    route: '/explore?type=event',
    capabilities: [
      'Dates and venue details',
      'Tickets and registration',
      'Line-up and running order',
      'Promoted community listings',
    ],
  },
  {
    key: 'venue',
    label: 'Venue',
    summary: 'Spaces for hire, weddings, events, and gatherings.',
    route: '/explore?type=venue',
    capabilities: [
      'Hire and rental enquiry',
      'Capacity and floor plans',
      'Calendar and bookings',
      'Venue photos and layout',
    ],
  },
  {
    key: 'vendor',
    label: 'Vendor',
    summary: 'Shops, retailers, and specialist suppliers.',
    route: '/explore?type=vendor',
    capabilities: [
      'Product catalog and pricing',
      'Shipping and wholesale',
      'Storefront and direct orders',
      'Opening hours and photos',
    ],
  },
  {
    key: 'travel_place',
    label: 'Place to Visit',
    summary: 'Attractions, landmarks, and destinations.',
    route: '/explore?type=travel_place',
    capabilities: [
      'Highlights and best-time info',
      'Getting there guidance',
      'Opening times and photos',
      'Trip planning and discovery',
    ],
  },
  {
    key: 'sports',
    label: 'Sports Club',
    summary: 'Clubs, teams, and community sports groups.',
    route: '/explore?type=sports',
    capabilities: [
      'Teams and fixtures',
      'Results and membership',
      'Trials and club info',
      'Schedule and event updates',
    ],
  },
  {
    key: 'artist',
    label: 'Artist',
    summary: 'Musicians, bands, and performing artists.',
    route: '/explore?type=artist',
    capabilities: [
      'Audio and streaming links',
      'Tour dates and releases',
      'Video embeds and booking',
      'Press and media kit',
    ],
  },
  {
    key: 'creator',
    label: 'Creator',
    summary: 'Creators, hosts, publishers, and digital storytellers.',
    route: '/explore?type=creator',
    capabilities: [
      'Featured work and episodes',
      'Brand collaboration and media kit',
      'Watch and listen embeds',
      'Upcoming appearances and sponsorships',
    ],
  },
  {
    key: 'professional',
    label: 'Professional',
    summary: 'Practices, clinics, firms, and specialist service providers.',
    route: '/explore?type=professional',
    capabilities: [
      'Practice areas and credentials',
      'Consultation booking',
      'Languages and team info',
      'Office hours and fees',
    ],
  },
  {
    key: 'business',
    label: 'Business',
    summary: 'General businesses, dining, services, and local commerce.',
    route: '/explore?type=business',
    capabilities: [
      'Hours and booking',
      'Services and photos',
      'Local discovery and contact',
      'General business profile',
    ],
  },
  {
    key: 'hotel',
    label: 'Hotel',
    summary: 'Hotels, resorts, guesthouses, and stays.',
    route: '/explore?type=hotel',
    capabilities: [
      'Room types and rates',
      'Amenities and dining',
      'Direct booking and transfers',
      'Guest check-in and stay details',
    ],
  },
];

export const ZOI_LISTING_TYPE_MAP = Object.fromEntries(
  ZOI_LISTING_TYPES.map((type) => [type.key, type])
);
