import{test}from'node:test';import assert from'node:assert/strict';import{extractSiteImages,sourceImage,supplementaryPages}from'../../supabase/functions/zoi-enrich/_images.js';
const base='https://restaurant.example.org/';
test('JSONLD logo stays logo and real imagery becomes hero',()=>{const r=extractSiteImages('<meta property="og:image" content="/logo.jpg"><img src="/dining.jpg" width="1200">',base,{logo:'/logo.jpg'});assert.equal(r.logo.url,base+'logo.jpg');assert.equal(r.hero.url,base+'dining.jpg');assert.equal(r.photos.length,1);});
test('deduplicates responsive variants, recognizes CSS backgrounds, excludes badges and stock',()=>{const r=extractSiteImages('<img src="/dining-300x200.jpg" srcset="/dining-300x200.jpg 300w, /dining.jpg 1200w"><img src="/dining.jpg.webp"><img src="/app-store.png"><img src="/pexels-photo-123.jpg"><div style="background-image:url(/terrace.jpg)"></div>',base);assert.deepEqual(r.photos.map(x=>x.url),[base+'dining.jpg',base+'terrace.jpg']);});
test('relative image objects and alternate meta attribute order supported',()=>{const r=extractSiteImages('<meta content="/food.jpg" name="twitter:image">',base,{logo:{contentUrl:'/brand.webp'},image:[{url:'/inside.jpg'}]});assert.equal(r.logo.url,base+'brand.webp');assert.equal(r.hero.url,base+'inside.jpg');assert.equal(r.photos.length,2);});
test('rejects private addresses/credentials/data and ignores scripts',()=>{for(const u of ['http://example.org/x.jpg','https://127.0.0.1/x.jpg','https://user:pass@example.org/x','data:image/png,x','https://metadata.internal/x'])assert.equal(sourceImage(u,base),null);assert.equal(extractSiteImages('<script>"<img src=\"/fake.jpg\">"</script>',base).photos.length,0);});
test('supplements only two explicit same-origin contact/gallery pages, not forms or external links',()=>{const pages=supplementaryPages('<a href="/gallery/">Photos</a><a href="/contact/">Contact</a><a href="https://evil.example/contact">Contact</a><a href="/contact?delete=yes">Contact</a>',base);assert.deepEqual(pages,[{url:base+'gallery/',purpose:'gallery'},{url:base+'contact/',purpose:'contact'}]);});

test('small explicit header logos remain available without entering photo gallery',()=>{const r=extractSiteImages('<img src="/brand.png" class="site-logo" width="120" height="40">',base);assert.equal(r.logo.url,base+'brand.png');assert.equal(r.photos.length,0);});
test('empty or page logo values do not resolve into image URLs and logo directories are not photos',()=>{
 const result=extractSiteImages('<img src="https://cdn.example.com/logos/23131.png"><img src="/food_rating.png"><img src="/Melodia_Anzeige.jpeg"><img src="/gyro.jpeg">','https://example.com/',{logo:'',image:'https://example.com/'});
 assert.equal(result.logo.url,'https://cdn.example.com/logos/23131.png');assert.equal(result.hero.url,'https://example.com/gyro.jpeg');assert.equal(result.photos.length,1);
 assert.equal(extractSiteImages('','https://example.com/',{logo:'https://example.com/'}).logo,null);
});
test('explicit same-origin menu takes priority within the unchanged two-page budget',()=>{const html='<a href="/contact">Contact</a><a href="/gallery">Gallery</a><a href="/speisen-getraenke/">Speisen & Getränke</a><a href="https://outside.example/menu">Menu</a>';assert.deepEqual(supplementaryPages(html,'https://restaurant.example/'),[{url:'https://restaurant.example/speisen-getraenke/',purpose:'menu'},{url:'https://restaurant.example/contact',purpose:'contact'}]);});

test('video sources cannot become heroes in any family and CSS entity quotes are decoded',()=>{const r=extractSiteImages('<video><source src="/hero.mp4" type="video/mp4"></video><img src="/community.jpg"><div style="background-image: url(&quot;/inside.jpg&quot;)"></div>',base);assert.equal(r.hero.url,base+'community.jpg');assert.deepEqual(r.photos.map(x=>x.url),[base+'community.jpg',base+'inside.jpg']);for(const path of ['/movie.mp4','/sound.mp3','/menu.pdf','/%22/bad.jpg%22'])assert.equal(sourceImage(path,base),null);});
test('menu scans and decorative quotes are separated from real venue photography',()=>{const r=extractSiteImages('<img src="/uploads/123.jpg" alt="Final menu.jpg"><img src="/quotation-mark.png"><div style="background-image:url(/yamas-pattern.png)"></div><img src="/dining.jpg">',base);assert.deepEqual(r.photos.map(x=>x.url),[base+'dining.jpg']);assert.deepEqual(r.menuImages.map(x=>x.url),[base+'uploads/123.jpg']);});


test('a photographed dish inside a menu items folder remains food photography, not a menu scan',()=>{const url='https://restaurant.org/menu/items/grilled-fish.jpg';const result=extractSiteImages(`<img src="${url}" alt="Grilled fish">`,'https://restaurant.org/');assert.equal(result.hero.url,url);assert.deepEqual(result.menuImages,[])});

