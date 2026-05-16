-- Featured clips on the landing.
--
-- The public landing's social-proof carousel plays muted-loop videos
-- (bounty.app style) rather than static thumbnails. We can't legally
-- re-host videos pulled from IG/TT, so the admin manually curates a
-- handful: download/trim the clip themselves, host it somewhere
-- (Supabase Storage, Cloudinary, any CDN), and paste the URL here.
--
-- NULL = not featured. Set to a video URL to surface the clip on /.

alter table clips
  add column if not exists featured_video_url text;

create index if not exists clips_featured_idx
  on clips (earnings_usd desc)
  where featured_video_url is not null;
