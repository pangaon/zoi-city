import {PARISH,MINISTRIES,PARISH_DETAILS} from './data.mjs';
import {mountChurch} from './mount.mjs';
mountChurch(document.querySelector('#church-home'),{...PARISH,ministries:MINISTRIES,details:PARISH_DETAILS},document.body.dataset.template);
