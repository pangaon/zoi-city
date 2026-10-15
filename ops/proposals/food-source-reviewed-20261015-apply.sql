-- ROOT ONLY: independently reviewed retained-source facts. No fetch/provider/coordinate/owner writes.
-- Exact source payload below; do not edit a field without renewed independent review.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE food_source_proposal_20261015(proposal jsonb NOT NULL) ON COMMIT PRESERVE ROWS;
INSERT INTO food_source_proposal_20261015 SELECT value FROM jsonb_array_elements($food_payload$[
  {
    "listing_id": "373f6d89-03b6-4c58-b293-93a805885f5b",
    "expected_public_updated_at": "2026-10-14T06:25:07.072028+00:00",
    "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
    "source_sha256": "98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
    "retrieved_at": "2026-10-15T03:48:43.289Z",
    "identity": {
      "name": "Hellenic Bakery & Grocery",
      "city": "Livonia",
      "country": "United States",
      "address": "33308 Seven Mile Road, Livonia, MI 48152",
      "registered_website": "https://hellenicbakery.com"
    },
    "profile": {
      "menu": [
        {
          "section": "Spanakopita",
          "items": [
            {
              "name": "Spanakopita (Full Tray)",
              "price": "$38.00/+",
              "note": "24 Piece $38 | 48 Piece $42 | Flat $40"
            },
            {
              "name": "Spanakopita (Half Tray)",
              "price": "$20.00/+",
              "note": "12 Piece $20 | 24 Piece $22"
            }
          ]
        },
        {
          "section": "Tiropitakia",
          "items": [
            {
              "name": "Tiropitakia (Full Tray)",
              "price": "$38.00/+",
              "note": "24 Piece $38| 48 Piece $42"
            },
            {
              "name": "Tiropitakia (Half Tray)",
              "price": "$20.00/+",
              "note": "12 Piece $20 | 24 Piece $22"
            }
          ]
        },
        {
          "section": "Desserts",
          "items": [
            {
              "name": "Baklava",
              "price": "$24.00/+",
              "note": "48 Piece $46 | 60 Piece $48 | 30 Piece $24 | Lady Fingers $42 | Birds Nest $42 | Kantaifi $48"
            },
            {
              "name": "Galaktoboureko",
              "price": "$20.00/+",
              "note": "Milk Custard Roll • 12 Piece $20 | 24 Piece $40"
            }
          ]
        },
        {
          "section": "List",
          "items": [
            {
              "name": "Ajvar Red Homemade",
              "price": "$10.00",
              "note": ""
            },
            {
              "name": "Ajvar Red Pepper Spread Hot",
              "price": "$6.00",
              "note": ""
            },
            {
              "name": "Ajvar Red Pepper Spread Mild",
              "price": "$6.00",
              "note": ""
            },
            {
              "name": "Amita Banana Nectar 12",
              "price": "$5.25/1 lt",
              "note": ""
            },
            {
              "name": "Amita Motion Juice 12",
              "price": "$5.25/1 lt",
              "note": ""
            },
            {
              "name": "Amita Peach Juice 12",
              "price": "$5.25/1 lt",
              "note": ""
            },
            {
              "name": "Amita Sour Cherry Juice 12",
              "price": "$5.25/1 lt",
              "note": ""
            },
            {
              "name": "Amita Strawberry Juice 12",
              "price": "$5.25/1 lt",
              "note": ""
            },
            {
              "name": "Attiki Honey 6",
              "price": "$18.00/1 lb",
              "note": ""
            },
            {
              "name": "Bravo Coffee 12",
              "price": "$15.00/1 lb",
              "note": ""
            },
            {
              "name": "Capers Leaves (Pickled)",
              "price": "$5.50",
              "note": ""
            },
            {
              "name": "Cod Fish",
              "price": "$17.00/40 lb",
              "note": ""
            },
            {
              "name": "Elite Rusks (Fryganies) Wheat",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Elite Rusks (Fryganies) Wheat Rusk Bags",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Elite Rusks (Fryganies) Wholegrain",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Epsa Gazoza 24",
              "price": "$3.00/232 ml",
              "note": ""
            },
            {
              "name": "Epsa Orange 24",
              "price": "$2.50/232 ml",
              "note": ""
            },
            {
              "name": "Feta Cheese Barel",
              "price": "$12.00/per lb",
              "note": ""
            },
            {
              "name": "Giant Beans 3A 20",
              "price": "$7.00/500 gr",
              "note": ""
            },
            {
              "name": "Graviera",
              "price": "$14.00/per lb",
              "note": ""
            },
            {
              "name": "Graviera Wedges 12",
              "price": "$8.00/200 gr",
              "note": ""
            },
            {
              "name": "Greek Bread",
              "price": "$3.00",
              "note": ""
            },
            {
              "name": "Greek Green Cracked Olives",
              "price": "$7.00",
              "note": ""
            },
            {
              "name": "Haloumi",
              "price": "$13.00/per lb",
              "note": ""
            },
            {
              "name": "Haitoglou Sesame Snacks",
              "price": "$2.00",
              "note": "4 X 24 X 100 gr"
            },
            {
              "name": "Haitoglou Sesame Snacks",
              "price": "$1.50",
              "note": "4 X 30 X 50 gr"
            },
            {
              "name": "Hilopites Tripolis 20",
              "price": "$5.00/500 gr",
              "note": ""
            },
            {
              "name": "Horio Olive Oil",
              "price": "",
              "note": ""
            },
            {
              "name": "Ion Chocolate Almonds",
              "price": "$5.50",
              "note": "10 X 100 gr"
            },
            {
              "name": "Ion Chocolate Almonds",
              "price": "$5.50",
              "note": "10 X 200 gr"
            },
            {
              "name": "Ion Chocolate Dark",
              "price": "$6.00",
              "note": "10 X 100 gr"
            },
            {
              "name": "Ion Chocolate Milk",
              "price": "$5.50",
              "note": "10 X 100 gr"
            },
            {
              "name": "Jotis Bechamel 12",
              "price": "$4.00/162 gr",
              "note": ""
            },
            {
              "name": "Kalas Salt",
              "price": "$5.00",
              "note": ""
            },
            {
              "name": "Kalamata Olives Colossal",
              "price": "$8.00/per lb",
              "note": ""
            },
            {
              "name": "Kalamata Olives Mammoth",
              "price": "$8.00/per lb",
              "note": ""
            },
            {
              "name": "Kalamata Olives Green Cracked",
              "price": "$8.00/per lb",
              "note": ""
            },
            {
              "name": "Kaseri",
              "price": "$13.00/per lb",
              "note": ""
            },
            {
              "name": "Kefalograviera",
              "price": "$14.00/per lb",
              "note": ""
            },
            {
              "name": "Kefalograviera Wedges 12",
              "price": "$8.00/200 gr",
              "note": ""
            },
            {
              "name": "Kefalotyri",
              "price": "$14.00/per lb",
              "note": ""
            },
            {
              "name": "Kefalotyri Wedges 12",
              "price": "$8.00/200 gr",
              "note": ""
            },
            {
              "name": "Krinos Bulgarian 12",
              "price": "$15.00/900 gr",
              "note": "Plastic"
            },
            {
              "name": "Krinos Capers",
              "price": "$6.00/1 lb",
              "note": ""
            },
            {
              "name": "Krinos Capers",
              "price": "$5.00/8 oz",
              "note": ""
            },
            {
              "name": "Krinos Chamomile 12",
              "price": "$7.00/2 oz",
              "note": ""
            },
            {
              "name": "Krinos Extra Virgin Olive Oil Crete",
              "price": "$70.00/3 lt",
              "note": ""
            },
            {
              "name": "Krinos Extra Virgin Olive Oil Kalamata",
              "price": "$70.00/3 lt",
              "note": ""
            },
            {
              "name": "Krinos Greek Oreegano",
              "price": "$5.00/56 gr",
              "note": ""
            },
            {
              "name": "Krinos Haloumi",
              "price": "$13.00/1 lb",
              "note": ""
            },
            {
              "name": "Krinos Incense Livani",
              "price": "$4.00/2 oz",
              "note": ""
            },
            {
              "name": "Krinos Kalamata Olives",
              "price": "$6.00/1 lb",
              "note": ""
            },
            {
              "name": "Krinos Mountain Tea",
              "price": "$5.00/56 gr",
              "note": ""
            },
            {
              "name": "Krinos Ouzo Candy",
              "price": "$4.00",
              "note": ""
            },
            {
              "name": "Krinos Red Wine Vinegar",
              "price": "$12.00/1 gal",
              "note": ""
            },
            {
              "name": "Mana Rusks Barley",
              "price": "$8.00/400 gr",
              "note": ""
            },
            {
              "name": "Mana Rusks Olive Oil",
              "price": "$8.50/600 gr",
              "note": ""
            },
            {
              "name": "Mana Rusks Rye",
              "price": "$8.00/600 gr",
              "note": ""
            },
            {
              "name": "Mana Rusks Wheat",
              "price": "$8.00/600 gr",
              "note": ""
            },
            {
              "name": "Manouri",
              "price": "$12.00/per lb",
              "note": ""
            },
            {
              "name": "Melissa #2 Pastitchio",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Melissa #5 Spaghetti",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Melissa #6 Spaghetti",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Melissa Coarse Semolina",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Melissa Fine Semolina",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Melissa Orzo",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Misko #10 Spaghetti",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Misko #2 Pastitsio",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Misko #5 Macaroni",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Misko Couscous 20",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Misko Fides",
              "price": "$3.50/250 gr",
              "note": ""
            },
            {
              "name": "Misko K Ofto",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Misko Orzo",
              "price": "$3.50/500 gr",
              "note": ""
            },
            {
              "name": "Monastiri Cherry Preserve",
              "price": "$8.50",
              "note": ""
            },
            {
              "name": "Monastiri Chestnut Preserve",
              "price": "$8.50",
              "note": ""
            },
            {
              "name": "Monastiri Fig Preserve",
              "price": "$8.50",
              "note": ""
            },
            {
              "name": "Monastiri Honey",
              "price": "$36.00/2 lb",
              "note": ""
            },
            {
              "name": "Monastiri Pergamot Preserve",
              "price": "$8.50",
              "note": ""
            },
            {
              "name": "Monastiri Quince Preserve",
              "price": "$8.50",
              "note": ""
            },
            {
              "name": "Mountain Tea Fantis",
              "price": "$5.00/40 gr",
              "note": ""
            },
            {
              "name": "Moustokouloura 10",
              "price": "$7.00/450 gr",
              "note": ""
            },
            {
              "name": "Nea Fytini",
              "price": "$8.00",
              "note": ""
            },
            {
              "name": "Nescafe Frappe",
              "price": "$16.00/200 gr",
              "note": ""
            },
            {
              "name": "Octupus in Can",
              "price": "$5.75/10 oz",
              "note": ""
            },
            {
              "name": "Oregano Jar Fantis",
              "price": "$4.00/1.4 oz",
              "note": ""
            },
            {
              "name": "Papagalos Loumidis 12",
              "price": "$15.00/1 lb",
              "note": ""
            },
            {
              "name": "Papagalos Loumidis 15",
              "price": "$9.00/6.8 oz",
              "note": ""
            },
            {
              "name": "Petit Beurre Bisquites",
              "price": "$3.50",
              "note": ""
            },
            {
              "name": "Roasted Sweet Peppers",
              "price": "$6.00/1 lb",
              "note": ""
            },
            {
              "name": "Sardines in Cans",
              "price": "$3.50/3.8 oz",
              "note": ""
            },
            {
              "name": "Soap Bar",
              "price": "$3.50/125 gr",
              "note": ""
            },
            {
              "name": "Soap Bar Olive Oil",
              "price": "$3.50/125 gr",
              "note": ""
            },
            {
              "name": "Sokofreta 12 X 20",
              "price": "$1.75/38 gr",
              "note": ""
            },
            {
              "name": "Taramosalata",
              "price": "$7.50/14 oz",
              "note": ""
            }
          ]
        }
      ],
      "menu_source": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
      "menu_source_format": "html-semantic-food-fields",
      "menu_total_items": 151,
      "menu_truncated": true,
      "hero_url": "https://cdn.spotapps.co/spothopper/image/fetch/f_auto,q_auto:best,c_fit,h_1200/http://static.spotapps.co/spots/75/e78fa78ade4030915730185cb5a419/:original",
      "photo_urls": [
        "https://cdn.spotapps.co/spothopper/image/fetch/f_auto,q_auto:best,c_fit,h_1200/http://static.spotapps.co/spots/75/e78fa78ade4030915730185cb5a419/:original"
      ],
      "logo_url": "https://static.spotapps.co/website_images/ab_websites/268653_website_v1/logo.png",
      "source_identity": {
        "name": "Hellenic Bakery & Grocery",
        "source_url": "https://hellenicbakery.com/",
        "schema_type": "Restaurant",
        "verification": "exact_name_typed_jsonld",
        "expected_entity_type": "business",
        "ownership_verified": false
      },
      "client_brief": {
        "schema_version": 1,
        "status": "draft_requires_review",
        "listing": {
          "id": "373f6d89-03b6-4c58-b293-93a805885f5b",
          "slug": "hellenic-bakery-grocery-livonia",
          "name": "Hellenic Bakery & Grocery",
          "entity_type": "business"
        },
        "source": {
          "registered_url": "https://hellenicbakery.com/",
          "url": "https://hellenicbakery.com/",
          "retrieved_at": "2026-10-15T03:48:43.289Z",
          "identity_match": true,
          "scope": "exact_name_typed_source"
        },
        "offering": [
          {
            "kind": "menu_item",
            "name": "Spanakopita (Full Tray)",
            "detail": "24 Piece $38 | 48 Piece $42 | Flat $40",
            "price": "$38.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Spanakopita (Half Tray)",
            "detail": "12 Piece $20 | 24 Piece $22",
            "price": "$20.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Tiropitakia (Full Tray)",
            "detail": "24 Piece $38| 48 Piece $42",
            "price": "$38.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Tiropitakia (Half Tray)",
            "detail": "12 Piece $20 | 24 Piece $22",
            "price": "$20.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Baklava",
            "detail": "48 Piece $46 | 60 Piece $48 | 30 Piece $24 | Lady Fingers $42 | Birds Nest $42 | Kantaifi $48",
            "price": "$24.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Galaktoboureko",
            "detail": "Milk Custard Roll • 12 Piece $20 | 24 Piece $40",
            "price": "$20.00/+",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Ajvar Red Homemade",
            "detail": "",
            "price": "$10.00",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Ajvar Red Pepper Spread Hot",
            "detail": "",
            "price": "$6.00",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Ajvar Red Pepper Spread Mild",
            "detail": "",
            "price": "$6.00",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Amita Banana Nectar 12",
            "detail": "",
            "price": "$5.25/1 lt",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Amita Motion Juice 12",
            "detail": "",
            "price": "$5.25/1 lt",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Amita Peach Juice 12",
            "detail": "",
            "price": "$5.25/1 lt",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Amita Sour Cherry Juice 12",
            "detail": "",
            "price": "$5.25/1 lt",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Amita Strawberry Juice 12",
            "detail": "",
            "price": "$5.25/1 lt",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Attiki Honey 6",
            "detail": "",
            "price": "$18.00/1 lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Bravo Coffee 12",
            "detail": "",
            "price": "$15.00/1 lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Capers Leaves (Pickled)",
            "detail": "",
            "price": "$5.50",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Cod Fish",
            "detail": "",
            "price": "$17.00/40 lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Elite Rusks (Fryganies) Wheat",
            "detail": "",
            "price": "$3.50",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Elite Rusks (Fryganies) Wheat Rusk Bags",
            "detail": "",
            "price": "$3.50",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Elite Rusks (Fryganies) Wholegrain",
            "detail": "",
            "price": "$3.50",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Epsa Gazoza 24",
            "detail": "",
            "price": "$3.00/232 ml",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Epsa Orange 24",
            "detail": "",
            "price": "$2.50/232 ml",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Feta Cheese Barel",
            "detail": "",
            "price": "$12.00/per lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Giant Beans 3A 20",
            "detail": "",
            "price": "$7.00/500 gr",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Graviera",
            "detail": "",
            "price": "$14.00/per lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Graviera Wedges 12",
            "detail": "",
            "price": "$8.00/200 gr",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Greek Bread",
            "detail": "",
            "price": "$3.00",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Greek Green Cracked Olives",
            "detail": "",
            "price": "$7.00",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          },
          {
            "kind": "menu_item",
            "name": "Haloumi",
            "detail": "",
            "price": "$13.00/per lb",
            "evidence": {
              "field": "menu",
              "source_url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "method": "html-semantic-food-fields:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df",
              "verification": "source_extracted_requires_review"
            }
          }
        ],
        "audience": [],
        "differentiators": [],
        "description": null,
        "primary_actions": [
          {
            "kind": "website",
            "label": "Visit source website",
            "url": "https://hellenicbakery.com/",
            "state": "source_handoff",
            "evidence": {
              "field": "website",
              "source_url": "https://hellenicbakery.com/",
              "retrieved_at": "2026-10-15T03:48:43.289Z",
              "verification": "registered_source_identity_unverified"
            }
          }
        ],
        "visual_assets": [],
        "tools_needed": [
          {
            "tool": "menu_editor",
            "state": "requirement_only"
          }
        ],
        "unknowns": [
          "audience",
          "differentiators",
          "visual_identity_verification",
          "operational_connections",
          "rendered_home_acceptance",
          "customer_journey_acceptance",
          "current_hours",
          "additional_offerings_outside_bounded_summary"
        ],
        "composition": {
          "section_order": [
            "intro",
            "offerings",
            "gallery",
            "calendar",
            "media",
            "socials",
            "contact"
          ],
          "evidenced_sections": [
            "intro",
            "offerings"
          ],
          "copy_generated": false,
          "hidden_sections": []
        },
        "progress": {
          "source_research": "partial",
          "brief": "draft_requires_review",
          "classification": "not_accepted",
          "composition": "evidence_arrangement_only",
          "operational_connections": "unverified",
          "acceptance": "not_reviewed"
        },
        "identity_conflicts": [],
        "sources": [
          {
            "url": "https://hellenicbakery.com/",
            "state": "fetched",
            "purpose": "homepage"
          },
          {
            "url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu",
            "state": "fetched",
            "purpose": "menu"
          },
          {
            "url": "https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-catering",
            "state": "fetched",
            "purpose": "homepage"
          }
        ],
        "summary_coverage": {
          "offering_count": 100,
          "offering_retained": 30,
          "visual_retained": 0,
          "bounded": true
        }
      }
    },
    "scope": "Published food fields only. Prices are literal source text, stock and current ordering availability unknown. Retains100 of151 source items; full source menu remains linked.",
    "expected": {
      "listing_id": "373f6d89-03b6-4c58-b293-93a805885f5b",
      "name": "Hellenic Bakery & Grocery",
      "slug": "hellenic-bakery-grocery-livonia",
      "entity_type": "business",
      "city": "Livonia",
      "country": "United States",
      "address": "33308 Seven Mile Road, Livonia, MI 48152",
      "website": "https://hellenicbakery.com",
      "updated_at": "2026-10-14T06:25:07.072028+00:00",
      "row_fingerprint": "bac459ce1c1416ab37af78bfa8c8d6e4",
      "owner_user_id": null,
      "owner_workspace_id": null,
      "publish_status": "published",
      "moderation_status": "clean",
      "duplicate_status": "unique",
      "source_url": "https://hellenicbakery.com/",
      "machine_keys": [
        "geo",
        "email",
        "phone",
        "social",
        "tagline",
        "menu_url",
        "order_url",
        "photo_url",
        "site_lang",
        "checked_at",
        "provenance",
        "source_url",
        "description",
        "address_parts"
      ],
      "authored_profile_keys": [
        "commerce_notes",
        "commerce_platform"
      ],
      "machine_hold_present": false,
      "lease_present": false,
      "source_proposal_not_applied": true
    },
    "provenance": {
      "menu": "reviewed-source:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df;retrieved_at=2026-10-15T03:48:43.289Z",
      "menu_source": "reviewed-source:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df;retrieved_at=2026-10-15T03:48:43.289Z",
      "menu_source_format": "reviewed-source:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df;retrieved_at=2026-10-15T03:48:43.289Z",
      "menu_total_items": "reviewed-source:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df;retrieved_at=2026-10-15T03:48:43.289Z",
      "menu_truncated": "reviewed-source:https://hellenicbakery.com/livonia-hellenic-bakery-and-grocery-food-menu#sha256=98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df;retrieved_at=2026-10-15T03:48:43.289Z",
      "hero_url": "reviewed-source-asset:https://cdn.spotapps.co/spothopper/image/fetch/f_auto,q_auto:best,c_fit,h_1200/http://static.spotapps.co/spots/75/e78fa78ade4030915730185cb5a419/:original#sha256=3dbc0cb2f1c14ff2addf2afa2a1968ccbd0c7b1ea68b42b2903ab85266cc3d65;retrieved_at=2026-10-15T03:57:27.638Z;linked_from_sha256=bbfd8172b3dbc4d7005fad739436e3442efb501e874dd7740602f105510fcce8",
      "photo_urls": "reviewed-source-asset:https://cdn.spotapps.co/spothopper/image/fetch/f_auto,q_auto:best,c_fit,h_1200/http://static.spotapps.co/spots/75/e78fa78ade4030915730185cb5a419/:original#sha256=3dbc0cb2f1c14ff2addf2afa2a1968ccbd0c7b1ea68b42b2903ab85266cc3d65;retrieved_at=2026-10-15T03:57:27.638Z;linked_from_sha256=bbfd8172b3dbc4d7005fad739436e3442efb501e874dd7740602f105510fcce8",
      "logo_url": "reviewed-source-asset:https://static.spotapps.co/website_images/ab_websites/268653_website_v1/logo.png#sha256=b8081b3a72ca29ec822780c291a92b53c67a7a77f0ec6e5060465e47454b3404;retrieved_at=2026-10-15T03:57:27.483Z;linked_from_sha256=bbfd8172b3dbc4d7005fad739436e3442efb501e874dd7740602f105510fcce8",
      "source_identity": "exact_name_typed_jsonld",
      "client_brief": "deterministic-source-brief:review-required"
    }
  },
  {
    "listing_id": "ea2cc628-60ad-4fd5-b99b-984c763a6a49",
    "expected_public_updated_at": "2026-10-13T17:02:44.114572+00:00",
    "source_url": "https://www.corfugreekrestaurant.ie/our-menu",
    "source_capture_index": "source-capture-index.json",
    "profile": {
      "menu_url": "https://www.corfugreekrestaurant.ie/our-menu"
    },
    "scope": "Menu-page handoff only. Linked PDF robots unavailable; no PDF contents, dish or price inferred.",
    "expected": {
      "listing_id": "ea2cc628-60ad-4fd5-b99b-984c763a6a49",
      "name": "Corfu Greek Restaurant (Dublin)",
      "slug": "ie-dublin-corfu-greek-restaurant",
      "entity_type": "business",
      "city": "Dublin",
      "country": "Ireland",
      "address": "12 Parliament Street, Dublin, D02 HV05",
      "website": "https://www.corfugreekrestaurant.ie",
      "updated_at": "2026-10-13T17:02:44.114572+00:00",
      "row_fingerprint": "8ab5dc41636e130d2a10639bcc27072d",
      "owner_user_id": null,
      "owner_workspace_id": null,
      "publish_status": "published",
      "moderation_status": "clean",
      "duplicate_status": "primary_of_merge",
      "source_url": "https://www.corfugreekrestaurant.ie/",
      "machine_keys": [
        "phone",
        "social",
        "tagline",
        "photo_url",
        "site_lang",
        "checked_at",
        "provenance",
        "source_url",
        "booking_url",
        "address_parts"
      ],
      "authored_profile_keys": [
        "commerce_kind",
        "commerce_platform",
        "commerce_detection",
        "commerce_checked_at"
      ],
      "machine_hold_present": false,
      "lease_present": false,
      "source_proposal_not_applied": true
    },
    "provenance": {
      "menu_url": "reviewed-source:https://www.corfugreekrestaurant.ie/our-menu#sha256=486a2833020452c581ef513d97a8839413de6a49bdb645e7a7b85567d126cf18;retrieved_at=2026-10-15T03:46:09.049Z"
    },
    "source_sha256": "486a2833020452c581ef513d97a8839413de6a49bdb645e7a7b85567d126cf18",
    "retrieved_at": "2026-10-15T03:46:09.049Z"
  }
]$food_payload$::jsonb);
CREATE TEMP TABLE food_source_before_20261015(listing_id uuid PRIMARY KEY,listing jsonb NOT NULL,row_fingerprint text NOT NULL,after_fingerprint text) ON COMMIT PRESERVE ROWS;
CREATE TEMP TABLE food_source_result_20261015(listing_id uuid PRIMARY KEY,applied boolean NOT NULL,menu_items integer,menu_md5 text) ON COMMIT PRESERVE ROWS;
DO $guard$ DECLARE e jsonb;p pg_proc;l zoi.listings;proposal jsonb;expected jsonb;k text;q jsonb;BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements($metadata$[
  {
    "nspname": "public",
    "proname": "enrich_apply",
    "arguments": "p_batch jsonb",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "proconfig": [
      "search_path=zoi, public"
    ],
    "prosecdef": true,
    "provolatile": "v",
    "language_oid": "14",
    "definition_md5": "396c9e8ef6e7a19cb7e2c361a21bccbb",
    "signature": "public.enrich_apply(jsonb)"
  },
  {
    "nspname": "public",
    "proname": "enrich_sample_lease",
    "arguments": "p_ids uuid[]",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "proconfig": [
      "search_path=\"\""
    ],
    "prosecdef": true,
    "provolatile": "v",
    "language_oid": "13619",
    "definition_md5": "3288adcdf686fe6c7139b26af4cff14e",
    "signature": "public.enrich_sample_lease(uuid[])"
  },
  {
    "nspname": "zoi",
    "proname": "enrich_apply",
    "arguments": "p_batch jsonb",
    "owner": "postgres",
    "acl": "{postgres=X/postgres}",
    "proconfig": [
      "search_path=\"\""
    ],
    "prosecdef": true,
    "provolatile": "v",
    "language_oid": "13619",
    "definition_md5": "8e41b35a16426573b5867436e60f0abf",
    "signature": "zoi.enrich_apply(jsonb)"
  }
]$metadata$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM e->>'definition_md5'
   OR pg_get_userbyid(p.proowner) IS DISTINCT FROM e->>'owner' OR p.proacl::text IS DISTINCT FROM e->>'acl'
   OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'proconfig' OR p.prosecdef IS DISTINCT FROM true OR p.provolatile::text IS DISTINCT FROM e->>'provolatile'
   OR pg_get_function_identity_arguments(p.oid) IS DISTINCT FROM e->>'arguments'
   OR has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute')
   OR (e->>'nspname'='public' AND NOT has_function_privilege('service_role',p.oid,'execute')) THEN RAISE EXCEPTION 'food_writer_contract_drift';END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements($helpers$[
  {
    "signature": "zoi.profile_strip(jsonb)",
    "md5": "8b20fc1c36fca6647a69e155fbeb377f",
    "owner": "postgres",
    "acl": null
  },
  {
    "signature": "zoi.enrich_timestamp(text)",
    "md5": "281a90ff6e44c1a64b2d3c8977f1c38c",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}"
  },
  {
    "signature": "zoi.listing_quality_fingerprint(zoi.listings)",
    "md5": "cc69353ab17d09e06846eb90c1ee34cd",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}"
  },
  {
    "signature": "zoi.listing_quality_state(zoi.listings)",
    "md5": "ea1641facea45c788f8e6ca84feaf6d4",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}"
  }
]$helpers$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM e->>'md5' OR pg_get_userbyid(p.proowner) IS DISTINCT FROM e->>'owner' OR p.proacl::text IS DISTINCT FROM e->>'acl' THEN RAISE EXCEPTION 'food_writer_helper_contract_drift';END IF;
 END LOOP;
 IF (SELECT count(*) FROM food_source_proposal_20261015)<>2 THEN RAISE EXCEPTION 'food_proposal_count';END IF;
 -- Consistent listing-ID lock order before existing canonical sample lease/writer.
 FOR l IN SELECT t.* FROM zoi.listings t JOIN food_source_proposal_20261015 x ON t.id=(x.proposal->>'listing_id')::uuid ORDER BY t.id FOR UPDATE OF t LOOP
  SELECT x.proposal INTO STRICT proposal FROM food_source_proposal_20261015 x WHERE x.proposal->>'listing_id'=l.id::text;expected:=proposal->'expected';q:=l.profile->'_enrich';
  IF md5(to_jsonb(l)::text) IS DISTINCT FROM expected->>'row_fingerprint' OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL
   OR l.profile?'website' OR l.website IS DISTINCT FROM expected->>'website' OR l.name IS DISTINCT FROM expected->>'name' OR l.slug IS DISTINCT FROM expected->>'slug'
   OR l.city IS DISTINCT FROM expected->>'city' OR l.country IS DISTINCT FROM expected->>'country' OR l.address IS DISTINCT FROM expected->>'address'
   OR l.entity_type IS DISTINCT FROM expected->>'entity_type' OR l.publish_status IS DISTINCT FROM 'published' OR l.moderation_status NOT IN('clean','cleared') OR l.moderation_status IS NULL
   OR l.duplicate_status IS NULL OR l.duplicate_status='confirmed_duplicate' OR coalesce(l.marketplace_status,'')='hidden'
   OR jsonb_typeof(q) IS DISTINCT FROM 'object' OR q->>'source_url' IS DISTINCT FROM expected->>'source_url' OR q?'lease'
   OR q->>'blocked'='true' OR q->>'status'='blocked' OR q->>'crawl_status' IN('blocked','error') OR q->>'blocked_reason'='source_scope_mismatch'
   OR q->>'scope_review_required'='true' OR q->>'organization_identity_quarantine'='true' OR q->>'source_scope_mismatch'='true' OR q->>'source_challenge'='true' OR q->>'challenge'='true'
   OR nullif(btrim(q->>'identity_scope'),'') IS NOT NULL OR q?'source_affiliation' OR q?'member' OR q?'association_member'
   OR q->>'source_kind' IN('association_directory','association_member','supporting_publisher_profile')
   OR EXISTS(SELECT 1 FROM zoi.home_designs d WHERE d.listing_id=l.id) THEN RAISE EXCEPTION 'food_listing_or_source_guard_changed:%',l.id;END IF;
  FOR k IN SELECT jsonb_object_keys(proposal->'profile') LOOP IF l.profile?k THEN RAISE EXCEPTION 'food_authored_field_present:%',k;END IF;END LOOP;
  INSERT INTO food_source_before_20261015 VALUES(l.id,to_jsonb(l),md5(to_jsonb(l)::text),NULL);
 END LOOP;
 IF (SELECT count(*) FROM food_source_before_20261015)<>2 THEN RAISE EXCEPTION 'food_listing_count';END IF;
