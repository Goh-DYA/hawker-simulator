/**
 * People painters: the customer sprite sheet (south, north and east rows by nine poses), the
 * stall vendor sprite sheet (the same rows by eight poses) and the table-cleaning crew sheet (the
 * same rows by ten poses), plus the hand anchor a carried tray hangs from.
 *
 * Both sheets are built from one 3/4-view figure in `art/people/`: a chibi-proportioned person
 * 34, 39 or 44 px tall with legs, knees and shoes, a slim, average or broad torso, arms with
 * hands, and a head with a face on the front and side views and hair from behind on the north
 * view. Outfits, patterns, lower garments, bags, aprons, headwear and tools are layered on from
 * the spec, so appearance never follows anything but the recipe.
 */
export { plan_crew_sheet } from "./people/crew";
export { plan_customer_sheet, tray_anchor } from "./people/customer";
export { plan_vendor_sheet } from "./people/vendor";
