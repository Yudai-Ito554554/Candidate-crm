fn main() {
    let app_manifest = tauri_build::AppManifest::new().commands(&[
        "extract_candidate_pdf_text",
        "secure_credential_set",
        "secure_credential_get",
        "secure_credential_delete",
    ]);

    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(app_manifest))
        .expect("failed to run Tauri build script");
}