END $guard$;
CREATE TEMP TABLE food_source_leases_20261015 ON COMMIT PRESERVE ROWS AS
 SELECT * FROM public.enrich_sample_lease(ARRAY(SELECT listing_id FROM food_source_before_20261015 ORDER BY listing_id));
DO $apply$ DECLARE lease record;proposal jsonb;before_row jsonb;incoming jsonb;provenance jsonb;ack record;count_applied integer:=0;BEGIN
 IF (SELECT count(*) FROM food_source_leases_20261015)<>2 THEN RAISE EXCEPTION 'food_exact_leases_unconfirmed';END IF;
 FOR lease IN SELECT * FROM food_source_leases_20261015 ORDER BY listing_id LOOP
  SELECT x.proposal INTO STRICT proposal FROM food_source_proposal_20261015 x WHERE x.proposal->>'listing_id'=lease.listing_id::text;
  SELECT b.listing INTO STRICT before_row FROM food_source_before_20261015 b WHERE b.listing_id=lease.listing_id;
  IF lease.owner_managed IS DISTINCT FROM false OR lease.owner_workspace_id IS NOT NULL OR lease.website IS DISTINCT FROM before_row->>'website'
   OR lease.slug IS DISTINCT FROM before_row->>'slug' OR lease.name IS DISTINCT FROM before_row->>'name' OR lease.entity_type IS DISTINCT FROM before_row->>'entity_type'
   OR lease.existing_enrich->'_lease_source_context' IS DISTINCT FROM jsonb_build_object('city',before_row->'city','country',before_row->'country','address',before_row->'address') THEN RAISE EXCEPTION 'food_lease_context_unconfirmed';END IF;
  incoming:=(before_row#>'{profile,_enrich}')-ARRAY['lease','_lease_source_context'];
  incoming:=incoming||(proposal->'profile');
  provenance:=coalesce(before_row#>'{profile,_enrich,provenance}','{}'::jsonb)||(proposal->'provenance');
  FOR ack IN SELECT * FROM public.enrich_apply(jsonb_build_array(jsonb_build_object('slug',lease.slug,'website',lease.website,'lease_id',lease.lease_id,'profile',incoming,'provenance',provenance))) LOOP
   IF ack.slug IS DISTINCT FROM lease.slug OR ack.applied IS DISTINCT FROM true THEN RAISE EXCEPTION 'food_apply_unconfirmed';END IF;count_applied:=count_applied+1;
  END LOOP;
 END LOOP;
 IF count_applied<>2 THEN RAISE EXCEPTION 'food_apply_count';END IF;
END $apply$;
DO $verify$ DECLARE l zoi.listings;b record;proposal jsonb;k text;v jsonb;q jsonb;items integer;expected_items integer;BEGIN
 FOR b IN SELECT * FROM food_source_before_20261015 ORDER BY listing_id LOOP
  SELECT * INTO STRICT l FROM zoi.listings WHERE id=b.listing_id;
  SELECT x.proposal INTO STRICT proposal FROM food_source_proposal_20261015 x WHERE x.proposal->>'listing_id'=l.id::text;q:=l.profile->'_enrich';
  IF (to_jsonb(l)-ARRAY['profile','updated_at']) IS DISTINCT FROM(b.listing-ARRAY['profile','updated_at'])
   OR (l.profile-ARRAY['_enrich','_coverage']) IS DISTINCT FROM((b.listing->'profile')-ARRAY['_enrich','_coverage'])
   OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR EXISTS(SELECT 1 FROM zoi.home_designs d WHERE d.listing_id=l.id)
   OR q?'lease' OR q?'_lease_source_context' OR q->>'source_url' IS DISTINCT FROM l.website
   OR q->>'status' IS DISTINCT FROM 'ok' OR q->>'checked_at' IS DISTINCT FROM to_char(now(),'YYYY-MM-DD') THEN RAISE EXCEPTION 'food_protected_readback_changed';END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(proposal->'profile') LOOP IF q->k IS DISTINCT FROM v THEN RAISE EXCEPTION 'food_proposed_field_changed:%',k;END IF;END LOOP;
  FOR k,v IN SELECT key,value FROM jsonb_each(b.listing#>'{profile,_enrich}') LOOP
   IF NOT (proposal->'profile')?k AND k NOT IN('lease','_lease_source_context','provenance','source_url','checked_at','last_attempt_at','status') AND q->k IS DISTINCT FROM v THEN RAISE EXCEPTION 'food_retained_machine_fact_lost:%',k;END IF;
  END LOOP;
  IF q->'provenance' IS DISTINCT FROM(coalesce(b.listing#>'{profile,_enrich,provenance}','{}'::jsonb)||(proposal->'provenance')) THEN RAISE EXCEPTION 'food_provenance_changed';END IF;
  items:=0;IF proposal->'profile'?'menu' THEN
   IF jsonb_typeof(q->'menu') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'menu')<>4 OR q->'menu' IS DISTINCT FROM proposal#>'{profile,menu}' OR md5((q->'menu')::text) IS DISTINCT FROM md5((proposal#>'{profile,menu}')::text) THEN RAISE EXCEPTION 'food_menu_hash_changed';END IF;
   SELECT sum(jsonb_array_length(s->'items')) INTO items FROM jsonb_array_elements(q->'menu')s;
   IF items<>100 OR ARRAY(SELECT jsonb_array_length(s->'items') FROM jsonb_array_elements(q->'menu')s) IS DISTINCT FROM ARRAY[2,2,2,94] OR q->>'menu_total_items'<>'151' OR q->>'menu_truncated'<>'true' OR q#>>'{client_brief,status}' IS DISTINCT FROM 'draft_requires_review' THEN RAISE EXCEPTION 'food_menu_truncated_or_brief_promoted';END IF;
  END IF;
  INSERT INTO food_source_result_20261015 VALUES(l.id,true,items,CASE WHEN items>0 THEN md5((q->'menu')::text)END);
  UPDATE food_source_before_20261015 SET after_fingerprint=md5(to_jsonb(l)::text) WHERE listing_id=l.id;
 END LOOP;
 IF(SELECT count(*) FROM food_source_result_20261015)<>2 THEN RAISE EXCEPTION 'food_final_count';END IF;
END $verify$;
SELECT jsonb_build_object('verified',count(*)=2,'listings',jsonb_agg(jsonb_build_object('listing_id',listing_id,'applied',applied,'menu_items',menu_items,'menu_md5',menu_md5)ORDER BY listing_id),'coordinate_writes',0,'owner_writes',0)AS food_reviewed_result FROM food_source_result_20261015;
COMMIT;
-- Root must retain sanitized verified result and post-apply fingerprints privately.
SELECT jsonb_build_object('committed_after_verified_readback',true,'listings',count(*),'after_fingerprints',jsonb_object_agg(listing_id,after_fingerprint))AS food_commit_receipt FROM food_source_before_20261015;
