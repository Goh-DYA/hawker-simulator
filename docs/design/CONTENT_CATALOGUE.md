# Launch Content Catalogue

Status: Content `1.8.0` typed roster; its working-source gate passes ([TEST_REPORT.md](../TEST_REPORT.md)); exact-production browser and human cultural verification pending
Counting rule: unique ID plus meaningful functional, footprint, interaction, unlock, or constructed-visual difference. Palette-only recolours do not count.

## Roster counts

This document owns the launch content counts. Other documents link here, except the requirement and evidence documents that the [documentation index](../README.md#single-owners-for-volatile-facts) lists as still restating them as acceptance criteria. The validator reads the record counts from `LAUNCH_ROSTER` in `src/content/roster.ts`, so a roster change updates that file, the tests that pin it, this table, and every restating document the index lists.

| Record | Count | Validator rule |
|---|---:|---|
| Fictional stalls | 18 | Exact |
| Dishes | 91 | Exact |
| Placeables | 98 | At least 98, with a minimum per category (see [Ninety-eight placeables](#ninety-eight-placeables)) |
| Customer archetypes | 12 | Exact |
| Customer lifecycle states | 11 | Fixed by the simulation's customer status type |
| English localization entries | 438 | Pinned by the content tests |
| Released nutrition profiles | 171 | Derived: one per dish plus each additional variant preparation |
| Nutrition variant families | 23 | Exact; together they expose 103 selectable variants, 80 of them beyond the defaults |
| Nutrition source snapshots | 2 | Exact |
| Nutrition intents | 5 | Exact |
| Nutrition guidelines | 11 | Exact |

## Nutrition coverage

Content `1.8.0` provides a released source profile for every one of the 91 dishes. Twenty-three dish families add reviewed, rank-gated preparations for comparison: kopi, teh tarik, nasi lemak, fried carrot cake, roti prata, fish bee hoon soup, bak chor mee, chicken murtabak, chicken nasi briyani, thosai, yong tau foo, ban mian, bak kut teh, duck rice, prawn noodle soup, economic rice, nasi padang, mee siam, wanton mee, soya bean milk, chicken chop, fish and chips, and fish porridge. Together, the 91 base profiles and 80 additional preparation profiles produce 171 released nutrition profiles; the 23 families expose 103 selectable variants when their default preparations are included. In every family the default rates below at least one option the player can unlock, and seven profiles (vegetarian chicken rice, the roti prata set, laksa and the four bak kut teh bowls) are documented composites of exact source rows; see [NUTRITION_DATA.md](NUTRITION_DATA.md#recipe-variants-and-defaults).

Every profile has a 1-to-5 Health rating that compares its serving with a meal's share (for a dessert, a snack's share) of general daily guidance (or, for a drink, Singapore's Nutri-Grade bands), plus condition-specific ratings for high cholesterol, obesity, diabetes, and hypertension. Every dish separately has a 1-to-5 Star rating derived from its authored quality and demand, representing taste and popularity rather than nutritional suitability. Nutrition values and recipe selection do not rewrite a dish family's price, Star rating, preparation time, serving time, or eating time. Customers with a visit-specific health condition use the applicable condition rating when choosing a stall and dish; the ordered meal applies a bounded satisfaction change from -0.2 to +0.2. Conditions are assigned independently of customer archetype and are simplified game traits, not diagnoses or medical advice. See [NUTRITION_DATA.md](NUTRITION_DATA.md) for source, validation, scoring, and disclosure boundaries.

## Eighteen fictional stalls and 91 dishes

All stall identities are original. Real dish names are descriptive cultural references, not brands. Dietary tags are preference aids only and never safety, allergen, vegetarian, or halal certification claims. The table mirrors the current typed content roster; runtime IDs are authoritative, and the automated content gate confirms the tests match them.

| # | Stall | Theme and operating identity | Menu | Unlock |
|---:|---|---|---|---|
| 1 | Sunrise Roost | Quick rice/chicken and breakfast service | Poached chicken rice; roast chicken rice; vegetarian chicken rice; chicken congee; char siew rice | Level 1 |
| 2 | Coconut & Lime | Malay-inspired rice, noodle, and soup counter | Nasi lemak; mee rebus; soto ayam; sayur lodeh with lontong; nasi padang beef set | Level 1 |
| 3 | Kopi Canopy | Compact kopitiam drinks and toast counter | Kopi; fresh sugarcane juice; kaya butter toast; teh tarik; barley water | Level 2 |
| 4 | Cinder Wok | Popular, slower batch-cooked wok dishes | Char kway teow; Hokkien mee; fried carrot cake; oyster omelette; beef hor fun | Level 3 |
| 5 | Mee Pok Junction | Teochew noodle and clear-soup counter | Bak chor mee; fishball mee pok; lor mee; fishball tang hoon soup; chwee kueh | Level 4 |
| 6 | Tiffin Lantern | Indian-Muslim-inspired griddle, noodle, and rice counter | Roti prata set; mee goreng mamak; chicken murtabak; chicken nasi briyani; roti john | Level 6 |
| 7 | Sweet Monsoon | Compact local dessert and drinks counter | Chendol; tau huay with toppings; pulut hitam; ice kacang; soya bean milk | Level 8 |
| 8 | Satay Meridian | Malay-inspired charcoal grill for skewers, chicken, and seafood | Chicken satay (10 sticks); barbecued chicken wings; beef satay (10 sticks); sotong panggang; mutton satay (10 sticks) | Level 10 |
| 9 | Pick & Mix | Customisable noodle, soup, and vegetable-forward counter | Yong tau foo; ban mian; thunder tea rice; popiah; economic rice | Level 12 |
| 10 | Jade Ladle | Cantonese porridge counter with steamed rice rolls and fried dough sticks | Century egg pork porridge; fish porridge; minced pork porridge; chee cheong fun; you tiao | Level 14 |
| 11 | Tamarind Leaf | South Indian vegetable-forward griddle and tiffin counter | Thosai; idli sambar; vadai duo; lemon rice; appam | Level 16 |
| 12 | Bamboo Basket | Cantonese dim sum, steamed small-plate and noodle counter | Prawn dumpling soup; siew mai; char siew bao; lotus leaf rice; wanton mee | Level 18 |
| 13 | Longan Moon | Compact Teochew-Cantonese tong sui counter ladling sweet soups and pastes | Cheng tng; orh nee; tau suan; green bean soup; black sesame paste | Level 20 |
| 14 | Lesung Corner | Malay-Indonesian warung for smashed and grilled chicken, fried rice, soto, and salads | Ayam penyet; nasi goreng; mee soto; gado-gado; ayam panggang | Level 22 |
| 15 | Straits Hearth | Peranakan-inspired premium braises and noodles | Laksa; ayam pongteh; Nonya chap chye; babi pongteh; mee siam; kueh pie tee | Level 24 |
| 16 | Herbal Cauldron | Heritage broth, braise, and claypot counter | Bak kut teh; duck rice; kway chap; claypot chicken rice; watercress pork rib soup | Level 26 |
| 17 | Peppercorn Plate | Hainanese-style hawker Western grill serving on hot plates | Chicken chop; mushroom aglio olio; fish and chips; spaghetti bolognese; black pepper steak | Level 28 |
| 18 | Harbour Ember | Premium seafood grill and soup counter | Sambal stingray; black pepper crab; fish bee hoon soup; prawn noodle soup; chilli crab | Level 30 |

The stalls are authored in this order, which a content rule ties to their unlock order; the reputation gates, prerequisites, tender days and dish gates are in [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md#stall-unlocks).

Dish count is 91: seventeen five-dish stalls and one six-dish stall. Content `1.4.0` added thirteen dishes, moved teh tarik to Kopi Canopy and ice kacang to Sweet Monsoon, and matched several dishes' names and servings to their nutrition source rows; content `1.5.0` priced every dish at its 2025-26 street price and renamed four dishes; content `1.6.0` added four five-dish stalls and a fifth dish at Satay Meridian, Tamarind Leaf, Herbal Cauldron and Harbour Ember, and renamed Sliced Fish Soup to Fish Bee Hoon Soup; see the [changelog](../CHANGELOG.md).

### Dish production matrix

| Dish | Price (SGD) | Required readable depiction / vessel |
|---|---:|---|
| Poached chicken rice | 4 | pale sliced chicken, rice mound, plate |
| Roast chicken rice | 4 | amber chicken, rice mound, plate |
| Vegetarian chicken rice | 4 | mock chicken, seasoned rice, cucumber, plate |
| Chicken congee | 4 | pale porridge, garnish, bowl and spoon |
| Nasi lemak | 5 | coconut rice, sambal side, composed plate |
| Mee rebus | 4 | yellow noodles, thick gravy, bowl |
| Soto ayam | 5 | clear/yellow soup, chicken, bowl |
| Sayur lodeh with lontong | 4 | rice cake and vegetable gravy, bowl |
| Kopi | 2 | ceramic cup and saucer |
| Fresh sugarcane juice | 3 | pale green-gold drink, clear glass |
| Ice kacang | 3 | shaved-ice mound, colorful toppings, bowl/spoon |
| Char kway teow | 5 | broad dark noodles, plate |
| Hokkien mee | 6 | mixed noodles, prawns, plate and lime |
| Fried carrot cake | 4 | radish-cake cubes and egg glazed in dark sweet sauce, plate |
| Oyster omelette | 6 | egg, starch crispness, oysters, plate |
| Bak chor mee | 5 | tossed flat noodles, minced pork and mushroom garnish, bowl |
| Fishball mee pok | 4 | flat noodles, fishballs, fish cake, bowl |
| Lor mee | 5 | thick noodles, dark glossy gravy, egg, bowl |
| Fishball tang hoon soup | 4 | fishballs, fish cake and glass noodles in clear broth, bowl |
| Roti prata set | 3 | layered flatbread and curry cup |
| Mee goreng mamak | 5 | red-brown noodles, plate |
| Chicken murtabak | 7 | cut filled flatbread and curry cup |
| Chicken nasi briyani | 7 | spiced rice, chicken, plate |
| Chendol | 3 | shaved ice, green pandan jelly, red beans, coconut milk, dark syrup, bowl |
| Tau huay with toppings | 3 | silken soy curds, syrup, contrasting toppings, bowl |
| Teh tarik | 2 | caramel-coloured milk tea with a foam cap, cup |
| Pulut hitam | 3 | dark purple rice porridge and coconut cream ribbon, bowl |
| Chicken satay (10 sticks) | 7 | grilled chicken skewers, peanut sauce, cucumber, pressed rice, platter |
| Barbecued chicken wings | 5 | three bronze glazed wing pieces, cucumber, chilli dip, platter |
| Beef satay (10 sticks) | 8 | grilled beef skewers, peanut sauce, pressed rice, platter |
| Sotong panggang | 10 | charcoal-grilled spiced squid with char marks, leaf-lined plate |
| Yong tau foo | 6 | assorted stuffed tofu and vegetable pieces with thick bee hoon in clear soup, bowl |
| Ban mian | 5 | hand-torn noodles and contrasting toppings in soup, bowl |
| Thunder tea rice | 6 | rice, chopped vegetables, tofu, peanuts, and green herb broth, bowl |
| Popiah | 3 | sliced soft rolls with visible vegetable filling, plate |
| Thosai | 3 | rolled plain crepe with chutney and sambar cups, steel plate with banana leaf |
| Idli sambar | 3 | idli rounds, sambar, metal plate |
| Vadai duo | 2 | two savoury fritters and chutney/sambar cup |
| Lemon rice | 3 | yellow rice, accompaniments, plate |
| Prawn dumpling soup | 4 | four prawn dumplings with leafy greens in light soup, ceramic bowl |
| Siew mai | 4 | four open yellow dumplings with orange crab-roe garnish, bamboo basket/platter |
| Char siew bao | 3 | white steamed buns with visible red-brown filling, bamboo basket/platter |
| Lotus leaf rice | 4 | opened leaf parcel with glutinous rice and fillings, leaf-lined plate |
| Laksa | 6 | orange coconut gravy, noodles, bowl/spoon |
| Ayam pongteh | 4 | dark soy-bean braise, chicken, potato, side plate |
| Nonya chap chye | 3 | braised cabbage, carrot, baby corn and black fungus, side plate |
| Babi pongteh | 5 | pork braise, potato, side plate |
| Bak kut teh | 9 | pork ribs in peppery clear broth, bowl, with a side bowl of rice and a you tiao stick across the rim |
| Duck rice | 6 | braised duck, rice, egg, tau kwa, plate |
| Kway chap | 6 | broad rice-noodle sheets, dark broth, braised pork, tofu, and egg, bowl |
| Claypot chicken rice | 8 | chicken, sausage, mushrooms, rice, and crisp crust, clay pot |
| Sambal stingray | 12 | grilled fish portion, sambal, lined plate |
| Fish bee hoon soup | 6 | golden fried fish pieces heaped over thick bee hoon in clear broth, bowl |
| Black pepper crab | 20 | quarter crab with claw, dark pepper sauce, platter |
| Char siew rice | 4 | glazed red-edged pork slices, rice mound, cucumber, plate |
| Nasi padang beef set | 6 | spiced beef in gravy beside rice, leaf-lined plate |
| Kaya butter toast | 2 | toast with green-brown kaya and butter slices, plate |
| Barley water | 2 | cloudy pale barley drink with ice, clear glass |
| Beef hor fun | 6 | broad rice noodles, beef slices and egg gravy, plate |
| Chwee kueh | 3 | five white rice cakes with preserved-radish topping, plate |
| Roti john | 6 | long omelette-fried roll cut into strips, plate |
| Soya bean milk | 2 | creamy off-white soy milk, clear glass |
| Economic rice | 3 | rice with one vegetable and one meat dish, plate |
| Wanton mee | 4 | springy noodles, wantons, char siew slices and greens, plate |
| Mee siam | 4 | thin vermicelli in red tamarind gravy, egg halves and lime, plate |
| Kueh pie tee | 5 | five crisp top-hat cups with turnip filling, platter |
| Prawn noodle soup | 6 | yellow noodles, whole prawns and pork in red-orange broth, bowl |
| Mutton satay (10 sticks) | 8 | dark grilled mutton skewers on bamboo sticks, peanut sauce, platter |
| Century egg pork porridge | 4 | pale congee with century egg wedges, minced pork and spring onion, bowl |
| Fish porridge | 6 | congee topped with fried fish pieces, spring onion and fried shallots, bowl |
| Minced pork porridge | 5 | congee with minced pork and rounds of fried dough, bowl |
| Chee cheong fun | 3 | soft rice rolls with a sweet-sauce drizzle and sesame-oil sheen, plate |
| You tiao | 2 | a pair of joined golden dough sticks, plate |
| Appam | 2 | two bowl-shaped rice-and-coconut pancakes with lacy rims and soft centres, steel leaf plate |
| Cheng tng | 2 | clear syrup with longan, white fungus and lotus seeds, bowl |
| Orh nee | 3 | lilac yam paste with gingko nuts and pumpkin under an oil sheen, bowl |
| Tau suan | 2 | glossy yellow split mung bean soup with fried dough strips, bowl |
| Green bean soup | 2 | green beans in sweet soup, bowl |
| Black sesame paste | 3 | glossy inky-black sesame paste with a swirl, bowl |
| Ayam penyet | 7 | smashed fried chicken, rice, tofu, vegetables and a sambal dollop, leaf-lined plate |
| Nasi goreng | 6 | fried rice with egg and mixed vegetables, cucumber and chilli, plate |
| Mee soto | 5 | yellow noodles and shredded chicken in spiced broth, lime and fried shallots, bowl |
| Gado-gado | 6 | fried tofu, egg halves, rice cakes, green beans and beansprouts under peanut sauce, plate |
| Ayam panggang | 8 | glazed grilled chicken leg with char stripes over rice, plate |
| Watercress pork rib soup | 5 | pork ribs, watercress, red dates and wolfberries in clear soup, bowl |
| Chicken chop | 8 | grilled chicken chop with fries and coleslaw, cast-iron hot plate on a timber underliner |
| Mushroom aglio olio | 5 | spaghetti with mushrooms, garlic, chilli flakes and parsley, plate |
| Fish and chips | 9 | battered fish fillet, fries, tartar sauce and lemon wedge, plate |
| Spaghetti bolognese | 6 | spaghetti under minced beef sauce with herb flecks, plate |
| Black pepper steak | 13 | grilled steak with potato and vegetables and a cup of black pepper sauce, cast-iron hot plate on a timber underliner |
| Chilli crab | 20 | quarter crab with claw in red chilli gravy laced with egg ribbons, platter |

Descriptions, ingredient cues, spellings, vessels, stall grouping, and cross-cultural attribution require Singapore cultural review before release. Indian-Muslim and Malay-inspired framing must not imply unreviewed halal certification; Tamarind Leaf's vegetarian framing and all ingredient/dietary tags require recipe review. Pork and seafood ingredients, dim sum terminology, babi pongteh, ayam pongteh, bak kut teh, kway chap, seafood species, and religious/dietary implications are high-sensitivity items; content `1.6.0` adds the Malay-Indonesian framing of Lesung Corner, the Hainanese-style hawker Western framing of Peppercorn Plate, the Teochew-Cantonese tong sui attribution of Longan Moon, and the pork porridges and watercress pork rib soup.

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

The active simulation consumes each persona's budget, patience, walking speed, stall-choice sensitivities, novelty, dish tags, progression gate, visit schedule, and tray-return chance (read per guest from a hash of the guest's ID, together with a reachable tray return within 14 path tiles). Authored seat preference, group range, and satisfaction modifiers remain future balance hooks and are not advertised as current mechanics.

## Ninety-eight placeables

The names below mirror the current typed content. Each definition carries its own price, footprint, interaction points, accessibility flags, ambience/cleanliness/service modifiers, unlock, and procedural sprite reference. Each category heading gives the category's current count, which is also its validator minimum (`PLACEABLE_CATEGORY_MINIMUMS`); the roster may grow past 98, but no category may fall below its minimum.

### Tables — 10

1. Compact Square Table — low-cost starter.
2. Round Café Table — four-direction social seating.
3. Long Communal Table — high seat density.
4. Family Trestle Table — group comfort.
5. Accessible End Table — clear accessible seat approach.
6. Standing Snack Ledge — short-stay counter service.
7. Folding Overflow Table — budget overflow table whose diners eat and go a little sooner.
8. Terrazzo Feature Table — premium ambience.
9. Granite Chess Table — heavy one-tile stone table with an inlaid chessboard; the polished stone wipes clean, so the crew clears the seats around it faster (cleaning efficiency).
10. Banquet Turntable Table — three-by-three clothed table with a glass turntable; the twelve seats around it finish their meals sooner (eating speed 0.25).

### Seats — 13

11. Stacking Stool.
12. Moulded Back Chair.
13. Two-Person Bench.
14. Easy-Rise Arm Chair.
15. High Counter Stool.
16. Booster Family Chair.
17. Cushioned Dining Chair.
18. Three-Person Communal Bench.
19. Acoustic Booth Seat.
20. Swivel Perch Seat.
21. Companion Transfer Bench — two places, one at transfer height beside a grab rail; priced per seat like the communal benches.
22. Four-Person Teak Bench — four places along the longest tables, the cheapest bench per seat.
23. Rattan Lounge Chair — the single chair that adds the most ambience to the seats around it.

These differ by footprint, capacity, price per seat, eating speed or ambience—not palette alone. A seat's authored comfort and accessibility flags describe the piece; the simulation reads its seat points and its ambience, cleanliness and service effects.

### Stall and service fixtures — 9

24. Queue Ticket Dispenser.
25. Condiment Counter.
26. Cutlery & Napkin Station.
27. Water Carafe Station.
28. Order Pickup Shelf.
29. Heated Display Case.
30. Chilled Display Case.
31. Mobile Prep Cart.
32. Self-Order Kiosk — touchscreen ordering and paying ahead for the queue beside it; the strongest queue-patience boost of any piece.

### Tray return and waste — 9

33. Single-Bay Tray Return.
34. Dual-Bay Tray Return — two return openings, two table-cleaning crew members.
35. Dish Drop Counter — a staffed counter, two table-cleaning crew members and a cleaning-efficiency boost.
36. Recycling Sorter.
37. Covered Food-Waste Bin.
38. Covered General-Waste Bin.
39. Cleaning Trolley Bay.
40. Clean Tray Stack Rack.
41. Tray-Return Conveyor — four-tile belt that clears itself, three table-cleaning crew members and a large cleaning-efficiency boost.

### Lighting — 8

42. Efficient Ceiling Tube Light.
43. Pendant Dining Light.
44. Woven Lantern Cluster.
45. Counter Task Light.
46. Low Path Light.
47. Skylight Diffuser.
48. Festive String Lights.
49. Heritage Lamp Post — floor-standing cast-iron lantern for open courts; the crew clears trays faster in its light (cleaning efficiency).

Decorative light motion becomes static in reduced-motion mode.

### Fans and ventilation — 8

50. Wall Circulation Fan.
51. Wide Ceiling Fan.
52. Column Fan.
53. High-Volume Air Fan.
54. Quiet Corner Fan.
55. Stall Exhaust Booster.
56. Misting Fan — pedestal fan with a mist ring; a large queue-patience boost but a damp floor.
57. Giant Ceiling Fan — four-by-four slow fan cooling a whole dining court: queue patience and eating speed.

### Plants — 10

58. Table Herb Planter.
59. Tall Areca Planter.
60. Fern Trough.
61. Vine Trellis.
62. Rain-Garden Pot.
63. Hanging Pothos Basket.
64. Dwarf Banana Planter.
65. Pandan Border Bed.
66. Frangipani Tree Planter — two-by-two flowering tree whose shade keeps a queue beside it patient.
67. Bougainvillea Arch — walk-under flowering arch that shades a queue or walkway, at a small cleanliness cost.

### Signage — 8

68. Entrance Directory.
69. Stall Row Marker.
70. Tray-Return Arrow Sign.
71. Accessible Route Sign.
72. Queue Courtesy Sign.
73. Menu Preview Board.
74. Centre Identity Sign.
75. Order-Ready Number Board — hanging lit board of ready order numbers that keeps every queue in sight of it patient.

Sign copy and symbols require legibility, translation/cultural, and accessible-wayfinding review.

### Dividers — 7

76. Low Timber Screen.
77. Tiled Half Wall.
78. Clear Wind Screen.
79. Integrated Planter Divider.
80. Retractable Queue Rail.
81. Acoustic Screen.
82. Breeze-Block Screen — wall of ventilation blocks that screens a zone and cools a queue beside it.

### Practical facilities — 8

83. Public Handwash Sink.
84. Drinking-Water Fountain.
85. Locked Cleaning Cupboard.
86. Staff Mop Sink.
87. First-Aid Cabinet.
88. Accessible Wash Basin.
89. Protected Utility Point.
90. Family Care Room — two-by-two private room with a changing table, nursing chair and basin; keeps the hall near it cleaner and nearby queues patient.

### Decorations — 8

91. Geometric Tile Mural.
92. Community Noticeboard.
93. Fabric Ceiling Bunting.
94. Tabletop Flower Vase.
95. Feature Centre Clock.
96. Heritage Photo Wall — hung row of framed photographs of the fictional neighbourhood's early stalls, which queueing guests look at while they wait.
97. Paper Umbrella Canopy — cluster of oil-paper umbrellas that shades a three-by-three dining court, so diners beneath finish sooner.
98. Courtyard Water Feature — tiled basin and spill fountain whose trickle calms a queue beside it; the one decor piece that blocks movement.

## Neighbourhood calendar

The day cards in `src/content/calendar.ts` give each operating day of the seeded neighbourhood an identity (see [GAME_DESIGN.md](GAME_DESIGN.md#neighbourhood-calendar)). There are ten: a fixed opening day for day 1, which is never drawn again, and nine activity-based cards that later days draw from a shuffle bag. Cards describe activities and weather, never who people are.

Intensity runs from 0 (calm) to 1 (busy) and sets how the director weighs the card. Arrivals, lunch, dinner and eating time are multipliers, where 1 changes nothing and eating time above 1 means guests linger; persona factors multiply those personas' arrival weights, and category bonuses add appeal when guests choose a stall and a dish.

| Card | Intensity | Arrivals | Lunch | Dinner | Eating time | Personas | Dish categories |
|---|---:|---:|---:|---:|---:|---|---|
| Opening day (day 1 only) | 0.2 | 0.85 | 0.8 | 0.85 | 1 | — | — |
| Quiet weekday | 0.1 | 0.9 | 0.85 | 0.85 | 1 | Quiet Break Regular ×1.4 | — |
| Late-morning kopi crowd | 0.3 | 1 | 0.9 | 1 | 1 | Early-Shift Regular ×2, Quiet Break Regular ×1.5 | drink +1.2, bread +0.8 |
| Office move-in week | 0.8 | 1.05 | 1.35 | 0.9 | 0.9 | Office Lunch Sprinter ×2.2 | rice +0.8, noodles +0.6 |
| School sports day | 0.7 | 1.05 | 1.1 | 1 | 1.1 | Student Saver ×1.8, Family Table ×1.8 | dessert +1, drink +0.8 |
| Community football final | 0.85 | 1.05 | 0.9 | 1.6 | 1.25 | Evening Social Diner ×2.2 | drink +1.2, small-plate +0.8 |
| Heatwave afternoon | 0.5 | 0.95 | 0.9 | 1 | 1 | Afternoon Treat Stopper ×1.8 | drink +1.5, dessert +1.2, soup −0.6 |
| Monsoon shower | 0.6 | 0.9 | 1 | 1 | 1.35 | — | soup +1.2, noodles +0.8 |
| Heritage food walk | 0.65 | 1 | 1.05 | 1 | 1 | Curious Food Explorer ×2.2, Quality Treat Seeker ×1.6 | small-plate +0.8, seafood +0.8 |
| Public holiday: families out | 0.6 | 1.05 | 1.2 | 1 | 1.15 | Family Table ×2, Comfort-Seeking Regular ×1.4, Office Lunch Sprinter ×0.4 | rice +0.6 |

Each card's English copy (name, a one-line summary and the forecast shown the day before) lives with the card in `src/content/calendar.ts`, not in the launch localization table, so the 438 English localization entries in the [roster counts](#roster-counts) do not include it and the cards are not part of `LAUNCH_ROSTER`. The cards are parsed with `calendarCardSchema` at import (multipliers from 0.25 to 3, category bonuses from −2 to 2), and `tests/content/calendar.test.ts` checks that IDs are unique with exactly one opening day, that the bag has enough cards to avoid repeats, that every card names only launch personas and dish categories, that the bag has both calm and busy cards, that the opening day changes nothing, and that the copy labels neither food nor people.

## Validation requirements

Automated tests must prove the [roster counts](#roster-counts): exactly 18 stalls, 91 dishes, and 12 customer archetypes, at least 98 placeables with at least the listed number in each placeable category, and 438 English keys. They must also prove unique IDs and primary stall/food visual references, a playable dish when each stall unlocks, an opening dish at or below the Student Saver's $6.50 mid budget at every stall, stalls authored in unlock order, valid rotations/footprints, interaction points outside blocking collisions, known asset/audio references, reachable required interactions, a valid unlock graph, and no palette-only duplicate counted as content. Nutrition validation must additionally prove 171 released profiles, 23 variant families with 103 selectable variants, a default in every family that rates below another option, no Borrowed source row outside an allowlisted composite component, a released base profile and Star rating for every dish, complete Health and condition ratings, deterministic source generation, and valid provenance.
