export {httpsImage,machineImage,imageIdentity,interfaceArtwork} from '../assets/discovery/public-listing-media.mjs';
import {profileMedia as selectProfileMedia} from '../assets/discovery/public-listing-media.mjs';
export function profileMedia(entity,profile){return selectProfileMedia(entity,profile,{allowUnbound:!entity?.id,legacyUnbound:true});}
