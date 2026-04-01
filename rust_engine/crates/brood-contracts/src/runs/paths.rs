use std::path::{Path, PathBuf};

pub const CANONICAL_RUNS_DIR_NAME: &str = "cue_runs";
pub const LEGACY_RUNS_DIR_NAME: &str = "brood_runs";
pub const SESSION_DOCUMENT_FILENAME: &str = "session.json";
pub const LEGACY_SESSION_DOCUMENT_FILENAME: &str = "juggernaut-session.json";
pub const TIMELINE_DOCUMENT_FILENAME: &str = "session-timeline.json";
pub const EVENTS_FILENAME: &str = "events.jsonl";
pub const INPUTS_DIRNAME: &str = "inputs";
pub const ARTIFACTS_DIRNAME: &str = "artifacts";
pub const RECEIPTS_DIRNAME: &str = "receipts";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunPaths {
    pub run_id: String,
    pub run_dir: PathBuf,
}

impl RunPaths {
    pub fn new(run_id: impl Into<String>, run_dir: impl Into<PathBuf>) -> Self {
        Self {
            run_id: run_id.into(),
            run_dir: run_dir.into(),
        }
    }

    pub fn from_home(home_dir: impl AsRef<Path>, run_id: impl Into<String>) -> Self {
        let run_id = run_id.into();
        let run_dir = canonical_runs_root(home_dir.as_ref()).join(&run_id);
        Self { run_id, run_dir }
    }

    pub fn session_path(&self) -> PathBuf {
        self.run_dir.join(SESSION_DOCUMENT_FILENAME)
    }

    pub fn legacy_session_path(&self) -> PathBuf {
        self.run_dir.join(LEGACY_SESSION_DOCUMENT_FILENAME)
    }

    pub fn timeline_path(&self) -> PathBuf {
        self.run_dir.join(TIMELINE_DOCUMENT_FILENAME)
    }

    pub fn events_path(&self) -> PathBuf {
        self.run_dir.join(EVENTS_FILENAME)
    }

    pub fn inputs_dir(&self) -> PathBuf {
        self.run_dir.join(INPUTS_DIRNAME)
    }

    pub fn artifacts_dir(&self) -> PathBuf {
        self.run_dir.join(ARTIFACTS_DIRNAME)
    }

    pub fn receipts_dir(&self) -> PathBuf {
        self.run_dir.join(RECEIPTS_DIRNAME)
    }
}

pub fn canonical_runs_root(home_dir: &Path) -> PathBuf {
    home_dir.join(CANONICAL_RUNS_DIR_NAME)
}

pub fn legacy_runs_root(home_dir: &Path) -> PathBuf {
    home_dir.join(LEGACY_RUNS_DIR_NAME)
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        canonical_runs_root, legacy_runs_root, RunPaths, ARTIFACTS_DIRNAME,
        LEGACY_SESSION_DOCUMENT_FILENAME, RECEIPTS_DIRNAME, SESSION_DOCUMENT_FILENAME,
        TIMELINE_DOCUMENT_FILENAME,
    };

    #[test]
    fn run_paths_use_canonical_layout() {
        let home = Path::new("/Users/tester");
        let paths = RunPaths::from_home(home, "run-123");

        assert_eq!(paths.run_dir, canonical_runs_root(home).join("run-123"));
        assert_eq!(
            paths.session_path(),
            paths.run_dir.join(SESSION_DOCUMENT_FILENAME)
        );
        assert_eq!(
            paths.legacy_session_path(),
            paths.run_dir.join(LEGACY_SESSION_DOCUMENT_FILENAME)
        );
        assert_eq!(
            paths.timeline_path(),
            paths.run_dir.join(TIMELINE_DOCUMENT_FILENAME)
        );
        assert_eq!(paths.artifacts_dir(), paths.run_dir.join(ARTIFACTS_DIRNAME));
        assert_eq!(paths.receipts_dir(), paths.run_dir.join(RECEIPTS_DIRNAME));
    }

    #[test]
    fn legacy_runs_root_stays_read_only_import_source() {
        let home = Path::new("/Users/tester");
        assert_eq!(legacy_runs_root(home), home.join("brood_runs"));
    }
}
