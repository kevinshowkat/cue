#![allow(dead_code, unused_imports)]

#[path = "../src/realtime/mod.rs"]
mod realtime;

use std::path::PathBuf;

use realtime::{RealtimeCommand, RealtimeSessionKind, RealtimeSnapshotJob};

#[test]
fn realtime_session_descriptor_exposes_expected_metadata() {
    let canvas = RealtimeSessionKind::CanvasContext.descriptor();
    assert_eq!(canvas.event_type, "canvas_context");
    assert_eq!(canvas.failed_event_type, "canvas_context_failed");
    assert_eq!(
        canvas.provider_env_key,
        "CUE_CANVAS_CONTEXT_REALTIME_PROVIDER"
    );
    assert_eq!(canvas.thread_name, "cue-aov-realtime");
    assert_eq!(canvas.max_output_tokens, 520);

    let mother = RealtimeSessionKind::IntentIcons { mother: true }.descriptor();
    assert_eq!(mother.event_type, "intent_icons");
    assert_eq!(
        mother.provider_env_key,
        "CUE_MOTHER_INTENT_REALTIME_PROVIDER"
    );
    assert_eq!(mother.disabled_env_key, "CUE_INTENT_REALTIME_DISABLED");
    assert_eq!(mother.thread_name, "cue-intent-realtime-mother");
    assert_eq!(mother.max_output_tokens, 2200);
}

#[test]
fn realtime_session_select_job_prefers_latest_canvas_and_mother_intent_snapshot() {
    let first = RealtimeSnapshotJob::new("intent-ambient-001.png", 10);
    let mother = RealtimeSnapshotJob::new("mother-intent-002.png", 11);
    let last = RealtimeSnapshotJob::new("intent-ambient-003.png", 12);
    let jobs = vec![first.clone(), mother.clone(), last.clone()];

    let canvas = RealtimeSessionKind::CanvasContext
        .select_job(&jobs)
        .expect("canvas should select last job");
    assert_eq!(canvas, last);

    let intent = RealtimeSessionKind::IntentIcons { mother: true }
        .select_job(&jobs)
        .expect("intent should prefer mother snapshot");
    assert_eq!(intent, mother);
}

#[test]
fn realtime_snapshot_command_preserves_typed_path() {
    let job = RealtimeSnapshotJob::new(PathBuf::from("frames/example.png"), 42);
    let command = RealtimeCommand::Snapshot(job.clone());

    match command {
        RealtimeCommand::Snapshot(snapshot) => {
            assert_eq!(snapshot.image_path, PathBuf::from("frames/example.png"));
            assert_eq!(snapshot.submitted_at_ms, 42);
        }
        RealtimeCommand::Stop => panic!("expected snapshot command"),
    }
}
