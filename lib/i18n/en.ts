/**
 * English dictionary — the canonical source. The Spanish file must mirror
 * its shape; the Spanish file imports the `Dict` type from here.
 *
 * Keys are accessed with `t("path.to.key")` from useTranslation().
 * `{var}` placeholders are substituted at call time.
 */

const en = {
  common: {
    signIn: "Sign in",
    signOut: "Sign out",
    back: "Back",
    loading: "Loading...",
    cancel: "Cancel",
    copy: "Copy",
    copied: "Copied",
    view: "View",
    done: "Done",
    statusLive: "Live",
    statusUnderReview: "Under review",
    statusNotApproved: "Not approved",
    statusPaused: "Paused",
    statusMaxedOut: "Max payout reached",
    timeSecondsAgo: "{n}s ago",
    timeMinutesAgo: "{n}m ago",
    timeHoursAgo: "{n}h ago",
    timeDaysAgo: "{n}d ago",
  },

  landing: {
    title1: "Make clips.",
    title2: "Get paid.",
    subtitle:
      "Make short videos for apps. Post them to your socials. Earn for every view.",
    cta: "Start earning →",
    footer: "Built for creators worldwide. Payments anywhere.",
    statsCreators: "Creators",
    statsClipsPosted: "Clips posted",
    statsPaymentsSent: "Payments sent",

    howTitle: "Get paid to make short videos for apps",
    howStep1Title: "Recreate a video",
    howStep1Body:
      "We show you exactly what video to make with an example and a script.",
    howStep2Title: "Post to social media",
    howStep2Body:
      "Record a 15–60 second video, post it to Instagram or TikTok, and submit the link.",
    howStep3Title: "Get paid",
    howStep3Body:
      "Your earnings update in real time as you get views. Cash out whenever you want.",

    receiptBalance: "Balance",
    receiptToday: "Today",
    receiptWeek: "This week",
    receiptCashOut: "Cash out",
    receiptInstant: "Instant transfers",
    receiptNoFees: "No fees",

    topClipsTitle: "Real clips. Real payouts.",
    topClipsSubtitle:
      "Recent clips from the community and what they've earned so far.",
    topClipsViewsLabel: "views",
    topClipsEarnedLabel: "Earned",
    topClipsWatchOn: "Watch on {platform} →",
    topClipsEmpty: "Top-earning clips will show up here soon.",

    faqTitle: "Let's clear a few things up",
    faqSubtitle: "A short set of answers to help you understand how Clippa works.",
    faqQ1: "How does this work?",
    faqA1:
      "You recreate short videos using provided scripts, post them on your social media (15–60 seconds), and submit the links. As your videos get views, you earn money.",
    faqQ2: "Do I need prior content creation experience?",
    faqA2:
      "You do not. No content experience is required to start earning on Clippa.",
    faqQ3: "How do I get paid?",
    faqA3:
      "Earnings land in your Clippa wallet in USDT as your submissions get views. You can withdraw to any wallet, anytime — no fees, no waiting until month-end.",
    faqQ4: "How much can I earn?",
    faqA4:
      "Each campaign sets a max per clip. Beyond that, it's up to the campaign and how viral your clips go — the more views, the more you earn.",
    faqQ5: "I have an app to promote. Where do I start?",
    faqA5:
      "Anyone can launch a campaign on Clippa: set your app, what you pay per view, fund the budget, and creators take it from there.",

    brandCtaTitle: "Got an app to promote?",
    brandCtaBody:
      "Turn it into clips with real creators. Set what you pay per view, fund the budget, and only spend on views you actually got.",
    brandCtaButton: "Promote your app →",
    brandCtaBullet1: "Pay per view, not per follower",
    brandCtaBullet2: "Refundable budget, anytime",
    brandCtaBullet3: "Live in 2 minutes",

    footerCommunity: "Join our community on Telegram →",

    finalCtaTitleOne: "{n}+ creator is already earning",
    finalCtaTitleMany: "{n}+ creators are already earning",
    finalCtaTitleFallback: "Creators are already earning with Clippa",
    finalCtaButton: "Start making money today",
  },

  onboarding: {
    heading: "Where are you from?",
    subtitle: "We use this to match you with the right campaigns. That's it.",
    countryLabel: "Country",
    countryPlaceholder: "Pick a country",
    countrySearch: "Search...",
    countryEmpty: "No country found.",
    submit: "All set →",
    saving: "Saving...",
  },

  home: {
    greeting: "Hi, {name}.",
    subtitle: "Pick a campaign below and start earning.",
    adminLabel: "Admin",
    adminPendingOne: "{n} clip waiting to be reviewed",
    adminPendingMany: "{n} clips waiting to be reviewed",
    adminAllCaught: "Nothing pending. All caught up.",
    adminReviewNow: "Review now →",
    adminOpenAdmin: "Open admin →",
    balanceLabel: "Your balance",
    history: "History →",
    withdraw: "Withdraw",
    yourClips: "Your clips",
    liveCampaigns: "Live campaigns",
    noCampaignsTitle: "No campaigns yet.",
    noCampaignsSubtitle: "New ones drop here. Check back soon.",
  },

  campaign: {
    whatYouEarn: "What you earn",
    perView: "per view",
    maxPerClip: "max per clip",
    budgetLabel: "Campaign budget",
    budgetLeft: "{amount} left",
    budgetOf: "of {total} total",
    budgetLoading: "Loading…",
    cardBudgetLeft: "{amount} budget left",
    cardBudgetLoading: "Loading budget…",
    cardBudgetOf: "of {total}",
    creatorsEarningOne: "{n} creator earning",
    creatorsEarningMany: "{n} creators earning",
    clipsLiveOne: "{n} clip live",
    clipsLiveMany: "{n} clips live",
    beFirst: "Be the first to clip this.",
    cardPerView: "{amount} per view",
    cardUpTo: "up to {amount} per clip",
    about: "About this campaign",
    script: "Suggested script",
    rules: "Rules",
    howItWorks: "How Clippa works",
    howItWorks1: "Make it feel like you, not an ad.",
    howItWorks2: "Hook in the first 2 seconds.",
    howItWorks3:
      "Drop your unique code in the caption — that's how we know the post is yours.",
    howItWorks4: "We track views every hour. Your balance updates on its own.",
    submitTitle: "Submit your clip",
    submitSubtitle:
      "Add the code to your caption, post on IG or TikTok, then drop the link here.",
    step1Title: "Step 1 — Your code",
    step1Subtitle:
      "Paste this somewhere in your caption so we know the post is yours.",
    step2Title: "Step 2 — Where did you post it?",
    step3Title: "Step 3 — Paste the link",
    step4Title: "Step 4 — Upload the video",
    step4Hint:
      "The MP4 file. Lets us showcase your clip on the homepage and lets the app's team reuse it. Max 25MB.",
    step4PickFile: "Pick a video",
    step4FileReady: "Ready: {name}",
    submitButton: "Submit clip →",
    submitting: "Verifying...",
    uploading: "Uploading video...",
    errPickFile: "Pick a video file first.",
    errFileTooLarge: "Video is too large (max 25MB).",
    errFileNotVideo: "That file isn't a video.",
    errPickPlatform: "Pick a platform first.",
    errCodeLoading: "Your code is still loading — try again in a sec.",
    errAuthNotReady: "Auth not ready yet — try again in a sec.",
    errCouldntVerify:
      "Couldn't verify the post. Check your connection and try again.",
    doneTitle: "Got it.",
    doneSubtitleLine1: "Your clip is being reviewed.",
    doneSubtitleLine2: "We'll let you know as soon as it's live.",
    goHome: "Go home",
  },

  clipDetail: {
    submitted: "Submitted {ago}",
    statTotalViews: "Total views",
    statEarned: "Earned",
    statPaid: "Paid",
    statComingNext: "Coming next",
    viewsOverTime: "Views over time",
    noChartData: "No data yet. We track views every hour.",
    notApprovedTitle: "Why this wasn't approved",
    paymentHistory: "Payment history",
    noPayments: "No payments yet. They'll show up here as views come in.",
    headerWhen: "When",
    headerViews: "Views",
    headerAmount: "Amount",
    headerReceipt: "Receipt",
  },

  clipCard: {
    viewsLabel: "{n} views",
    earnedLabel: "{amount} earned",
    paidLabel: "{amount} paid",
    removeAria: "Remove clip",
    confirmRemove: "Remove this clip?",
    payoutsStay:
      "Payouts already sent stay yours. We'll stop tracking new views.",
    noLoss: "You haven't earned anything yet, so nothing's lost.",
    yesRemove: "Yes, remove",
    removing: "Removing...",
    reasonLabel: "Reason:",
  },

  withdraw: {
    title: "Withdraw your money",
    subtitle: "Send your balance to your own account.",
    whereTitle: "Where do I send it?",
    step1: "1. Open your exchange (Binance, Coinbase, etc.).",
    step2: "2. Go to Deposit and choose USDT.",
    step3: "3. Pick the Celo network.",
    step4: "4. Copy the address it gives you and paste it below.",
    amount: "Amount",
    max: "Max",
    available: "Available: {amount}",
    destination: "Destination address",
    invalidAddress: "That doesn't look like a valid address.",
    warning: "Double-check the address — transfers can't be undone.",
    button: "Withdraw",
    buttonWithAmount: "Withdraw {amount}",
    sending: "Sending...",
    doneTitle: "On its way.",
    doneSubtitle: "{amount} sent. It usually arrives in a few seconds.",
    viewReceipt: "View receipt",
    errNotEnough: "Not enough balance to cover this withdrawal.",
    errCancelled: "You cancelled the transfer.",
  },

  community: {
    title: "Join the community",
    subtitle:
      "Get answers, share your clips, connect with other creators, and hear about new campaigns first. All on our Telegram.",
    cta: "Join the community →",
    inlineHint: "Stuck? Ask the community on Telegram →",
    welcomeTitle: "You're in. One last thing.",
    welcomeSubtitle:
      "Join our Telegram so you don't miss new campaigns, and so we can help fast if you hit a snag.",
    welcomeSkip: "Maybe later",
  },

  payoutDialog: {
    defaultTitle: "Payout history",
    defaultSubtitle: "Every payment, with its on-chain receipt.",
    myPayoutsTitle: "Your payouts",
    myPayoutsSubtitle: "Every payment you've received, with its receipt.",
    noPayouts: "No payouts yet.",
    headerWhen: "When",
    headerCreator: "Creator",
    headerCampaign: "Campaign",
    headerAmount: "Amount",
    headerStatus: "Status",
    headerReceipt: "Receipt",
  },

  brand: {
    // Shared
    badgeBrand: "Brand",
    badgeCreator: "Creator",
    modeLabel: "Mode",
    backToDashboard: "← Back to dashboard",
    creatorMode: "Switch to creator mode",
    brandMode: "Switch to brand mode",
    forCreators: "For creators →",

    // /brands landing — targeting builders/founders, not corporate brands
    landingTitle1: "Get real people",
    landingTitle2: "talking about your app.",
    landingSubtitle:
      "Launch creator campaigns for your app. Get authentic videos and reach new users through social media.",
    landingCta: "Launch a campaign →",
    landingHowTitle: "User acquisition that pays for itself",
    landingStep1Title: "Define your campaign",
    landingStep1Body:
      "Your app, what you pay per view, a cap per clip, and the rules creators follow. Takes 2 minutes.",
    landingStep2Title: "Deposit your budget",
    landingStep2Body:
      "Start with as little as you want. The money sits in an on-chain escrow — yours until views land.",
    landingStep3Title: "Watch views land",
    landingStep3Body:
      "Creators post, we track views every hour, payouts flow automatically. You only pay for the views you got.",

    landingFaqTitle: "Quick answers",
    landingFaqSubtitle:
      "Everything you wanted to ask before launching a campaign.",
    landingFaqQ1: "How much does a campaign cost?",
    landingFaqA1:
      "You set the rate per view (e.g. $0.01) and a cap per clip (e.g. $20). Start with any budget you want — there's no minimum to launch. You only spend on views creators actually deliver.",
    landingFaqQ2: "What if no creator picks my campaign?",
    landingFaqA2:
      "Your money stays yours. The deposit sits in escrow and you can end the campaign and recover unspent funds whenever you want.",
    landingFaqQ3: "How are views verified?",
    landingFaqA3:
      "We scrape the actual view counts from Instagram and TikTok every hour and pay against those numbers. No bots, no fake metrics — only views the platforms themselves report.",
    landingFaqQ4: "Who pays the creators?",
    landingFaqA4:
      "We do, automatically, from your campaign's escrow as views land. Creators get paid in USDT to their wallet — you never touch the payout flow.",
    landingFaqQ5: "Can I run multiple campaigns?",
    landingFaqQ5Hint: "",
    landingFaqA5:
      "Yes. Different apps, different rates, different rules — each campaign is independent. Manage them all from your /brand dashboard.",
    landingFaqQ6: "I'm a creator. Where do I sign up?",
    landingFaqA6:
      "On the homepage. Or click 'For creators' in the footer below.",

    landingFinalCtaTitleOne:
      "{n}+ campaign is already running on Clippa",
    landingFinalCtaTitleMany:
      "{n}+ campaigns are already running on Clippa",
    landingFinalCtaTitleFallback: "Be the first campaign on Clippa",
    landingFinalCtaButton: "Launch your campaign",

    landingFooter:
      "No agency markup. No long-term contracts. Only pay for results.",
    landingFooterCreators: "For creators →",
    landingFooterCommunity: "Join our community on Telegram →",

    // Mockup labels for the visual cards on /brands
    mockTitleCampaign: "New campaign",
    mockProduct: "App",
    mockProductValue: "Nerdos.fun",
    mockRate: "Rate / view",
    mockRateValue: "$0.01",
    mockCap: "Cap / clip",
    mockCapValue: "$20",
    mockPlatforms: "Platforms",
    mockDeposit: "Deposit",
    mockEscrow: "On-chain escrow",
    mockYourMoney: "Your money, refundable anytime",
    mockDashTitle: "Live views",
    mockDashClips: "Live clips",
    mockDashSpent: "Spent",

    // /brand dashboard
    dashTitle: "Your campaigns",
    dashSubtitle: "Launch, fund, and track your creator campaigns.",
    dashNewCampaign: "New campaign",
    dashEmptyTitle: "No campaigns yet",
    dashEmptyBody:
      "Launching takes about 2 minutes. Define your app, set a rate per view, deposit your budget, and creators take it from there.",
    dashEmptyCta: "Create your first campaign",
    statusActive: "Active",
    statusPaused: "Paused",
    statusEnded: "Ended",
    statusAwaitingFunding: "Awaiting funding",
    cardFundingIncomplete: "Funding incomplete",
    cardFundingIncompleteBody:
      "Finish depositing your budget to make this campaign live.",
    cardResumeDeposit: "Resume deposit",
    cardNotFunded: "Budget not deposited yet",
    cardNotFundedBody: "Finish the deposit to start tracking views.",
    cardBalanceLeft: "Balance left",
    cardRunningLow: "Running low",
    cardPaidToCreators: "Paid to creators",
    cardOfFunded: "of {amount} funded",
    cardClip: "Clip",
    cardClips: "Clips",
    cardLive: "Live",
    cardViews: "Views",
    cardRate: "Rate",
    cardPerView: "/ view",
    cardMax: "Max",
    cardPerClip: "/ clip",
    cardAddFunds: "Add funds",
    cardViewClips: "View clips →",

    clipsTitle: "Clips on {campaign}",
    clipsSubtitle:
      "Every clip submitted to your campaign, sorted by earnings. Download videos to repurpose them anywhere.",
    clipsEmpty: "No clips on this campaign yet.",
    clipsDownload: "Download video",
    clipsNoVideo: "No video file",
    clipsViewPost: "View post",
    clipsStatusPending: "Under review",
    clipsStatusTracking: "Live",
    clipsStatusRejected: "Rejected",
    clipsStatusPaused: "Paused",
    clipsStatusMaxed: "Max reached",
    clipsViews: "views",
    clipsEarned: "earned",
    clipsPaid: "paid",

    // Wizard — sections
    wizStep1: "Details",
    wizStep2: "Review & Fund",
    wizSectionPromoting: "What you're promoting",
    wizSectionBrief: "What you want creators to make",
    wizSectionMoney: "Money",
    wizSectionPreview: "Preview",
    wizSectionPreviewHint:
      "How your campaign will appear to creators. Updates as you type.",

    // Wizard — fields
    fldLanguage: "Language you'll write in",
    fldLanguageHint:
      "Pick the language you'll author the content in. We'll auto-translate to other supported languages so every creator sees the campaign in their own language.",
    fldProductName: "App name",
    fldProductNameHint:
      "Shown as the title both in the catalog and on the campaign page.",
    fldSlug: "URL slug",
    fldSlugHintIdle:
      "Lowercase letters, numbers, dashes. Used in the campaign URL.",
    fldSlugHintChecking: "Checking availability…",
    fldSlugHintAvailable: "✓ Available: clippa.fun/app/campaigns/{slug}",
    fldSlugHintTaken: "✗ Already taken — pick another",
    fldTagline: "Catalog tagline",
    fldTaglineHint:
      "One scannable line that appears under the app name in the catalog. 8–15 words.",
    fldAbout: "About this app",
    fldAboutHint:
      "A paragraph creators read on the campaign page before deciding to make a clip. What does the app do? Why do you want clips? What kind of clips win?",
    fldReferenceVideo: "Reference video (optional)",
    fldReferenceVideoHint:
      "If you have a clip that captures the tone you want, link it here.",
    fldScript: "Suggested video script",
    fldScriptHint:
      "The structure you'd love to see — hook, body, outro, dialogue cues. Creators read this on the campaign page as inspiration and can adapt it. Markdown: **bold** works.",
    fldRules: "Rules for clips",
    fldRulesHint:
      "Hard requirements. Clips that don't follow these get rejected. Be specific — e.g., 'must mention the URL on screen', 'do not use the word X'.",
    fldRatePerView: "Rate per view",
    fldRatePerViewHint: "$0.01 = $10 per 1,000 views.",
    fldMaxPerClip: "Max payout / clip",
    fldMaxPerClipHint:
      "Cap per individual clip — even a viral one stops here.",
    fldTotalBudget: "Total budget",
    fldTotalBudgetHint:
      "USDT you'll fund the escrow with now. You can top up later.",
    fldPlatforms: "Platforms",
    fldPlatformsHint: "Where can creators submit clips from?",
    fldPlatformsRequired: "Pick at least one platform.",

    wizBtnNext: "Next: Review & Fund",
    wizBtnReserving: "Reserving...",

    // Wizard — step 2 review
    reviewTermsTitle: "Terms",
    reviewProduct: "App",
    reviewSlug: "URL slug",
    reviewPlatforms: "Platforms",
    reviewTagline: "Catalog tagline",
    reviewRatePerView: "Rate / view",
    reviewMaxPerClip: "Max / clip",
    reviewTotalBudget: "Total budget",
    reviewPreviewTitle: "Creator-facing preview",
    reviewPreviewHint:
      "Exactly what creators will see once you fund this campaign.",

    // Wizard — step 2 fund
    fundTitle: "Deposit your budget",
    fundExplainer:
      "You'll confirm 3 quick steps from your wallet to put your money into the campaign and make it live. Your money stays in your control — Clippa never holds it for you.",
    fundAmount: "Deposit",
    fundGoesTo: "→ Available for clips",
    fundUsdtNote:
      "Paid in USDT (a digital dollar, 1 USDT = $1). 100% of this goes to your campaign budget today.",
    fundTxApprove: "Approve transfer",
    fundTxCreate: "Set up campaign",
    fundTxSend: "Send funds",
    fundBtnConfirm: "Confirm and launch",
    fundBtnConfirming: "Confirming...",
    fundBtnEdit: "Edit details",
    fundDoneTitle: "Campaign launched",
    fundDoneBody: "Your budget is in. Creators can now submit clips.",
    fundDoneReceipt: "View payment receipt",
    fundDoneCta: "Go to dashboard",

    // Resume page
    resumeLabel: "Resume funding",
    resumeNotFound: "Campaign not found",
    resumeNotFoundBody: "It may already be active, or doesn't belong to you.",
    resumeBack: "Back to dashboard",
    resumeNote:
      "We'll pick up from wherever the last attempt stopped — any step that already completed will be skipped automatically.",
    resumeDoneTitle: "Campaign is live",
    resumeBtnApproving: "Approving transfer...",
    resumeBtnCreating: "Setting up campaign...",
    resumeBtnFunding: "Sending funds...",
    resumeBtnFinalizing: "Finalizing...",
    resumeBtnIdle: "Resume deposit",
    resumeCancel: "Cancel",

    // Fund-more dialog
    addFundsTitle: "Add funds",
    addFundsSubtitle: "Top up {name}'s budget.",
    addFundsCurrent: "Current balance",
    addFundsLabel: "Amount to add (USD)",
    addFundsHint:
      "You'll confirm 1–2 quick steps from your wallet to send the deposit. Paid in USDT (a digital dollar, 1 USDT = $1).",
    addFundsApproving: "Approving transfer…",
    addFundsSending: "Sending funds…",
    addFundsBtnApproving: "Approving...",
    addFundsBtnSending: "Sending...",
    addFundsBtnIdleFilled: "Add {amount}",
    addFundsBtnIdle: "Add funds",
    addFundsDoneTitle: "Funds added",
    addFundsDoneBody: "{amount} added to your campaign budget.",
    addFundsDoneReceipt: "View payment receipt",

    // Errors
    errContractNotConfigured: "Contract address not configured.",
    errNoWallet: "No wallet found on your account.",
    errSigningCancelled: "Signing cancelled.",
    errInsufficientFunds: "Not enough USDT or CELO for gas.",

    // Markdown editor
    mdEdit: "Edit",
    mdPreview: "Preview",
    mdHint: "**bold** · line breaks preserved",
    mdHintWithCount: "**bold** · line breaks preserved · {count}/{max}",
    mdEmpty: "Nothing to preview yet.",

    // Campaign preview labels
    pvCatalog: "1. In the catalog",
    pvCatalogHint: "What creators see when browsing campaigns.",
    pvDetail: "2. On the campaign page",
    pvDetailHint: "What creators see after clicking your card.",
    pvAbout: "About",
    pvScript: "Script",
    pvRules: "Rules",
    pvScriptEmpty: "Your suggested video script will render here.",
    pvRulesEmpty: "Your rules for clips will render here.",
    pvBudgetLeft: "{amount} left",
    pvBudgetOf: "of {amount}",
    pvRatePerView: "${rate} / view",
    pvUpTo: "Up to {amount} per clip",
    pvPlaceholderProduct: "Your app name",
    pvPlaceholderShort: "Your one-line catalog tagline.",
    pvPlaceholderLong: "Your longer description goes here.",
    pvPerView: "Per view",
    pvMaxPerClip: "Max per clip",
  },
} as const;

// Loosen string-literal leaves to `string` so the Spanish dict can have
// different values while keeping the same shape.
type Loosen<T> = {
  [K in keyof T]: T[K] extends string ? string : Loosen<T[K]>;
};

export type Dict = Loosen<typeof en>;
export default en as Dict;
