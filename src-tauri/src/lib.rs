use std::sync::Mutex;

const MAX_CANDIDATE_PDF_BYTES: usize = 5 * 1024 * 1024;
const SUPABASE_REFRESH_TOKEN_KEY: &str = "supabase-refresh-token";
const PRODUCTION_CREDENTIAL_SERVICE: &str = "com.candidatecrm.desktop.production";
const STAGING_CREDENTIAL_SERVICE: &str = "com.candidatecrm.desktop.staging";
static CREDENTIAL_OPERATION_LOCK: Mutex<()> = Mutex::new(());

trait CredentialStore {
    fn set(&self, service: &str, account: &str, value: &str) -> Result<(), String>;
    fn get(&self, service: &str, account: &str) -> Result<Option<String>, String>;
    fn delete(&self, service: &str, account: &str) -> Result<(), String>;
}

struct NativeCredentialStore;

fn keyring_error_kind(error: &keyring::Error) -> &'static str {
    match error {
        keyring::Error::PlatformFailure(_) => "platform_failure",
        keyring::Error::NoStorageAccess(_) => "storage_access_denied",
        keyring::Error::NoEntry => "not_found",
        keyring::Error::BadEncoding(_) => "bad_encoding",
        keyring::Error::TooLong(_, _) => "value_too_long",
        keyring::Error::Invalid(_, _) => "invalid_attribute",
        keyring::Error::Ambiguous(_) => "ambiguous_entry",
        _ => "unknown_keyring_error",
    }
}

impl CredentialStore for NativeCredentialStore {
    fn set(&self, service: &str, account: &str, value: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(service, account)
            .map_err(|error| keyring_error_kind(&error).to_string())?;
        entry
            .set_password(value)
            .map_err(|error| keyring_error_kind(&error).to_string())
    }

    fn get(&self, service: &str, account: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(service, account)
            .map_err(|error| keyring_error_kind(&error).to_string())?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(keyring_error_kind(&error).to_string()),
        }
    }

    fn delete(&self, service: &str, account: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(service, account)
            .map_err(|error| keyring_error_kind(&error).to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(keyring_error_kind(&error).to_string()),
        }
    }
}

fn validate_credential_key(key: &str) -> Result<(), String> {
    if key == SUPABASE_REFRESH_TOKEN_KEY {
        Ok(())
    } else {
        Err("credential_key_not_allowed".to_string())
    }
}

fn credential_service(identifier: &str) -> Result<&'static str, String> {
    match identifier {
        "com.candidatecrm.desktop" => Ok(PRODUCTION_CREDENTIAL_SERVICE),
        "com.candidatecrm.desktop.staging" => Ok(STAGING_CREDENTIAL_SERVICE),
        _ => Err("credential_service_not_allowed".to_string()),
    }
}

fn with_credential_lock<T>(operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let _guard = CREDENTIAL_OPERATION_LOCK
        .lock()
        .map_err(|_| "credential_store_lock_failed".to_string())?;
    operation()
}

fn secure_credential_set_with_store(
    store: &dyn CredentialStore,
    identifier: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    validate_credential_key(key)?;
    let service = credential_service(identifier)?;
    store.set(service, key, value)
}

fn secure_credential_get_with_store(
    store: &dyn CredentialStore,
    identifier: &str,
    key: &str,
) -> Result<Option<String>, String> {
    validate_credential_key(key)?;
    let service = credential_service(identifier)?;
    store.get(service, key)
}

fn secure_credential_delete_with_store(
    store: &dyn CredentialStore,
    identifier: &str,
    key: &str,
) -> Result<(), String> {
    validate_credential_key(key)?;
    let service = credential_service(identifier)?;
    store.delete(service, key)
}

#[tauri::command]
async fn secure_credential_set(
    app: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    let identifier = app.config().identifier.clone();
    tauri::async_runtime::spawn_blocking(move || {
        with_credential_lock(|| {
            secure_credential_set_with_store(&NativeCredentialStore, &identifier, &key, &value)
        })
    })
    .await
    .map_err(|_| "credential_task_failed".to_string())?
}

