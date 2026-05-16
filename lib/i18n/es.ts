import type { Dict } from "./en";

const es: Dict = {
  common: {
    signIn: "Ingresar",
    signOut: "Cerrar sesión",
    back: "Volver",
    loading: "Cargando...",
    cancel: "Cancelar",
    copy: "Copiar",
    copied: "Copiado",
    view: "Ver",
    done: "Listo",
    statusLive: "En vivo",
    statusUnderReview: "En revisión",
    statusNotApproved: "No aprobado",
    statusPaused: "Pausado",
    statusMaxedOut: "Tope alcanzado",
    timeSecondsAgo: "hace {n}s",
    timeMinutesAgo: "hace {n}m",
    timeHoursAgo: "hace {n}h",
    timeDaysAgo: "hace {n}d",
  },

  landing: {
    title1: "Haz clips.",
    title2: "Gana dinero.",
    subtitle:
      "Haz videos cortos para marcas. Publícalos en tus redes sociales. Gana por cada visualización.",
    cta: "Empezar a ganar →",
    footer: "Hecho para creadores en todo el mundo. Pagos donde estés.",
    statsCreators: "Creadores",
    statsClipsPosted: "Clips publicados",
    statsPaymentsSent: "Pagos enviados",

    howTitle: "Cobra por hacer videos cortos para marcas",
    howStep1Title: "Recrea un video",
    howStep1Body:
      "Te mostramos exactamente qué video hacer, con un ejemplo y un guion.",
    howStep2Title: "Publícalo en tus redes",
    howStep2Body:
      "Graba un video de 15–60 segundos, publícalo en Instagram o TikTok, y envía el link.",
    howStep3Title: "Cobra",
    howStep3Body:
      "Tus ganancias se actualizan en tiempo real según las visualizaciones. Retira cuando quieras.",

    receiptBalance: "Saldo",
    receiptToday: "Hoy",
    receiptWeek: "Esta semana",
    receiptCashOut: "Retirar",
    receiptInstant: "Transferencias instantáneas",
    receiptNoFees: "Sin comisiones",

    topClipsTitle: "Clips reales. Pagos reales.",
    topClipsSubtitle:
      "Clips recientes de la comunidad y cuánto han ganado hasta ahora.",
    topClipsViewsLabel: "visualizaciones",
    topClipsEarnedLabel: "Ganado",
    topClipsWatchOn: "Ver en {platform} →",
    topClipsEmpty: "Los clips destacados aparecerán aquí pronto.",

    faqTitle: "Aclaremos algunas cosas",
    faqSubtitle:
      "Respuestas cortas para entender cómo funciona Clippa.",
    faqQ1: "¿Cómo funciona esto?",
    faqA1:
      "Recreas videos cortos usando los guiones que te damos, los publicas en tus redes (15–60 segundos), y nos envías los links. A medida que tus videos suman visualizaciones, ganas dinero.",
    faqQ2: "¿Necesito experiencia previa creando contenido?",
    faqA2:
      "No. No necesitas experiencia para empezar a ganar en Clippa.",
    faqQ3: "¿Cómo me pagan?",
    faqA3:
      "Tus ganancias llegan a tu wallet de Clippa en USDT a medida que tus posts suman visualizaciones. Puedes retirar a cualquier wallet, cuando quieras — sin comisiones, sin esperar fin de mes.",
    faqQ4: "¿Cuánto puedo ganar?",
    faqA4:
      "Cada campaña define un máximo por clip. De ahí depende de la campaña y de qué tan virales sean tus clips — entre más visualizaciones, más ganas.",
    faqQ5: "Soy una marca. ¿Cómo lanzo una campaña?",
    faqA5:
      "Cualquiera puede lanzar una campaña en Clippa: defines tu producto, qué pagas por visualización, depositas el presupuesto, y los creadores hacen el resto.",

    brandCtaTitle: "¿Tienes un producto que promocionar?",
    brandCtaBody:
      "Conviértelo en clips con creadores reales. Define cuánto pagas por visualización, deposita el presupuesto, y solo gastas en las visualizaciones que realmente conseguiste.",
    brandCtaButton: "Ver cómo funciona para marcas →",
    brandCtaBullet1: "Paga por visualización, no por seguidor",
    brandCtaBullet2: "Presupuesto reembolsable, cuando quieras",
    brandCtaBullet3: "Activo en 2 minutos",

    footerCommunity: "Únete a nuestra comunidad en Telegram →",

    finalCtaTitleOne: "{n}+ creador ya está ganando",
    finalCtaTitleMany: "{n}+ creadores ya están ganando",
    finalCtaTitleFallback: "Creadores ya están ganando con Clippa",
    finalCtaButton: "Empieza a ganar hoy",
  },

  onboarding: {
    heading: "¿De dónde eres?",
    subtitle: "Lo usamos para mostrarte las campañas adecuadas. Nada más.",
    countryLabel: "País",
    countryPlaceholder: "Elige un país",
    countrySearch: "Buscar...",
    countryEmpty: "Sin resultados.",
    submit: "¡Listo! →",
    saving: "Guardando...",
  },

  home: {
    greeting: "Hola, {name}.",
    subtitle: "Elige una campaña abajo y empieza a ganar.",
    adminLabel: "Admin",
    adminPendingOne: "{n} clip esperando revisión",
    adminPendingMany: "{n} clips esperando revisión",
    adminAllCaught: "Sin pendientes. Todo al día.",
    adminReviewNow: "Revisar ahora →",
    adminOpenAdmin: "Abrir admin →",
    balanceLabel: "Tu balance",
    history: "Historial →",
    withdraw: "Retirar",
    yourClips: "Tus clips",
    liveCampaigns: "Campañas activas",
    noCampaignsTitle: "Todavía no hay campañas.",
    noCampaignsSubtitle: "Aquí aparecen las nuevas. Vuelve pronto.",
  },

  campaign: {
    whatYouEarn: "Lo que ganas",
    perView: "por visualización",
    maxPerClip: "máximo por clip",
    budgetLabel: "Presupuesto de la campaña",
    budgetLeft: "Quedan {amount}",
    budgetOf: "de {total} en total",
    budgetLoading: "Cargando…",
    cardBudgetLeft: "Quedan {amount}",
    cardBudgetLoading: "Cargando presupuesto…",
    cardBudgetOf: "de {total}",
    creatorsEarningOne: "{n} creador ganando",
    creatorsEarningMany: "{n} creadores ganando",
    clipsLiveOne: "{n} clip en vivo",
    clipsLiveMany: "{n} clips en vivo",
    beFirst: "Sé el primero en clipear esto.",
    cardPerView: "{amount} por visualización",
    cardUpTo: "hasta {amount} por clip",
    about: "Sobre esta campaña",
    script: "Guion sugerido",
    rules: "Reglas",
    howItWorks: "Cómo funciona Clippa",
    howItWorks1: "Que se sienta como tú, no como un anuncio.",
    howItWorks2: "Engancha en los primeros 2 segundos.",
    howItWorks3:
      "Pega tu código único en la descripción — así sabemos que el post es tuyo.",
    howItWorks4:
      "Seguimos las visualizaciones cada hora. Tu balance se actualiza solo.",
    submitTitle: "Sube tu clip",
    submitSubtitle:
      "Pega el código en tu descripción, publícalo en IG o TikTok, y deja el link aquí.",
    step1Title: "Paso 1 — Tu código",
    step1Subtitle:
      "Pégalo en algún lugar de tu descripción para que sepamos que el post es tuyo.",
    step2Title: "Paso 2 — ¿Dónde lo publicaste?",
    step3Title: "Paso 3 — Pega el link",
    step4Title: "Paso 4 — Sube el video",
    step4Hint:
      "El archivo MP4. Nos sirve para mostrar tu clip en el home y para que la marca pueda reutilizarlo. Máx 25MB.",
    step4PickFile: "Elegir video",
    step4FileReady: "Listo: {name}",
    submitButton: "Subir clip →",
    submitting: "Verificando...",
    uploading: "Subiendo video...",
    errPickFile: "Elige un video primero.",
    errFileTooLarge: "El video es muy grande (máx 25MB).",
    errFileNotVideo: "Ese archivo no es un video.",
    errPickPlatform: "Elige una plataforma primero.",
    errCodeLoading: "Tu código sigue cargando — prueba de nuevo en un momento.",
    errAuthNotReady:
      "La sesión aún no está lista — prueba de nuevo en un momento.",
    errCouldntVerify:
      "No pudimos verificar el post. Revisa tu conexión y prueba de nuevo.",
    doneTitle: "Listo.",
    doneSubtitleLine1: "Tu clip está siendo revisado.",
    doneSubtitleLine2: "Te avisamos apenas esté en vivo.",
    goHome: "Ir al inicio",
  },

  clipDetail: {
    submitted: "Enviado {ago}",
    statTotalViews: "Visualizaciones totales",
    statEarned: "Ganado",
    statPaid: "Pagado",
    statComingNext: "Próximo pago",
    viewsOverTime: "Visualizaciones en el tiempo",
    noChartData: "Aún no hay datos. Seguimos las visualizaciones cada hora.",
    notApprovedTitle: "Por qué no se aprobó",
    paymentHistory: "Historial de pagos",
    noPayments:
      "Todavía no hay pagos. Aparecerán aquí a medida que entren visualizaciones.",
    headerWhen: "Cuándo",
    headerViews: "Visualizaciones",
    headerAmount: "Monto",
    headerReceipt: "Recibo",
  },

  clipCard: {
    viewsLabel: "{n} visualizaciones",
    earnedLabel: "{amount} ganados",
    paidLabel: "{amount} pagados",
    removeAria: "Eliminar clip",
    confirmRemove: "¿Eliminar este clip?",
    payoutsStay:
      "Los pagos ya enviados son tuyos. Dejamos de seguir visualizaciones nuevas.",
    noLoss: "Todavía no ganaste nada, así que no se pierde nada.",
    yesRemove: "Sí, eliminar",
    removing: "Eliminando...",
    reasonLabel: "Motivo:",
  },

  withdraw: {
    title: "Retirar tu dinero",
    subtitle: "Envía tu balance a tu propia cuenta.",
    whereTitle: "¿A dónde lo envío?",
    step1: "1. Abre tu exchange (Binance, Coinbase, etc.).",
    step2: "2. Ve a Depositar y elige USDT.",
    step3: "3. Elige la red Celo.",
    step4: "4. Copia la dirección que te muestra y pégala abajo.",
    amount: "Monto",
    max: "Máx",
    available: "Disponible: {amount}",
    destination: "Dirección de destino",
    invalidAddress: "Eso no parece una dirección válida.",
    warning: "Verifica bien la dirección — las transferencias no se deshacen.",
    button: "Retirar",
    buttonWithAmount: "Retirar {amount}",
    sending: "Enviando...",
    doneTitle: "En camino.",
    doneSubtitle: "Enviamos {amount}. Suele llegar en unos segundos.",
    viewReceipt: "Ver recibo",
    errNotEnough: "No alcanza el balance para este retiro.",
    errCancelled: "Cancelaste la transferencia.",
  },

  community: {
    title: "Únete a la comunidad",
    subtitle:
      "Resuelve dudas, comparte tus clips, conecta con otros creadores y entérate primero de las campañas nuevas. Todo en nuestro Telegram.",
    cta: "Únete a la comunidad →",
    inlineHint: "¿Atascado? Pregunta en la comunidad en Telegram →",
    welcomeTitle: "Listo. Una última cosa.",
    welcomeSubtitle:
      "Únete al Telegram para no perderte campañas nuevas y para que podamos ayudarte rápido si te atascas.",
    welcomeSkip: "Más tarde",
  },

  payoutDialog: {
    defaultTitle: "Historial de pagos",
    defaultSubtitle: "Cada pago, con su recibo on-chain.",
    myPayoutsTitle: "Tus pagos",
    myPayoutsSubtitle: "Cada pago que recibiste, con su recibo.",
    noPayouts: "Todavía no hay pagos.",
    headerWhen: "Cuándo",
    headerCreator: "Creador",
    headerCampaign: "Campaña",
    headerAmount: "Monto",
    headerStatus: "Estado",
    headerReceipt: "Recibo",
  },

  brand: {
    badgeBrand: "Marca",
    badgeCreator: "Creador",
    modeLabel: "Modo",
    backToDashboard: "← Volver al panel",
    creatorMode: "Cambiar a modo creador",
    brandMode: "Cambiar a modo marca",
    forCreators: "Para creadores →",

    landingTitle1: "Consigue usuarios.",
    landingTitle2: "Paga por resultados.",
    landingSubtitle:
      "Creadores reales convierten tu producto en videos cortos en Instagram y TikTok. Tú defines el precio por visualización, depositas un presupuesto y solo gastas en visualizaciones que realmente ocurren. Sin agencias. Sin contratos.",
    landingCta: "Lanzar una campaña →",
    landingHowTitle: "Adquisición de usuarios que se paga sola",
    landingStep1Title: "Define tu campaña",
    landingStep1Body:
      "Producto, cuánto pagas por visualización, un tope por clip y las reglas que los creadores siguen. Toma 2 minutos.",
    landingStep2Title: "Deposita tu presupuesto",
    landingStep2Body:
      "Empieza con lo que quieras. El dinero se queda en un escrow on-chain — tuyo hasta que lleguen las visualizaciones.",
    landingStep3Title: "Ve cómo llegan las visualizaciones",
    landingStep3Body:
      "Los creadores publican, nosotros rastreamos visualizaciones cada hora, los pagos fluyen automáticamente. Solo pagas por lo que conseguiste.",

    landingFaqTitle: "Respuestas rápidas",
    landingFaqSubtitle:
      "Todo lo que querías preguntar antes de lanzar una campaña.",
    landingFaqQ1: "¿Cuánto cuesta una campaña?",
    landingFaqA1:
      "Tú defines la tarifa por visualización (ej. $0.01) y un tope por clip (ej. $20). Empieza con el presupuesto que quieras — no hay mínimo. Solo gastas en las visualizaciones que los creadores realmente generen.",
    landingFaqQ2: "¿Y si ningún creador toma mi campaña?",
    landingFaqA2:
      "Tu dinero sigue siendo tuyo. El depósito vive en escrow y puedes terminar la campaña y recuperar lo no gastado cuando quieras.",
    landingFaqQ3: "¿Cómo verifican las visualizaciones?",
    landingFaqA3:
      "Cada hora consultamos los conteos reales de visualizaciones que reporta Instagram y TikTok, y pagamos contra esos números. Sin bots, sin métricas infladas — solo lo que las plataformas mismas reportan.",
    landingFaqQ4: "¿Quién le paga a los creadores?",
    landingFaqA4:
      "Nosotros, automáticamente, desde el escrow de tu campaña a medida que llegan visualizaciones. Los creadores reciben USDT en su wallet — tú no tocas el flujo de pago.",
    landingFaqQ5: "¿Puedo correr varias campañas?",
    landingFaqQ5Hint: "",
    landingFaqA5:
      "Sí. Diferentes productos, diferentes tarifas, diferentes reglas — cada campaña es independiente. Las manejas todas desde tu dashboard en /brand.",
    landingFaqQ6: "Soy creador. ¿Dónde me registro?",
    landingFaqA6:
      "En la página principal. O haz click en 'Para creadores' abajo en el footer.",

    landingFinalCtaTitleOne:
      "{n}+ campaña ya está corriendo en Clippa",
    landingFinalCtaTitleMany:
      "{n}+ campañas ya están corriendo en Clippa",
    landingFinalCtaTitleFallback: "Sé la primera campaña en Clippa",
    landingFinalCtaButton: "Lanza tu campaña",

    landingFooter:
      "Sin sobreprecio de agencia. Sin contratos largos. Solo pagas por resultados.",
    landingFooterCreators: "Para creadores →",
    landingFooterCommunity: "Únete a nuestra comunidad en Telegram →",

    // Etiquetas de los mockups visuales en /brands
    mockTitleCampaign: "Nueva campaña",
    mockProduct: "Producto",
    mockProductValue: "Nerdos.fun",
    mockRate: "Tarifa / visualización",
    mockRateValue: "$0.01",
    mockCap: "Tope / clip",
    mockCapValue: "$20",
    mockPlatforms: "Plataformas",
    mockDeposit: "Depósito",
    mockEscrow: "Escrow on-chain",
    mockYourMoney: "Tu dinero, reembolsable cuando quieras",
    mockDashTitle: "Visualizaciones activas",
    mockDashClips: "Clips activos",
    mockDashSpent: "Gastado",

    dashTitle: "Tus campañas",
    dashSubtitle: "Lanza, financia y monitorea tus campañas con creadores.",
    dashNewCampaign: "Nueva campaña",
    dashEmptyTitle: "Todavía no hay campañas",
    dashEmptyBody:
      "Lanzar toma unos 2 minutos. Define tu producto, fija una tarifa por visualización, deposita tu presupuesto y los creadores hacen lo demás.",
    dashEmptyCta: "Crear tu primera campaña",
    statusActive: "Activa",
    statusPaused: "Pausada",
    statusEnded: "Finalizada",
    statusAwaitingFunding: "Pendiente de pago",
    cardFundingIncomplete: "Depósito incompleto",
    cardFundingIncompleteBody:
      "Termina de depositar tu presupuesto para que la campaña quede activa.",
    cardResumeDeposit: "Continuar depósito",
    cardNotFunded: "Presupuesto sin depositar",
    cardNotFundedBody: "Termina el depósito para empezar a rastrear visualizaciones.",
    cardBalanceLeft: "Saldo restante",
    cardRunningLow: "Quedando poco",
    cardPaidToCreators: "Pagado a creadores",
    cardOfFunded: "de {amount} depositados",
    cardClip: "Clip",
    cardClips: "Clips",
    cardLive: "Activos",
    cardViews: "Visualizaciones",
    cardRate: "Tarifa",
    cardPerView: "/ visualización",
    cardMax: "Máx",
    cardPerClip: "/ clip",
    cardAddFunds: "Agregar fondos",
    cardViewClips: "Ver clips →",

    clipsTitle: "Clips en {campaign}",
    clipsSubtitle:
      "Todos los clips enviados a tu campaña, ordenados por ganancias. Descarga los videos para reutilizarlos donde quieras.",
    clipsEmpty: "Aún no hay clips en esta campaña.",
    clipsDownload: "Descargar video",
    clipsNoVideo: "Sin archivo de video",
    clipsViewPost: "Ver post",
    clipsStatusPending: "En revisión",
    clipsStatusTracking: "Activo",
    clipsStatusRejected: "Rechazado",
    clipsStatusPaused: "Pausado",
    clipsStatusMaxed: "Tope alcanzado",
    clipsViews: "visualizaciones",
    clipsEarned: "ganado",
    clipsPaid: "pagado",

    wizStep1: "Detalles",
    wizStep2: "Revisar y depositar",
    wizSectionPromoting: "Qué estás promocionando",
    wizSectionBrief: "Qué quieres que hagan los creadores",
    wizSectionMoney: "Dinero",
    wizSectionPreview: "Vista previa",
    wizSectionPreviewHint:
      "Cómo se verá tu campaña para los creadores. Se actualiza mientras escribes.",

    fldLanguage: "Idioma en el que escribirás",
    fldLanguageHint:
      "Elige el idioma en el que vas a escribir el contenido. Lo traducimos automáticamente a los demás idiomas soportados para que cada creador vea la campaña en su propio idioma.",
    fldProductName: "Nombre del producto",
    fldProductNameHint:
      "Aparece como título tanto en el catálogo como en la página de la campaña.",
    fldSlug: "Slug de la URL",
    fldSlugHintIdle:
      "Letras minúsculas, números y guiones. Se usa en la URL de la campaña.",
    fldSlugHintChecking: "Comprobando disponibilidad…",
    fldSlugHintAvailable: "✓ Disponible: clippa.fun/app/campaigns/{slug}",
    fldSlugHintTaken: "✗ Ya está en uso — elige otro",
    fldTagline: "Frase de catálogo",
    fldTaglineHint:
      "Una línea que aparece debajo del nombre del producto en el catálogo. 8–15 palabras.",
    fldAbout: "Acerca del producto",
    fldAboutHint:
      "Un párrafo que los creadores leen antes de decidir hacer un clip. ¿Qué es el producto? ¿Por qué quieres clips? ¿Qué tipo de clips funcionan mejor?",
    fldReferenceVideo: "Video de referencia (opcional)",
    fldReferenceVideoHint:
      "Si tienes un clip que captura el tono que buscas, pega el link aquí.",
    fldScript: "Guion sugerido",
    fldScriptHint:
      "La estructura que te gustaría ver — gancho, cuerpo, cierre, frases. Los creadores lo leen como inspiración y pueden adaptarlo. Markdown: **negrita** funciona.",
    fldRules: "Reglas para los clips",
    fldRulesHint:
      "Requisitos obligatorios. Los clips que no las cumplan se rechazan. Sé específico — por ejemplo, 'mencionar la URL en pantalla', 'no usar la palabra X'.",
    fldRatePerView: "Tarifa por visualización",
    fldRatePerViewHint: "$0.01 = $10 por cada 1,000 visualizaciones.",
    fldMaxPerClip: "Máximo por clip",
    fldMaxPerClipHint:
      "Tope por clip individual — incluso uno viral se detiene aquí.",
    fldTotalBudget: "Presupuesto total",
    fldTotalBudgetHint:
      "USDT con los que vas a financiar el escrow ahora. Puedes agregar más después.",
    fldPlatforms: "Plataformas",
    fldPlatformsHint: "¿Desde dónde pueden enviar clips los creadores?",
    fldPlatformsRequired: "Elige al menos una plataforma.",

    wizBtnNext: "Siguiente: revisar y depositar",
    wizBtnReserving: "Reservando...",

    reviewTermsTitle: "Términos",
    reviewProduct: "Producto",
    reviewSlug: "Slug",
    reviewPlatforms: "Plataformas",
    reviewTagline: "Frase de catálogo",
    reviewRatePerView: "Tarifa / visualización",
    reviewMaxPerClip: "Máx / clip",
    reviewTotalBudget: "Presupuesto total",
    reviewPreviewTitle: "Vista previa para creadores",
    reviewPreviewHint:
      "Exactamente lo que verán los creadores una vez deposites tu presupuesto.",

    fundTitle: "Deposita tu presupuesto",
    fundExplainer:
      "Vas a confirmar 3 pasos rápidos desde tu wallet para depositar tu dinero en la campaña y dejarla activa. Tu dinero sigue siendo tuyo — Clippa nunca lo retiene.",
    fundAmount: "Depósito",
    fundGoesTo: "→ Disponible para clips",
    fundUsdtNote:
      "Se paga en USDT (un dólar digital, 1 USDT = $1). El 100% de este monto va al presupuesto de tu campaña hoy.",
    fundTxApprove: "Aprobar transferencia",
    fundTxCreate: "Crear campaña",
    fundTxSend: "Enviar fondos",
    fundBtnConfirm: "Confirmar y lanzar",
    fundBtnConfirming: "Confirmando...",
    fundBtnEdit: "Editar detalles",
    fundDoneTitle: "Campaña lanzada",
    fundDoneBody: "Tu presupuesto ya está. Los creadores pueden enviar clips.",
    fundDoneReceipt: "Ver recibo del pago",
    fundDoneCta: "Ir al panel",

    resumeLabel: "Continuar depósito",
    resumeNotFound: "Campaña no encontrada",
    resumeNotFoundBody:
      "Puede que ya esté activa, o que no te pertenezca.",
    resumeBack: "Volver al panel",
    resumeNote:
      "Continuamos desde donde se quedó el último intento — los pasos que ya se completaron se omiten automáticamente.",
    resumeDoneTitle: "Campaña activa",
    resumeBtnApproving: "Aprobando transferencia...",
    resumeBtnCreating: "Creando campaña...",
    resumeBtnFunding: "Enviando fondos...",
    resumeBtnFinalizing: "Finalizando...",
    resumeBtnIdle: "Continuar depósito",
    resumeCancel: "Cancelar",

    addFundsTitle: "Agregar fondos",
    addFundsSubtitle: "Recarga el presupuesto de {name}.",
    addFundsCurrent: "Saldo actual",
    addFundsLabel: "Monto a agregar (USD)",
    addFundsHint:
      "Vas a confirmar 1–2 pasos rápidos desde tu wallet para enviar el depósito. Se paga en USDT (un dólar digital, 1 USDT = $1).",
    addFundsApproving: "Aprobando transferencia…",
    addFundsSending: "Enviando fondos…",
    addFundsBtnApproving: "Aprobando...",
    addFundsBtnSending: "Enviando...",
    addFundsBtnIdleFilled: "Agregar {amount}",
    addFundsBtnIdle: "Agregar fondos",
    addFundsDoneTitle: "Fondos agregados",
    addFundsDoneBody: "{amount} agregados al presupuesto de tu campaña.",
    addFundsDoneReceipt: "Ver recibo del pago",

    errContractNotConfigured: "Dirección del contrato no configurada.",
    errNoWallet: "No se encontró una wallet en tu cuenta.",
    errSigningCancelled: "Firma cancelada.",
    errInsufficientFunds:
      "No hay suficiente USDT, o no hay CELO para la tarifa de red.",

    mdEdit: "Editar",
    mdPreview: "Vista previa",
    mdHint: "**negrita** · saltos de línea conservados",
    mdHintWithCount:
      "**negrita** · saltos de línea conservados · {count}/{max}",
    mdEmpty: "Nada para previsualizar todavía.",

    pvCatalog: "1. En el catálogo",
    pvCatalogHint: "Lo que ven los creadores al explorar campañas.",
    pvDetail: "2. En la página de la campaña",
    pvDetailHint: "Lo que ven los creadores después de abrir tu card.",
    pvAbout: "Acerca de",
    pvScript: "Guion",
    pvRules: "Reglas",
    pvScriptEmpty: "Tu guion sugerido aparecerá aquí.",
    pvRulesEmpty: "Tus reglas para los clips aparecerán aquí.",
    pvBudgetLeft: "{amount} restantes",
    pvBudgetOf: "de {amount}",
    pvRatePerView: "${rate} / visualización",
    pvUpTo: "Hasta {amount} por clip",
    pvPlaceholderProduct: "Nombre de tu producto",
    pvPlaceholderShort: "Tu frase de catálogo en una línea.",
    pvPlaceholderLong: "Aquí va tu descripción más larga.",
    pvPerView: "Por visualización",
    pvMaxPerClip: "Máx por clip",
  },
};

export default es;
