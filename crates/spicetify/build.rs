use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=../../../.git/logs/HEAD");
    println!("cargo:rerun-if-env-changed=GITHUB_RUN_NUMBER");
    println!("cargo:rerun-if-env-changed=SPICETIFY_COMMIT_SHA");

    let git_sha = std::env::var("SPICETIFY_COMMIT_SHA").ok().or_else(|| {
        Command::new("git")
            .args(["rev-parse", "HEAD"])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    let sha = String::from_utf8_lossy(&output.stdout);
                    Some(sha.trim().to_string())
                } else {
                    None
                }
            })
    });

    if let Some(ref sha) = git_sha {
        println!("cargo:rustc-env=SPICETIFY_COMMIT_SHA={sha}");

        if let Some(build_id) = option_env!("GITHUB_RUN_NUMBER") {
            println!("cargo:rustc-env=SPICETIFY_BUILD_ID={build_id}");
        }
    }
}
