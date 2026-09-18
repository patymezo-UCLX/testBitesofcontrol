/* ==========================================================================
   BAKERY DELIVERY — ORDERS
   Order configuration lives here, separate from gameplay logic, so orders
   can be edited/extended without touching how the game runs.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.orders = [
  { id: 1, items: ['object-3', 'object-5'] },              // two cookies + vanilla cupcake
  { id: 2, items: ['object-6', 'object-4'] },               // pink donut + cake slice
  { id: 3, items: ['object-2', 'object-1', 'object-3'] },   // choc cupcake + choc cake slice + two cookies
  { id: 4, items: ['object-5', 'object-6', 'object-1'] }    // vanilla cupcake + pink donut + choc cake slice
];
