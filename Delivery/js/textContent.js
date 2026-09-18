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
// END-OF-ORDER doubt loop (after the box closes). The first three reviews
// get their own specific line + review-button label; from the 4th review
// onward it rotates through the repeated-doubt pool below. ENVIAR PEDIDO
// is always offered alongside the review option, at every step.
// --------------------------------------------------------------------------
BakeryDelivery.anxiEndOfOrderDoubts = [
  { text: '¿Y si deberías revisarlo otra vez?', reviewLabel: 'REVISAR' },
  { text: '¿Estás segura de que quedó bien?', reviewLabel: 'REVISAR OTRA VEZ' },
  { text: 'Una vez más no te haría mal…', reviewLabel: 'REVISAR UNA VEZ MÁS' }
];

BakeryDelivery.anxiRepeatedDoubtPool = [
  { text: '¿Y si todavía se te escapó algo?' },
  { text: '¿Segura que no quieres comprobarlo otra vez?' },
  { text: 'Tal vez esta vez notes algo que antes no viste…' },
  { text: '¿Y si hay algo de más?' },
  { text: '¿Y si falta algo?' },
  { text: 'Solo una revisión más…' },
  { text: '¿Estás completamente segura?' },
  { text: '¿Y si cometiste un error sin darte cuenta?' },
  { text: 'Revisarlo otra vez podría dejarte más tranquila…' },
  { text: '¿Y si esta vez sí encuentras algo?' }
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
  finalCount: '5 / 5',
  finalSubtext: '¡Listos para repartir!',

  timeoutTitle: 'SE ACABÓ EL TIEMPO',
  timeoutLines: [
    'Todavía quedan pedidos por preparar.',
    'Intenta seguir adelante aunque Anxi te pida revisar otra vez.'
  ],
  retryBtn: 'VOLVER A INTENTAR'
};
