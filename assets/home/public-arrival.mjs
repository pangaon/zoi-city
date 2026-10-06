/* Progressive enhancement: every destination remains an ordinary public link. */
const rail = document.querySelector('.za-rail');
const controls = document.querySelector('.za-rail-controls');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (rail && controls) {
  controls.hidden = false;
  const buttons = [...controls.querySelectorAll('[data-za-scroll]')];
  const update = () => {
    const end = rail.scrollWidth - rail.clientWidth;
    buttons[0].disabled = rail.scrollLeft < 3;
    buttons[1].disabled = rail.scrollLeft >= end - 3;
  };
  const move = direction => {
    const card = rail.querySelector('a');
    rail.scrollBy({left: direction * ((card?.getBoundingClientRect().width || rail.clientWidth) + 16), behavior: motion.matches ? 'instant' : 'smooth'});
  };
  buttons.forEach(button => button.addEventListener('click', () => move(Number(button.dataset.zaScroll))));
  rail.addEventListener('keydown', event => {
    if (event.target !== rail) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); rail.scrollTo({left: event.key === 'Home' ? 0 : rail.scrollWidth, behavior: motion.matches ? 'instant' : 'smooth'}); }
  });
  rail.addEventListener('scroll', update, {passive:true});
  new ResizeObserver(update).observe(rail);
  update();
}
const choices = [...document.querySelectorAll('[data-za-path]')];
const panels = ['people','business'].map(path => document.getElementById(`za-${path}`));
function choose(path, announce = false) {
  choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.zaPath === path)));
  panels.forEach(panel => { if (panel) panel.hidden = panel.id !== `za-${path}`; });
  if (announce) document.querySelector('.za-path-status').textContent = path === 'people' ? 'Explore Zoi as a person or guest.' : 'Explore business and community owner tools.';
}
if (choices.length && panels.every(Boolean)) {
  choose('people');
  choices.forEach(button => button.addEventListener('click', () => choose(button.dataset.zaPath, true)));
}
const originalPhoto = document.querySelector('.za-photo img');
if (originalPhoto) {
  const unavailable = () => {
    originalPhoto.hidden = true;
    originalPhoto.closest('.za-photo').classList.add('za-photo-unavailable');
    const attribution = document.querySelector('.za-photo-caption > span');
    if (attribution) attribution.textContent = 'Signature Productions · previous event · photo unavailable';
  };
  originalPhoto.addEventListener('error', unavailable, {once:true});
  if (originalPhoto.complete && !originalPhoto.naturalWidth) unavailable();
}