test('Wix transform commas remain intact and highest explicit density wins',()=>{
 const low='https://static.wixstatic.com/media/abc.jpg/v1/fill/w_427,h_654,al_c,q_80,enc_avif,quality_auto/photo.jpg';
 const high=low.replace('w_427,h_654','w_854,h_1308');
 const result=extractSiteImages(`<img src="${low}" srcset="${low} 1x, ${high} 2x" alt="Our dance company">`,base);
 assert.equal(result.hero.url,high);assert.equal(result.photos.length,1);
});
test('publisher srcset accidentally placed in src is parsed rather than stored as a malformed URL',()=>{
 const result=extractSiteImages('<img src="/dance-small.jpg 1x, /dance-large.jpg 2x">',base);
 assert.equal(result.hero.url,base+'dance-large.jpg');
});
test('invalid responsive descriptors cannot manufacture URLs from transformation tokens',()=>{
 const result=extractSiteImages('<img src="/fallback.jpg" srcset="/small.jpg 20h, /large.jpg 2x 300w">',base);
 assert.equal(result.hero.url,base+'fallback.jpg');
});

test('captured Melanthi slider originals replace dummy images without manufacturing URLs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../fixtures/melanthi-declared-images.html',import.meta.url),'utf8');
 const result=extractSiteImages(html,'https://www.melanthi.gr/');
 const prefix='https://www.melanthi.gr/wp-content/uploads/2021/10/';
 assert.deepEqual(result.photos.map(x=>x.url),[
  prefix+'Melanthi-Complex-Nightview-01-796-2-Copy.jpg',
  prefix+'Melanthi-Iliana-Bedroom-03.jpg',
  prefix+'Melanthi-Breakfast-Buffet-Detais-541.jpg',
  prefix+'Melanthi-Liakoto-Nightime-03-978-2.jpg',
  prefix+'Melanthi-Complex-I-Nightime-Veranda-01-027-2.jpg'
 ]);
 assert.equal(result.hero.source,'page-image');
 assert.equal(result.photos.at(-1).source,'page-background');
});
test('plugin lazy declarations preserve responsive and existing lazy priorities',()=>{
 const result=extractSiteImages('<img data-lazyload="/actual.jpg" src="/placeholder.png"><img data-src="/preferred.jpg" data-lazyload="/other.jpg" src="/placeholder.png"><img srcset="/responsive.jpg 1200w" data-lazyload="/other.jpg"><source data-lazyload="/not-an-image.jpg">',base);
 assert.deepEqual(result.photos.map(x=>x.url),['actual.jpg','preferred.jpg','responsive.jpg'].map(x=>base+x));
});
test('plugin image declarations enforce URL and auxiliary guards and ignore fake attributes',()=>{
 const bad=['javascript:alert(1)','data:image/png,x','http://public.example/photo.jpg','https://127.0.0.1/photo.jpg','https://user:pass@public.example/photo.jpg','/favicon.png','/placeholder.jpg'];
 const html=bad.map(url=>`<img data-lazyload="${url}" src="/placeholder.png"><div data-vc-parallax-image="${url}"></div>`).join('')+
 '<img title="fake data-lazyload=\'/fake.jpg\'" src="/placeholder.png"><div title="fake data-vc-parallax-image=\'/fake-background.jpg\'"></div><div data-not-vc-parallax-image="/also-fake.jpg"></div><script><div data-vc-parallax-image="/script.jpg"></div></script><!-- <img data-lazyload="/comment.jpg"> -->';
 assert.deepEqual(extractSiteImages(html,base).photos,[]);
 const result=extractSiteImages('<div data-vc-parallax-image="/terrace.jpg"></div><div style="background-image:url(/terrace.jpg)"></div>',base);
 assert.deepEqual(result.photos.map(x=>x.url),[base+'terrace.jpg']);
});

test('plugin flags stay auxiliary and encoded logo filenames stay logos through actual rendered extractor',async()=>{
 const {auxiliaryImage}=await import('../../supabase/functions/zoi-enrich/_image-context.js');
 const {extractRenderedSource}=await import('../../scripts/enrichment/extractor.mjs');
 const flag='https://www.hellenic.ie/wp-content/plugins/wpglobus/flags/us.png';
 const logos=[
 'https://images.squarespace-cdn.com/content/v1/62a91cf2abf94c47f7cac21c/cb7269d4-62c1-4b96-a4ec-14e09b616d95/Logo+best+quality+no+words.jpg?format=1500w',
 'https://images.squarespace-cdn.com/content/v1/60528beab133344379972e4e/6faefd0d-81f7-493a-ad86-603add2db913/Poppis_weblogos-03.png?format=1500w'];
 assert.equal(auxiliaryImage(flag),true);
 assert.equal(auxiliaryImage('https://example.org/photos/wpglobus-building.jpg'),false);
 for(const logo of logos){
  const html=`<html><title>Local restaurant</title><img src="${flag}"><img src="${logo}"><img src="/Poppis-dining.jpg"><img src="/LogoVillage-terrace.jpg"></html>`;
  const images=extractSiteImages(html,base);assert.equal(images.logo.url,logo);assert.deepEqual(images.photos.map(x=>x.url),[base+'Poppis-dining.jpg',base+'LogoVillage-terrace.jpg']);
  const result=extractRenderedSource(html,base);assert.equal(result.profile.logo_url,logo);assert.deepEqual(result.profile.photo_urls,[base+'Poppis-dining.jpg',base+'LogoVillage-terrace.jpg']);
 }
});
