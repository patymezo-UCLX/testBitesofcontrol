/* ==========================================================================
   BAKERY DELIVERY — TEXT CONTENT
   Every line of Anxi/review/send/timeout wording lives here, in one place,
   so it can be edited later without touching any interaction logic.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

// --------------------------------------------------------------------------
// Doubts Anxi may raise DURING active packing (falling-object gameplay).
// Each interruption shows one of these + a single CONTINUAR button.
// --------------------------------------------------------------------------
BakeryDelivery.anxiPackingDialogues = [
  { text: '¿Estás segura de que estás empaquetando bien?' },
  { text: 'Seguro metiste algo que no debías…' },
  { text: '¿Y si confundiste un producto?' },
  { text: '¿Viste bien lo que decía el pedido?' },
  { text: 'Creo que deberías comprobar la caja.' },
  { text: '¿Y si se te olvidó algo?' },
  { text: 'Tal vez atrapaste el producto equivocado…' },
  { text: '¿Estás segura de que eso sí iba en este pedido?' },
  { text: '¿Y si deberías mirar la nota otra vez?' },
  { text: 'Puede que hayas cometido un error sin darte cuenta.' },
  { text: '¿Seguro que no cayó algo que no debía?' },
  { text: 'Yo revisaría… solo para estar seguros.' },
  { text: '¿Y si falta algo?' },
  { text: '¿Y si hay algo de más?' },
  { text: '¿De verdad recuerdas todo lo que atrapaste?' }
];

// The occasional brief second doubt after the player presses CONTINUAR
// during active packing. Never opens a new decision — just one more
// CONTINUAR.
BakeryDelivery.anxiPackingFollowUp = '¿Aunque no estés completamente segura?';

// --------------------------------------------------------------------------
// Non-blocking DISTRACTION phrases (Change 5 / Change 3) — short, one-line,
// shown in the auto-dismissing speech bubble that never pauses gameplay.
// Distinct pool from anxiPackingDialogues above, which is the OLDER
// blocking-doubt pool; kept both intact rather than deleting the existing
// approved content.
// --------------------------------------------------------------------------
BakeryDelivery.anxiPackingDistractionPhrases = [
  '¿Seguro pusiste solo lo que pedían?',
  '¿Y si cayó algo que no iba?',
  'Tal vez se te escapó algo…',
  '¿Seguro no metiste algo de más?',
  'Podrías haber confundido un producto.',
  '¿Y si falta algo en la caja?',
  'Tal vez deberías comprobarlo otra vez.',
  '¿Seguro está quedando bien?'
];

BakeryDelivery.anxiDeliveryNearPhrases = [
  '¿Seguro llevas el pedido correcto?',
  'Tal vez confundiste algún pedido…',
  '¿Y si algo no está bien?',
  'Quizá deberías comprobarlo.',
  '¿Seguro no olvidaste algo?',
  'Podrías haber confundido una caja.',
  '¿Y si este no era el pedido?',
  'Tal vez sería mejor revisarlo otra vez.'
];

BakeryDelivery.anxiDeliveryCollisionDoubt = '¿Seguro que no necesitas revisarlo otra vez?';

// --------------------------------------------------------------------------
// END-OF-ORDER doubt loop (after the box closes). The first three reviews
// get their own specific line + review-button label; from the 4th review
// onward it rotates through the repeated-doubt pool below. ENVIAR PEDIDO
// is always offered alongside the review option, at every step.
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// END-OF-ORDER doubt loop (after the box closes). Exactly 3 fixed prompts
// (initial + 2 repeats) — after the 2nd review, the sequence concludes and
// the order sends automatically (see anxiSystem.js's showEndOfOrderDoubt);
// no unbounded 4th/5th/... prompt anymore.
// --------------------------------------------------------------------------
BakeryDelivery.anxiEndOfOrderDoubts = [
  { text: '¿Seguro que no necesitas revisarlo otra vez?', reviewLabel: 'REVISAR' },
  { text: '¿Seguro revisaste todo?', reviewLabel: 'REVISAR OTRA VEZ' },
  { text: '¿Y si se te pasó algo?', reviewLabel: 'REVISAR OTRA VEZ' }
];


// --------------------------------------------------------------------------
// Review / send / timeout / success copy.
// --------------------------------------------------------------------------
BakeryDelivery.reviewText = {
  reviewTitle: 'REVISAR PEDIDO',
  finishReviewBtn: 'TERMINAR REVISIÓN',
  sendBtn: 'ENVIAR PEDIDO',
  continuarBtn: 'CONTINUAR',

  sentText: '¡PEDIDO ENVIADO!',

  finalTitle: '¡PEDIDOS PREPARADOS!',
  finalCount: '4 / 4',
  finalSubtext: '¡Listos para repartir!',

  timeoutTitle: 'SE ACABÓ EL TIEMPO',
  timeoutLines: [
    'Todavía quedan pedidos por preparar.',
    'Intenta seguir adelante aunque Anxi te pida revisar otra vez.'
  ],

  noLivesTitle: 'TE QUEDASTE SIN VIDAS',
  noLivesLines: [
    '¡Cuidado con lo que pones en la caja!'
  ],

  retryBtn: 'VOLVER A INTENTAR'
};
