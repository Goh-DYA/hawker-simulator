# Launch Content Catalogue

Status: Content `1.3.0` typed roster passes automated validation; exact-production browser and human cultural verification pending
Counting rule: unique ID plus meaningful functional, footprint, interaction, unlock, or constructed-visual difference. Palette-only recolours do not count.

## Roster counts

This document owns the launch content counts. Other documents link here, except the requirement and evidence documents that the [documentation index](../README.md#single-owners-for-volatile-facts) lists as still restating them as acceptance criteria. The validator reads the record counts from `LAUNCH_ROSTER` in `src/content/roster.ts`, so a roster change updates that file, the tests that pin it, this table, and every restating document the index lists.

| Record | Count | Validator rule |
|---|---:|---|
| Fictional stalls | 14 | Exact |
| Dishes | 54 | Exact |
| Placeables | 80 | At least 80, with a minimum per category (see [Eighty placeables](#eighty-placeables)) |
| Customer archetypes | 12 | Exact |
| Customer lifecycle states | 11 | Fixed by the simulation's customer status type |
| English localization entries | 320 | Pinned by the content tests |
| Released nutrition profiles | 104 | Derived: one per dish plus each additional variant preparation |
| Nutrition variant families | 14 | Exact; together they expose 64 selectable variants |
| Nutrition source snapshots | 2 | Exact |
| Nutrition intents | 5 | Exact |
| Nutrition guidelines | 11 | Exact |

## Nutrition coverage

Content `1.3.0` provides a released source profile for every one of the 54 dishes. Fourteen dish families add reviewed, rank-gated preparations for comparison: kopi, teh tarik, nasi lemak, fried carrot cake, roti prata, sliced fish soup, bak chor mee, chicken murtabak, chicken nasi briyani, masala thosai, yong tau foo, ban mian, bak kut teh, and duck rice. Together, the 54 base profiles and 50 additional preparation profiles produce 104 released nutrition profiles; the 14 families expose 64 selectable variants when their default preparations are included.

Every profile has a 1-to-5 Health rating calculated comparatively within its meal or drink class, plus condition-specific ratings for high cholesterol, obesity, diabetes, and hypertension. Every dish separately has a 1-to-5 Star rating derived from its authored quality and demand, representing taste and popularity rather than nutritional suitability. Nutrition values and recipe selection do not rewrite a dish family's price, Star rating, preparation time, serving time, or eating time. Customers with a visit-specific health condition use the applicable condition rating when choosing a stall and dish; the ordered meal applies a bounded satisfaction change from -0.2 to +0.2. Conditions are assigned independently of customer archetype and are simplified game traits, not diagnoses or medical advice. See [NUTRITION_DATA.md](NUTRITION_DATA.md) for source, validation, scoring, and disclosure boundaries.

## Fourteen fictional stalls and 54 dishes

All stall identities are original. Real dish names are descriptive cultural references, not brands. Dietary tags are preference aids only and never safety, allergen, vegetarian, or halal certification claims. The table mirrors the current typed content roster; runtime IDs are authoritative, and the automated content gate confirms the tests match them.

| # | Stall | Theme and operating identity | Menu | Unlock |
|---:|---|---|---|---|
| 1 | Sunrise Roost | Quick rice/chicken and breakfast service | Poached chicken rice; roast chicken rice; vegetarian chicken rice; chicken congee | Level 1 |
| 2 | Coconut & Lime | Malay-inspired rice, noodle, and soup counter | Nasi lemak; mee rebus; soto ayam; sayur lodeh with lontong | Level 1 |
| 3 | Kopi Canopy | Compact drinks and dessert counter | Kopi; fresh sugarcane juice; ice kacang | Level 2 |
| 4 | Cinder Wok | Popular, slower batch-cooked wok dishes | Char kway teow; Hokkien mee; fried carrot cake; oyster omelette | Level 3 |
| 5 | Mee Pok Junction | Teochew noodle and clear-soup counter | Bak chor mee; fishball mee pok; lor mee; fishball soup | Level 4 |
| 6 | Tiffin Lantern | Indian-Muslim-inspired griddle, noodle, and rice counter | Roti prata set; mee goreng mamak; chicken murtabak; chicken nasi briyani | Level 5 |
| 7 | Sweet Monsoon | Compact local dessert and drinks counter | Chendol; beancurd with toppings; teh tarik; pulut hitam | Level 5 |
| 8 | Satay Meridian | Malay-inspired charcoal grill for skewers, chicken, and seafood | Ten chicken satay with sauce; three barbecued chicken wings; ten beef satay with sauce; salted egg squid | Level 6 |
| 9 | Pick & Mix | Customisable noodle, soup, and vegetable-forward counter | Yong tau foo; ban mian; thunder tea rice; popiah | Level 6 |
| 10 | Tamarind Leaf | South Indian vegetable-forward griddle and tiffin counter | Masala thosai; idli sambar; vadai duo; lemon rice | Level 7 |
| 11 | Bamboo Basket | Cantonese dim sum and steamed small-plate counter | Four prawn dumplings; siew mai; char siew bao; lotus leaf rice | Level 8 |
| 12 | Straits Hearth | Peranakan-inspired premium braises and noodles | Laksa; ayam pongteh; Nonya chap chye; babi pongteh | Level 9 |
| 13 | Herbal Cauldron | Heritage broth, braise, and claypot counter | Bak kut teh; duck rice; kway chap; claypot chicken rice | Level 11 |
| 14 | Harbour Ember | Premium seafood grill and soup counter | Sambal stingray; sliced fish soup; black pepper crab | Level 12 |

Dish count is 54: twelve four-dish stalls plus two three-dish stalls.

### Dish production matrix

| Dish | Price C | Required readable depiction / vessel |
|---|---:|---|
| Poached chicken rice | 7 | pale sliced chicken, rice mound, plate |
| Roast chicken rice | 8 | amber chicken, rice mound, plate |
| Vegetarian chicken rice | 6 | mock chicken, seasoned rice, cucumber, plate |
| Chicken congee | 6 | pale porridge, garnish, bowl and spoon |
| Nasi lemak | 8 | coconut rice, sambal side, composed plate |
| Mee rebus | 7 | yellow noodles, thick gravy, bowl |
| Soto ayam | 7 | clear/yellow soup, chicken, bowl |
| Sayur lodeh with lontong | 7 | rice cake and vegetable gravy, bowl |
| Kopi | 3 | ceramic cup and saucer |
| Fresh sugarcane juice | 4 | pale green-gold drink, clear glass |
| Ice kacang | 6 | shaved-ice mound, colorful toppings, bowl/spoon |
| Char kway teow | 9 | broad dark noodles, plate |
| Hokkien mee | 10 | mixed noodles, prawns, plate and lime |
| Fried carrot cake | 7 | radish-cake cubes and egg, plate |
| Oyster omelette | 11 | egg, starch crispness, oysters, plate |
| Bak chor mee | 8 | tossed flat noodles, minced pork and mushroom garnish, bowl |
| Fishball mee pok | 7 | flat noodles, fishballs, fish cake, bowl |
| Lor mee | 9 | thick noodles, dark glossy gravy, egg, bowl |
| Fishball soup | 9 | fishballs and fish cake in clear broth, bowl |
| Roti prata set | 6 | layered flatbread and curry cup |
| Mee goreng mamak | 8 | red-brown noodles, plate |
| Chicken murtabak | 11 | cut filled flatbread and curry cup |
| Chicken nasi briyani | 12 | spiced rice, chicken, plate |
| Chendol | 6 | shaved ice, green pandan jelly, red beans, coconut milk, dark syrup, bowl |
| Beancurd with toppings | 4 | silken soy curds, syrup, contrasting toppings, bowl |
| Teh tarik | 4 | caramel-coloured milk tea with a foam cap, cup |
| Pulut hitam | 6 | dark purple rice porridge and coconut cream ribbon, bowl |
| Ten chicken satay with sauce | 10 | grilled chicken skewers, peanut sauce, cucumber, pressed rice, platter |
| Three barbecued chicken wings | 9 | bronze glazed wings, cucumber, chilli dip, platter |
| Ten beef satay with sauce | 12 | grilled beef skewers, peanut sauce, pressed rice, platter |
| Salted egg squid | 15 | scored squid pieces, golden salted-egg coating, leaf-lined plate |
| Yong tau foo | 8 | assorted stuffed tofu and vegetable pieces in clear soup, bowl |
| Ban mian | 8 | hand-torn noodles and contrasting toppings in soup, bowl |
| Thunder tea rice | 9 | rice, chopped vegetables, tofu, peanuts, and green herb broth, bowl |
| Popiah | 5 | sliced soft rolls with visible vegetable filling, plate |
| Masala thosai | 8 | rolled crisp crepe and metal cups |
| Idli sambar | 6 | idli rounds, sambar, metal plate |
| Vadai duo | 6 | two savoury fritters and chutney/sambar cup |
| Lemon rice | 7 | yellow rice, accompaniments, plate |
| Four prawn dumplings | 8 | translucent pleated prawn dumplings, bamboo basket/platter |
| Siew mai | 8 | open yellow dumplings with orange garnish, bamboo basket/platter |
| Char siew bao | 7 | white steamed buns with visible red-brown filling, bamboo basket/platter |
| Lotus leaf rice | 10 | opened leaf parcel with glutinous rice and fillings, leaf-lined plate |
| Laksa | 11 | orange coconut gravy, noodles, bowl/spoon |
| Ayam pongteh | 14 | dark soy-bean braise, chicken, potato, rice service |
| Nonya chap chye | 9 | braised mixed vegetables and rice |
| Babi pongteh | 13 | pork braise, potato, rice service |
| Bak kut teh | 12 | pork ribs in peppery clear broth, bowl |
| Duck rice | 10 | braised duck, rice, egg, tau kwa, plate |
| Kway chap | 10 | broad rice-noodle sheets, dark broth, braised pork, tofu, and egg, bowl |
| Claypot chicken rice | 12 | chicken, sausage, mushrooms, rice, and crisp crust, clay pot |
| Sambal stingray | 16 | grilled fish portion, sambal, lined plate |
| Sliced fish soup | 10 | clear soup and fish slices, bowl |
| Black pepper crab | 24 | crab silhouette, dark pepper sauce, platter |

Descriptions, ingredient cues, spellings, vessels, stall grouping, and cross-cultural attribution require Singapore cultural review before release. Indian-Muslim and Malay-inspired framing must not imply unreviewed halal certification; Tamarind Leaf's vegetarian framing and all ingredient/dietary tags require recipe review. Pork and seafood ingredients, dim sum terminology, babi pongteh, ayam pongteh, bak kut teh, kway chap, seafood species, and religious/dietary implications are high-sensitivity items.

## Twelve customer archetypes

Archetypes describe visit goals, not ethnicity. Skin tone and clothing colour are independently randomized per customer within clipping-safe rules.

| Archetype | Role | Typical preference / pressure |
|---|---|---|
| Early-Shift Regular | Morning baseline | familiar dishes, efficient route |
| Office Lunch Sprinter | Time-limited solo diner | short queue and fast service |
| Student Saver | Value seeker | affordable dishes and flexible seating |
| Family Table | Group seating load | adjacent seats and comfort |
| Curious Food Explorer | Variety seeker | novelty and menu breadth |
| Comfort-Seeking Regular | Comfort/readability check | short routes, bright surroundings, and comfortable seating |
| Evening Social Diner | Longer group visit | group table and ambience |
| Quality Treat Seeker | Premium demand | food quality over price |
| Afternoon Treat Stopper | Afternoon sweet-drink demand | dessert/drink matches, value, and fast-moving queues |
| Plant-Forward Planner | Vegetable-forward dish demand | tagged choices, quality, novelty, and value |
| Quiet Break Regular | Patient off-peak demand | familiar light dishes and tolerance for a modest queue |
| Night-Shift Recharger | Pre-shift closing-time demand | warm meals and direct routes during the 17:00–19:00 window |

Accessibility needs remain separate from archetype so disability is not treated as a consumer personality. Future accessible seating and path constraints must be available across all groups rather than inferred from a persona.

Health conditions also remain separate from archetype and appearance. A deterministic visit roll assigns at most one of high cholesterol, obesity, diabetes, or hypertension when released comparison data is available. The condition changes only that customer's food-choice weighting, explanation, and bounded meal satisfaction effect; it is not a diagnosis, prevalence claim, or demographic inference.

The active simulation consumes each persona's budget, patience, walking speed, stall-choice sensitivities, novelty, dish tags, progression gate, visit schedule, and tray-return chance (read per guest from a hash of the guest's ID, together with a reachable tray return within 14 path tiles). Authored seat preference, group range, satisfaction modifiers, and spend multiplier remain future balance hooks and are not advertised as current mechanics.

## Eighty placeables

The names below mirror the current typed content. Each definition carries its own price, footprint, interaction points, accessibility flags, ambience/cleanliness/service modifiers, unlock, and procedural sprite reference. Each category heading gives the category's current count, which is also its validator minimum (`PLACEABLE_CATEGORY_MINIMUMS`); the roster may grow past 80, but no category may fall below its minimum.

### Tables — 8

1. Compact Square Table — low-cost starter.
2. Round Café Table — four-direction social seating.
3. Long Communal Table — high seat density.
4. Family Trestle Table — group comfort.
5. Accessible End Table — clear accessible seat approach.
6. Standing Snack Ledge — short-stay counter service.
7. Folding Overflow Table — inexpensive flexible capacity.
8. Terrazzo Feature Table — premium ambience.

### Seats — 10

9. Stacking Stool.
10. Moulded Back Chair.
11. Two-Person Bench.
12. Easy-Rise Arm Chair.
13. High Counter Stool.
14. Booster Family Chair.
15. Cushioned Dining Chair.
16. Three-Person Communal Bench.
17. Acoustic Booth Seat.
18. Swivel Perch Seat.

These differ by footprint, capacity, compatible interaction height, comfort, accessibility, group utility, or ambience—not palette alone.

### Stall and service fixtures — 8

19. Queue Ticket Dispenser.
20. Condiment Counter.
21. Cutlery & Napkin Station.
22. Water Carafe Station.
23. Order Pickup Shelf.
24. Heated Display Case.
25. Chilled Display Case.
26. Mobile Prep Cart.

### Tray return and waste — 8

27. Single-Bay Tray Return.
28. Dual-Bay Tray Return.
29. Dish Drop Counter.
30. Recycling Sorter.
31. Covered Food-Waste Bin.
32. Covered General-Waste Bin.
33. Cleaning Trolley Bay.
34. Clean Tray Stack Rack.

### Lighting — 7

35. Efficient Ceiling Tube Light.
36. Pendant Dining Light.
37. Woven Lantern Cluster.
38. Counter Task Light.
39. Low Path Light.
40. Skylight Diffuser.
41. Festive String Lights.

Decorative light motion becomes static in reduced-motion mode.

### Fans and ventilation — 6

42. Wall Circulation Fan.
43. Wide Ceiling Fan.
44. Column Fan.
45. High-Volume Air Fan.
46. Quiet Corner Fan.
47. Stall Exhaust Booster.

### Plants — 8

48. Table Herb Planter.
49. Tall Areca Planter.
50. Fern Trough.
51. Vine Trellis.
52. Rain-Garden Pot.
53. Hanging Pothos Basket.
54. Dwarf Banana Planter.
55. Pandan Border Bed.

### Signage — 7

56. Entrance Directory.
57. Stall Row Marker.
58. Tray-Return Arrow Sign.
59. Accessible Route Sign.
60. Queue Courtesy Sign.
61. Menu Preview Board.
62. Centre Identity Sign.

Sign copy and symbols require legibility, translation/cultural, and accessible-wayfinding review.

### Dividers — 6

63. Low Timber Screen.
64. Tiled Half Wall.
65. Clear Wind Screen.
66. Integrated Planter Divider.
67. Retractable Queue Rail.
68. Acoustic Screen.

### Practical facilities — 7

69. Public Handwash Sink.
70. Drinking-Water Fountain.
71. Locked Cleaning Cupboard.
72. Staff Mop Sink.
73. First-Aid Cabinet.
74. Accessible Wash Basin.
75. Protected Utility Point.

### Decorations — 5

76. Geometric Tile Mural.
77. Community Noticeboard.
78. Fabric Ceiling Bunting.
79. Tabletop Flower Vase.
80. Feature Centre Clock.

## Neighbourhood calendar

The day cards in `src/content/calendar.ts` give each operating day of the seeded neighbourhood an identity (see [GAME_DESIGN.md](GAME_DESIGN.md#neighbourhood-calendar)). There are ten: a fixed opening day for day 1, which is never drawn again, and nine activity-based cards that later days draw from a shuffle bag. Cards describe activities and weather, never who people are.

Intensity runs from 0 (calm) to 1 (busy) and sets how the director weighs the card. Arrivals, lunch, dinner and eating time are multipliers, where 1 changes nothing and eating time above 1 means guests linger; persona factors multiply those personas' arrival weights, and category bonuses add appeal when guests choose a stall and a dish.

| Card | Intensity | Arrivals | Lunch | Dinner | Eating time | Personas | Dish categories |
|---|---:|---:|---:|---:|---:|---|---|
| Opening day (day 1 only) | 0.2 | 1 | 1 | 1 | 1 | — | — |
| Quiet weekday | 0.1 | 0.9 | 0.85 | 0.85 | 1 | Quiet Break Regular ×1.4 | — |
| Late-morning kopi crowd | 0.3 | 1 | 0.9 | 1 | 1 | Early-Shift Regular ×2, Quiet Break Regular ×1.5 | drink +1.2, bread +0.8 |
| Office move-in week | 0.8 | 1.05 | 1.35 | 0.9 | 0.9 | Office Lunch Sprinter ×2.2 | rice +0.8, noodles +0.6 |
| School sports day | 0.7 | 1.05 | 1.1 | 1 | 1.1 | Student Saver ×1.8, Family Table ×1.8 | dessert +1, drink +0.8 |
| Community football final | 0.85 | 1.05 | 0.9 | 1.6 | 1.25 | Evening Social Diner ×2.2 | drink +1.2, small-plate +0.8 |
| Heatwave afternoon | 0.5 | 0.95 | 0.9 | 1 | 1 | Afternoon Treat Stopper ×1.8 | drink +1.5, dessert +1.2, soup −0.6 |
| Monsoon shower | 0.6 | 0.9 | 1 | 1 | 1.35 | — | soup +1.2, noodles +0.8 |
| Heritage food walk | 0.65 | 1 | 1.05 | 1 | 1 | Curious Food Explorer ×2.2, Quality Treat Seeker ×1.6 | small-plate +0.8, seafood +0.8 |
| Public holiday: families out | 0.6 | 1.05 | 1.2 | 1 | 1.15 | Family Table ×2, Comfort-Seeking Regular ×1.4, Office Lunch Sprinter ×0.4 | rice +0.6 |

Each card's English copy (name, a one-line summary and the forecast shown the day before) lives with the card in `src/content/calendar.ts`, not in the launch localization table, so the 320 English localization entries in the [roster counts](#roster-counts) do not include it and the cards are not part of `LAUNCH_ROSTER`. The cards are parsed with `calendarCardSchema` at import (multipliers from 0.25 to 3, category bonuses from −2 to 2), and `tests/content/calendar.test.ts` checks that IDs are unique with exactly one opening day, that the bag has enough cards to avoid repeats, that every card names only launch personas and dish categories, that the bag has both calm and busy cards, that the opening day changes nothing, and that the copy labels neither food nor people.

## Validation requirements

Automated tests must prove the [roster counts](#roster-counts): exactly 14 stalls, 54 dishes, and 12 customer archetypes, at least 80 placeables with at least the listed number in each placeable category, and 320 English keys. They must also prove unique IDs and primary stall/food visual references, a playable dish when each stall unlocks, valid rotations/footprints, interaction points outside blocking collisions, known asset/audio references, reachable required interactions, a valid unlock graph, and no palette-only duplicate counted as content. Nutrition validation must additionally prove 104 released profiles, 14 variant families with 64 selectable variants, a released base profile and Star rating for every dish, complete Health and condition ratings, deterministic source generation, and valid provenance.
