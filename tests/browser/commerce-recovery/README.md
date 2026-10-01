# Commerce inventory recovery

Run `node tests/browser/commerce-recovery/verify.cjs`. This serves the actual web shop module and styles with controlled catalogue/checkout responses. It verifies 390/1440 widths: successful review, subsequent inventory failure, removal of the prior checkout, exact affected line, recovered availability clears the old notice, unavailable option opens that exact product/variant, removing the affected item preserves the other item and permits a new review.

`--native` uses the actual ShopScreen bundled with Expo in `mobile/.qa-commerce/dist`. The disposable fixture entry imports `../src/Shop`, mounts `<ShopScreen back={()=>{}}/>`, and uses the installed Expo57/React Native Web dependencies. Build with Expo export --platform web --clear. No production application files are substituted; public API responses are controlled. This is mounted native-component web evidence, not physical iOS/Android evidence.

No provider checkout is navigated, purchase made, customer data sent or message delivered. Screenshots are saved under `/tmp/commerce-recovery-{web,native}-{390,1440}.png`.
