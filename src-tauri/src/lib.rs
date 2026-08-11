const MAX_CANDIDATE_PDF_BYTES: usize = 5 * 1024 * 1024;

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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![extract_candidate_pdf_text])
        .run(tauri::generate_context!())
        .expect("error while running Candidate CRM");
}
