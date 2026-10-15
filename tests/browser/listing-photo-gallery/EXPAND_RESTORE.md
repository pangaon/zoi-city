Run the offline canonical renderer regression from the repository root:

```sh
ZOI_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome \
OUTPUT_DIR=/tmp/independent-gallery-evidence \
node tests/browser/listing-photo-gallery/expand-restore.mjs
```

It exercises the existing restaurant, bakery, hotel, creator, artist, church and
event renderers with 0, 1 and 3 source-bound images at 390 and 1440 pixels. Three
additional cases check the initially expanded caller contract, long captions,
short landscape, swiping, restored page position, bfcache and disposal. Images
are visibly labelled controlled fixtures. All requests are intercepted locally;
there are no database, provider or production calls. The original church image
failure must leave its labelled opener at least 88 pixels high and allow reopening.

The viewer expands within the browser viewport; it does not request browser or
operating-system fullscreen. It starts in each existing caller's chosen mode.
Expand/restore must preserve the selected photo, caption and source. Native
dialog keyboard focus and Escape remain in use.

The owner audit separately retains current public page screenshots and real
photographs with only the candidate's shared module and stylesheet overlaid.
Those are candidate evidence, not a deployment claim. Use a separate output
folder for independent review; retain the owner artifacts unchanged.
