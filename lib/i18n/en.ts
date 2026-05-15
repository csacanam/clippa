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
      "Short videos for products on Instagram or TikTok. Drop the link. Earn for every view.",
    cta: "Start earning →",
    footer: "Built for creators worldwide. Payments anywhere.",
    statsCreators: "Creators",
    statsClipsPosted: "Clips posted",
    statsPaymentsSent: "Payments sent",
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
    submitButton: "Submit clip →",
    submitting: "Verifying...",
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
    title: "Got questions? Join the community",
    subtitle:
      "Tips, help, and other creators — all on Telegram. We're around if anything breaks or you need a hand.",
    cta: "Join on Telegram →",
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
} as const;

// Loosen string-literal leaves to `string` so the Spanish dict can have
// different values while keeping the same shape.
type Loosen<T> = {
  [K in keyof T]: T[K] extends string ? string : Loosen<T[K]>;
};

export type Dict = Loosen<typeof en>;
export default en as Dict;