#[tauri::command]
async fn secure_credential_get(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<String>, String> {
    let identifier = app.config().identifier.clone();
    tauri::async_runtime::spawn_blocking(move || {
        with_credential_lock(|| {
            secure_credential_get_with_store(&NativeCredentialStore, &identifier, &key)
        })
    })
    .await
    .map_err(|_| "credential_task_failed".to_string())?
}

#[tauri::command]
async fn secure_credential_delete(
    app: tauri::AppHandle,
    key: String,
) -> Result<(), String> {
    let identifier = app.config().identifier.clone();
    tauri::async_runtime::spawn_blocking(move || {
        with_credential_lock(|| {
            secure_credential_delete_with_store(&NativeCredentialStore, &identifier, &key)
        })
    })
    .await
    .map_err(|_| "credential_task_failed".to_string())?
}

#[tauri::command]
fn extract_candidate_pdf_text(bytes: Vec<u8>) -> Result<String, String> {
    if bytes.is_empty() || bytes.len() > MAX_CANDIDATE_PDF_BYTES {
        return Err("PDFは5MB以内にしてください。".to_string());
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err("正しいPDFファイルを選択してください。".to_string());
    }
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|_| "PDFから文字を抽出できませんでした。".to_string())?;
    if text.trim().len() < 10 {
        return Err(
            "文字を読み取れませんでした。画像だけのPDFはテキスト化してからお試しください。"
                .to_string(),
        );
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[derive(Default)]
    struct TestCredentialStore {
        values: Mutex<HashMap<(String, String), String>>,
    }

    impl CredentialStore for TestCredentialStore {
        fn set(&self, service: &str, account: &str, value: &str) -> Result<(), String> {
            self.values.lock().unwrap().insert(
                (service.to_string(), account.to_string()),
                value.to_string(),
            );
            Ok(())
        }

        fn get(&self, service: &str, account: &str) -> Result<Option<String>, String> {
            Ok(self
                .values
                .lock()
                .unwrap()
                .get(&(service.to_string(), account.to_string()))
                .cloned())
        }

        fn delete(&self, service: &str, account: &str) -> Result<(), String> {
            self.values
                .lock()
                .unwrap()
                .remove(&(service.to_string(), account.to_string()));
            Ok(())
        }
    }

    #[test]
    fn candidate_pdf_rejects_empty_and_non_pdf_input() {
        assert!(extract_candidate_pdf_text(Vec::new()).is_err());
        assert!(extract_candidate_pdf_text(b"not a pdf document".to_vec()).is_err());
    }

    #[test]
    fn candidate_pdf_rejects_oversized_input() {
        let mut bytes = vec![0; MAX_CANDIDATE_PDF_BYTES + 1];
        bytes[..5].copy_from_slice(b"%PDF-");
        assert_eq!(
            extract_candidate_pdf_text(bytes),
            Err("PDFは5MB以内にしてください。".to_string())
        );
    }

    #[test]
    fn credential_store_sets_gets_and_deletes_refresh_token() {
        let store = TestCredentialStore::default();

        secure_credential_set_with_store(
            &store,
            "com.candidatecrm.desktop.staging",
            SUPABASE_REFRESH_TOKEN_KEY,
            "refresh-token-value",
        )
        .unwrap();
        assert_eq!(
            secure_credential_get_with_store(
                &store,
                "com.candidatecrm.desktop.staging",
                SUPABASE_REFRESH_TOKEN_KEY,
            )
            .unwrap(),
            Some("refresh-token-value".to_string())
        );

        secure_credential_delete_with_store(
            &store,
            "com.candidatecrm.desktop.staging",
            SUPABASE_REFRESH_TOKEN_KEY,
        )
        .unwrap();
        assert_eq!(
            secure_credential_get_with_store(
                &store,
                "com.candidatecrm.desktop.staging",
                SUPABASE_REFRESH_TOKEN_KEY,
            )
            .unwrap(),
            None
        );
    }

    #[test]
    fn credential_store_rejects_unknown_keys_and_identifiers() {
        let store = TestCredentialStore::default();

        assert_eq!(
            secure_credential_set_with_store(
                &store,
                "com.candidatecrm.desktop.staging",
                "arbitrary-secret",
                "value",
            ),
            Err("credential_key_not_allowed".to_string())
        );
        assert_eq!(
            secure_credential_get_with_store(
                &store,
                "com.candidatecrm.desktop.preview",
                SUPABASE_REFRESH_TOKEN_KEY,
            ),
            Err("credential_service_not_allowed".to_string())
        );
    }

    #[test]
    fn credential_services_are_separated_by_build_identifier() {
        assert_eq!(
            credential_service("com.candidatecrm.desktop").unwrap(),
            PRODUCTION_CREDENTIAL_SERVICE
        );
        assert_eq!(
            credential_service("com.candidatecrm.desktop.staging").unwrap(),
            STAGING_CREDENTIAL_SERVICE
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            extract_candidate_pdf_text,
            secure_credential_set,
            secure_credential_get,
            secure_credential_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running Candidate CRM");
}
