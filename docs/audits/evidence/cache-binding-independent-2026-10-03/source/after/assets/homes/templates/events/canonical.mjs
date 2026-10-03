import {mountEventActions} from './client.mjs?v=20261003-guest-plans';

const root = document.getElementById('event-home');
const data = document.getElementById('event-home-content');
if (root && data) {
  try {
    const {entity} = JSON.parse(data.textContent);
    mountEventActions(entity, root);
    const artists = root.querySelector('[data-event-artists]');
    if (artists && entity.generic === true && entity.family === 'event') {
      import('/assets/trips/event-artists.mjs?v=20260930-connections')
        .then(({mountEventArtists}) => {
          if (artists.isConnected) mountEventArtists(artists, {eventId: entity.id, core: window.ZoiCore});
        })
        .catch(() => { artists.hidden = true; });
    }
    const reservations = root.querySelector('[data-event-reservations]');
    if (reservations && entity.generic === true && entity.family === 'event') {
      let loading = false;
      const start = async () => {
        if (loading) return;
        loading = true;
        reservations.textContent = 'Checking table availability…';
        try {
          const {mountEventReservations} = await import('/assets/tickets/event-reservations.mjs');
          if (!reservations.isConnected) return;
          await mountEventReservations(reservations, {eventId: entity.id, core: window.ZoiCore});
        } catch {
          reservations.replaceChildren();
          const message = document.createElement('p');
          message.textContent = 'Table availability could not load.';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Try again';
          retry.addEventListener('click', start, {once: true});
          reservations.append(message, retry);
        } finally {
          loading = false;
        }
      };
      start();
    }
  } catch {
    const note = document.createElement('p');
    note.textContent = 'Planning tools could not load. Refresh to retry; official contact links remain available.';
    root.append(note);
  }
}
