-- Allow campaigns to live in a pre-funded "draft" state.
--
-- When a brand fills the wizard, we insert a row immediately so the slug
-- is reserved. The status starts as 'pending_funding' and is flipped to
-- 'active' once the on-chain funding txs succeed. If the brand bails
-- mid-signing, the row stays pending and can be resumed from /brand.
--
-- listActiveCampaigns already filters `status='active'`, so pending rows
-- never leak to creators.

alter table campaigns drop constraint if exists campaigns_status_check;

alter table campaigns
  add constraint campaigns_status_check
  check (status in ('pending_funding', 'active', 'paused', 'ended'));
