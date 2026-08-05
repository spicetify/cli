use std::sync::LazyLock;

// used i18n_embed as thats what cosmic de does
use i18n_embed::fluent::{FluentLanguageLoader, fluent_language_loader};
use i18n_embed::{DefaultLocalizer, LanguageLoader, Localizer};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "$CARGO_MANIFEST_DIR/../../i18n"]
struct Localizations;

pub static LANGUAGE_LOADER: LazyLock<FluentLanguageLoader> = LazyLock::new(|| {
    let loader: FluentLanguageLoader = fluent_language_loader!();

    loader.load_fallback_language(&Localizations).expect("Error while loading fallback language");

    loader
});

#[macro_export]
macro_rules! fl {
    ($message_id:literal $(, $key:ident = $value:expr)* $(,)?) => {{
        $crate::i18n_embed_fl::fl!($crate::locale::LANGUAGE_LOADER, $message_id $(, $key = $value)*)
    }};
}

fn localizer() -> Box<dyn Localizer> {
    Box::from(DefaultLocalizer::new(&*LANGUAGE_LOADER, &Localizations))
}

pub fn localize() {
    let localizer = localizer();
    let requested_languages = i18n_embed::DesktopLanguageRequester::requested_languages();

    if let Err(error) = localizer.select(&requested_languages) {
        eprintln!("Error while loading language for Spicetify {error}");
    }
}
