const ARTION={
  "url": "https://www.artionbakery.com/menu",
  "checked": "2026-09-30",
  "logo": "https://image-cdn.chowlyinc.com/300%2Cfit%2Cavif/https%3A%2F%2Fchowly-coo-configuration-assets.nyc3.digitaloceanspaces.com%2Fchowly-coo-prod-configuration-assets%2Fpublic%2Fassets%2FLogo-1617-8fe3c4a3-168d-411c-b5ce-116b62147aca.png",
  "photos": [
    "https://www.artionbakery.com/maglev/assets/52d5778e-262b-495a-9a2d-bc8b0351d1f8-boxes.avif",
    "https://www.artionbakery.com/maglev/assets/b4cb7388-b557-4773-9963-386d42cce433-kokb03a9193.avif",
    "https://www.artionbakery.com/maglev/assets/2de52453-680b-49b5-b9d7-fbd441e1f3a8-florentin-20basketb03a9186.avif",
    "https://www.artionbakery.com/maglev/assets/440628dc-5dcd-4c7e-8944-8baae4299c12-b03a9052.avif",
    "https://www.artionbakery.com/maglev/assets/f7149ebb-b811-4b55-99cc-b8783fe69d4c-cookies.avif",
    "https://www.artionbakery.com/maglev/assets/419e0afb-57f3-4e8b-8810-37b108ea80ef-store-202.avif",
    "https://www.artionbakery.com/maglev/assets/396da869-7ba1-40cc-a31c-1e3ae2a35a94-b03a9083.avif",
    "https://www.artionbakery.com/maglev/assets/71639af2-7d75-43e4-96cc-f210f3835eb0-cookiesb03a9145.avif",
    "https://www.artionbakery.com/maglev/assets/77ff9b26-58f6-4841-8f1f-666376ff3499-mini-20cheese-20pie-203.avif",
    "https://www.artionbakery.com/maglev/assets/e11b5e3e-e5ca-4e64-aaaa-b8c74a7b5682-kadaifib03a9120.avif",
    "https://www.artionbakery.com/maglev/assets/05733752-ed8a-4b70-bae8-82799dfe2ccb-passion-20fruit-20b03a9134.avif",
    "https://www.artionbakery.com/maglev/assets/dad647d5-db85-45a2-83ff-8d98f30856ec-cakes.avif"
  ]
};
export function reviewedBakerySource(e){if(e?.id!=="86b73cdc-d59a-433d-8efe-2271628929d5")return null;try{const u=new URL(e.website);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.replace(/^www\./,"")==="artionbakery.com"?ARTION:null;}catch{return null;}}
