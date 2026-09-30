import {PARISH,MINISTRIES} from './data.mjs';
import {mountChurch} from './mount.mjs';
mountChurch(document.querySelector('#church-home'),{...PARISH,ministries:MINISTRIES},document.body.dataset.template);
