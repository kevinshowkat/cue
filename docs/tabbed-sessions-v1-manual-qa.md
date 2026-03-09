# Tabbed Sessions v1 Manual QA

1. New Run preserves the current tab
   Start with an image loaded in Tab A. Trigger `New Run`. Confirm a new tab appears and becomes active. Switch back to Tab A and confirm the original image, selection, and canvas framing are unchanged.

2. Open Run creates a new tab
   With Tab A still open, trigger `Open Run` and pick an existing run folder. Confirm the selected run opens in a separate tab instead of replacing Tab A.

3. Switching tabs restores different session state
   Put clearly different content in two tabs, including different active images or viewport positions. Switch back and forth. Confirm each tab restores its own image/session state instead of sharing the active canvas state.

4. Closing an inactive tab only removes that shell session
   Close a non-active tab from the tab strip. Confirm the active tab stays active and responsive, and confirm the closed tab's run directory still exists on disk.

5. Busy active tab switching is blocked in the current v1 contract
   Start a run state that keeps the active tab busy, such as an in-flight engine action or draft mutation. Try switching tabs. Confirm the app blocks the switch and shows the busy-state guidance toast instead of swapping tabs immediately.

6. Inactive tabs do not keep live engine or event attachment
   Leave one tab idle in the background after switching away from it. Confirm only the active tab continues polling or showing live engine-driven updates, and confirm the inactive tab resumes correctly only when reactivated.

7. Blank-tab import reuses the current tab
   Start from a newly created blank tab with no run content yet. Import one image by picker or drag-drop. Confirm the image lands in the current tab and no extra tab appears during run provisioning.

8. Rapid switching across three populated tabs stays at three tabs
   Load a distinct image in each of three tabs. Click across the tab strip quickly several times. Confirm the tab count stays fixed at three, the visible canvas swaps immediately on click, and no new run directory is created just from switching.

9. Open-run hydration does not bleed into the wrong active tab
   Open an existing run in a new tab, then immediately switch back to another populated tab before the opened run finishes restoring artifacts or intent state. Confirm the previously active tab keeps its own image, quick actions, and status text, and confirm late hydration only affects the opened tab when you return to it.
