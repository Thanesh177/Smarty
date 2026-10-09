# Video topic and uploads

## Delivered

- `/feed?topic=Video` (also `Videos` / `Reels`) opens a vertically snapping video viewer. The Video view appears in the topic picker, topic directory, and all-posts navigation.
- It includes public video posts from every subject, not just posts tagged Video. Text-only, private, pending moderation, removed, and deleted posts are excluded.
- `/create?topic=Video&type=video` opens the existing authenticated uploader in video mode. A headline and a playable attachment are required; the caption is optional. Existing text drafts are preserved.
- Existing `/getUploadUrl`, signed PUT upload, and `/createReel` contracts are reused. Videos remain ordinary posts with `videoUrl` / `videoKey`, preserving profile, saved, comments, and moderation compatibility. No additional video service, secret, or infrastructure has been provisioned.
- Only the active video attempts playback. Only it and its immediate neighbours have video elements; distant players release their decoders when detached. Playback pauses on navigation, document hiding, and safety dialogs.
- Playback starts muted; autoplay refusal exposes a manual play button. Reduced-motion users start videos manually. Controls include sound, play/pause, seeking, fullscreen, captions/description, saved state, comments, creator profiles, and reporting/blocking.
- Native scrolling and CSS snap handle movement, without scroll-driven animation loops or a new animation dependency. Phone controls remain clear of the existing floating navigation rail.
- The existing server returns a mixed-post feed. Discovery scans are limited to three consecutive pages without new videos, with explicit older-video loading afterward. A repeated cursor cannot cause an infinite background fetch.
- Video is a feed format, not an exam subject; quiz subjects remain unchanged.

## Verification and rollout

1. Run `npm test` and a production build.
2. Use a staging account to upload a public H.264/AAC MP4. Confirm the signed PUT completes and the post response/feed resolves the stored key to a playable URL. The composer also accepts MOV/WebM if the current device can preview them; there is no automatic transcoding.
3. On physical iPhone, iPad, and Android devices, verify inline playback, sound after a gesture, swipe navigation, seeking, fullscreen, app background/foreground, interrupted upload retry, and save/comments/profile links.
4. Confirm the media host serves the correct MIME type and byte-range responses. Confirm upload CORS allows the deployed app origin and the signed PUT `Content-Type`. These existing cloud integrations have not been changed or live-tested by this UI change.
5. Upload a private video and verify it stays off the public Video view. Report another account's video, then block that creator; verify removal in Video and the other feeds, including after reopening.
6. Test a broken media URL and an unsupported codec. Verify the error/retry UI, without a route crash or app reload. Test reduced motion with manual play and low-data/slow connections.
7. Test an archive containing several pages with no videos and a failed next-page request. Loading remains bounded and manual retry keeps already loaded videos.
8. Deploy the web build through the existing release workflow. This change does not itself deploy the website or a native build.

## Scaling follow-up

For a large video archive, add a server-side media-type index/filter using the same moderation and blocked-creator rules. Do not silently treat a client-side filter as a server video index. Add transcoding/poster generation and content review if uploads grow beyond the existing direct-upload workflow.
