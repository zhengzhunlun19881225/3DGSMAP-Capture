# Capture 0.2.7 / build 9

## Evidence and scope

The supplied 0.2.6/build 8 report identifies a FRONTBOARD `0x8BADF00D`
scene-update watchdog termination with a 10-second deadline. The sampled main
thread was laying out SwiftUI list rows and measuring/truncating text. Thermal
state was `serious`. This establishes an unresponsive UI termination, not a
Jetsam out-of-memory diagnosis. The sample does not establish a unique source
line or prove that checksum calculation caused that termination.

This update targets the Capture client. It does not replace the Windows training
installation, restart training, change existing project indexes, or delete media.

## Changes

- Batch details use a lazy scrolling layout and simpler media rows. Frequent
  byte progress updates belong to a separate observable object and view, not
  the full batch list.
- Hashing and chunk reads execute on a dedicated actor outside MainActor.
  Each hash iteration drains temporary Foundation objects; buffers are 4 MiB.
  Progress is throttled to 250 ms during scanning/transmission, with file-boundary
  updates. Cancellation is checked between blocks and before submitting work.
- Completed per-file SHA-256 results are atomically cached under Library/Caches,
  separately from originals and projects.json. Filename, size, modification time
  and inode must match before reuse. Changed originals are rejected before
  reading upload chunks. An interrupted file is rehashed; completed files are reused.
- Retry checks for an existing server job before hashing. An accepted/preparing
  batch is polled without submitting a duplicate training request. Uncertain
  submissions remain explicit errors requiring computer-side review.
- Upload percentages count only server-confirmed chunks, including resumed ones.
  Local checksum completion is distinct from upload completion and job acceptance.
- Preview/balanced/quality labels and the repository's profile configuration
  use 15,000/30,000/45,000 steps. The server remains authoritative.

## Windows integration status

The separately maintained Windows checkout has an authenticated mobile gateway
on port 8788, with the existing training API on 8787. Its local desktop intake
panel polls receipts every five seconds and shows upload bytes, verification,
preprocessing, job status and result links. This client uses the same v1 protocol.

The Windows gateway must run under the user's Windows account, with a narrowly
scoped private-LAN firewall allowance. Running it as CodexSandboxOffline blocks
LAN inbound requests even when loopback health succeeds. Do not disable sandbox
isolation rules. Keep keys local; never commit runtime/mobile-gateway.json.

The Capture repository still does not bundle that Windows gateway or the latest
training frontend. Its older desktop code is not a replacement for the active
Windows installation. No live phone-video-to-PLY completion is claimed here.

## Verification and installation

`Validate iOS capture` builds the simulator application and runs checksum/chunk,
cache, cancellation, capture-flow and project-deletion regressions on macOS.
Windows cannot build or sign the iOS app. Inspect the workflow result for the
specific commit before installing; a simulator build does not verify the device
watchdog issue.

On the Mac, open ios/GSMapCapture.xcodeproj and install over the existing app using
the same Team and Bundle Identifier. Do not uninstall; originals live inside the
app's storage. Confirm the installed build is 9.

Device acceptance still required:

1. On a cooled iPhone, open a batch containing multiple long 4K clips; test large
   Dynamic Type, scrolling and entering/leaving the page. Capture Instruments
   main-thread activity and memory, not only whether the app stays open.
2. Verify checksum bytes advance, the screen responds and progress stays bounded.
3. Pause during hashing; retry and confirm completed files reuse their checksums.
4. Disconnect Wi-Fi during a chunk, retry, and confirm received bytes are not
   counted twice. Background the app and verify it pauses cleanly.
5. Retry after the computer starts preprocessing; verify the same job is recovered.
6. Observe the desktop intake panel, final training job and generated PLY.
7. Reproduce the original watchdog scenario under Instruments; record whether it
   is resolved. Do not describe layout changes alone as a proven crash fix.
