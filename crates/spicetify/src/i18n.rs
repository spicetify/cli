use std::{collections::HashMap, sync::LazyLock};

use fluent_bundle::{FluentArgs, FluentResource, bundle::FluentBundle};
use fluent_langneg::{NegotiationStrategy, negotiate_languages};
use intl_memoizer::concurrent::IntlLangMemoizer;
use unic_langid::LanguageIdentifier;

type Bundle = FluentBundle<FluentResource, IntlLangMemoizer>;
type Bundles = HashMap<LanguageIdentifier, Bundle>;
type FallbackMap = HashMap<LanguageIdentifier, Vec<LanguageIdentifier>>;

fn raw_locales() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "en-US",
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/locales/en-US.ftl")),
        ),
        (
            "zh-Hans",
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/locales/zh-Hans.ftl")),
        ),
    ]
}

static BUNDLES: LazyLock<Bundles> = LazyLock::new(|| {
    let fallback: LanguageIdentifier = "en-US".parse().expect("valid langid");
    let mut bundles = Bundles::new();

    for (tag, ftl) in raw_locales() {
        let lang: LanguageIdentifier = match tag.parse() {
            Ok(id) => id,
            Err(_) => continue,
        };
        let resource = match FluentResource::try_new(ftl.to_owned()) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let mut bundle = Bundle::new_concurrent(vec![lang.clone(), fallback.clone()]);
        let _ = bundle.add_resource(resource);
        bundles.insert(lang, bundle);
    }

    bundles
});

static FALLBACKS: LazyLock<FallbackMap> = LazyLock::new(|| {
    let locales: Vec<LanguageIdentifier> = BUNDLES.keys().cloned().collect();
    let mut map = FallbackMap::new();

    for locale in &locales {
        let chain = negotiate_languages(&[locale], &locales, None, NegotiationStrategy::Filtering)
            .into_iter()
            .cloned()
            .collect();
        map.insert(locale.clone(), chain);
    }

    map
});

static USER_LOCALE: LazyLock<LanguageIdentifier> = LazyLock::new(|| {
    let raw = detect_locale();
    raw.parse()
        .unwrap_or_else(|_| "en-US".parse().expect("valid langid"))
});

pub fn lookup(key: &str) -> String {
    lookup_locale(&USER_LOCALE, key, &[]).unwrap_or_else(|| key.to_string())
}

pub fn lookup_with_args(key: &str, args: &[(&str, &str)]) -> String {
    lookup_locale(&USER_LOCALE, key, args).unwrap_or_else(|| key.to_string())
}

fn lookup_locale(locale: &LanguageIdentifier, key: &str, args: &[(&str, &str)]) -> Option<String> {
    let fallbacks = match FALLBACKS.get(locale) {
        Some(f) => f,
        None => {
            let available: Vec<&LanguageIdentifier> = BUNDLES.keys().collect();
            let best =
                negotiate_languages(&[locale], &available, None, NegotiationStrategy::Filtering);
            match best.first() {
                Some(lang) => match FALLBACKS.get(lang) {
                    Some(f) => f,
                    None => return None,
                },
                None => return None,
            }
        }
    };

    for lang in fallbacks {
        if let Some(result) = lookup_single(lang, key, args) {
            return Some(result);
        }
    }

    None
}

fn lookup_single(lang: &LanguageIdentifier, key: &str, args: &[(&str, &str)]) -> Option<String> {
    let bundle = BUNDLES.get(lang)?;
    let fluent_key = key.replace('_', "-");
    let pattern = bundle.get_message(&fluent_key)?.value()?;

    let fluent_args = if args.is_empty() {
        None
    } else {
        let mut fa = FluentArgs::new();
        for (name, value) in args {
            fa.set(*name, *value);
        }
        Some(fa)
    };

    let mut errors = vec![];
    Some(
        bundle
            .format_pattern(pattern, fluent_args.as_ref(), &mut errors)
            .into_owned(),
    )
}

fn detect_locale() -> String {
    #[cfg(windows)]
    {
        let locale = windows_locale();
        if !locale.is_empty() {
            return locale;
        }
    }
    #[cfg(unix)]
    {
        let locale = unix_locale();
        if !locale.is_empty() {
            return locale;
        }
    }
    "en-US".into()
}

#[cfg(windows)]
fn windows_locale() -> String {
    unsafe extern "system" {
        fn GetUserPreferredUILanguages(
            dwFlags: u32,
            pulNumLanguages: *mut u32,
            pwszLanguagesBuffer: *mut u16,
            pcchLanguagesBuffer: *mut u32,
        ) -> i32;
    }
    const MUI_LANGUAGE_NAME: u32 = 0x8;
    let mut num_langs: u32 = 0;
    let mut buf_size: u32 = 0;
    let ok = unsafe {
        GetUserPreferredUILanguages(
            MUI_LANGUAGE_NAME,
            &mut num_langs,
            std::ptr::null_mut(),
            &mut buf_size,
        )
    };
    if ok == 0 || buf_size == 0 {
        return String::new();
    }
    let mut buf = vec![0u16; buf_size as usize];
    let ok = unsafe {
        GetUserPreferredUILanguages(
            MUI_LANGUAGE_NAME,
            &mut num_langs,
            buf.as_mut_ptr(),
            &mut buf_size,
        )
    };
    if ok == 0 {
        return String::new();
    }
    let first = buf.split(|&c| c == 0).next().unwrap_or(&[]);
    String::from_utf16_lossy(first)
}

#[cfg(unix)]
fn unix_locale() -> String {
    std::env::var("LC_ALL")
        .or_else(|_| std::env::var("LC_MESSAGES"))
        .or_else(|_| std::env::var("LANG"))
        .unwrap_or_default()
        .split('.')
        .next()
        .unwrap_or("")
        .replace('_', "-")
}
