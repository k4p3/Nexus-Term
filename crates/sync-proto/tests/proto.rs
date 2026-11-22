use nexus_sync_proto::bundle::KeyBundle;
use nexus_sync_proto::envelope::{Envelope, MAX_PLAINTEXT};
use nexus_sync_proto::keys::{Auk, KdfParams, RecoveryKey, SecretKey};
use nexus_sync_proto::kit::{emergency_kit, Lang};
use nexus_sync_proto::{Error, Key};

fn cheap() -> KdfParams {
    KdfParams::with_cost(8, 1, 1)
}

// ---------- sobre ----------
#[test]
fn envelope_round_trip() {
    let k = Key::generate();
    let e = Envelope::seal(&k, "host", "h1", 3, "2026-01-01T00:00:00Z", br#"{"hostname":"srv.internal"}"#).unwrap();
    assert_eq!(e.open(&k).unwrap(), br#"{"hostname":"srv.internal"}"#);
}

#[test]
fn envelope_has_no_plaintext() {
    let k = Key::generate();
    let e = Envelope::seal(&k, "host", "h1", 1, "t", br#"{"hostname":"secret-host.lan","user":"root"}"#).unwrap();
    let json = serde_json::to_string(&e).unwrap();
    assert!(!json.contains("secret-host") && !json.contains("root"));
}

#[test]
fn envelope_detects_tampering_in_every_field() {
    let k = Key::generate();
    let e = Envelope::seal(&k, "host", "h1", 1, "t", b"data").unwrap();
    let mut a = e.clone();
    a.kind = "snippet".into();
    let mut b = e.clone();
    b.id = "h2".into();
    let mut c = e.clone();
    c.rev = 2;
    let mut d = e.clone();
    d.deleted = true;
    let mut f = e.clone();
    f.ct = format!("{}A", &e.ct[..e.ct.len() - 1]);
    let mut g = e.clone();
    g.n = Envelope::seal(&k, "host", "h1", 1, "t", b"x").unwrap().n;
    for t in [a, b, c, d, f, g] {
        assert!(t.open(&k).is_err());
    }
    assert!(e.open(&Key::generate()).is_err());
}

#[test]
fn envelope_rejects_unknown_version_and_algorithm() {
    let k = Key::generate();
    let mut e = Envelope::seal(&k, "host", "h1", 1, "t", b"data").unwrap();
    e.v = 2;
    assert_eq!(e.open(&k), Err(Error::Unsupported));
    let mut e = Envelope::seal(&k, "host", "h1", 1, "t", b"data").unwrap();
    e.alg = "XCHACHA".into();
    assert_eq!(e.open(&k), Err(Error::Unsupported));
}

#[test]
fn envelope_tombstone_is_authenticated_and_empty() {
    let k = Key::generate();
    let t = Envelope::seal_tombstone(&k, "host", "h1", 4, "t").unwrap();
    assert!(t.deleted);
    assert_eq!(t.open(&k).unwrap(), b"");
    // El servidor no puede convertir un registro vivo en tombstone.
    let mut forged = Envelope::seal(&k, "host", "h1", 4, "t", b"data").unwrap();
    forged.deleted = true;
    assert!(forged.open(&k).is_err());
}

#[test]
fn envelope_enforces_size_limit() {
    let k = Key::generate();
    assert_eq!(Envelope::seal(&k, "host", "h", 1, "t", &vec![0u8; MAX_PLAINTEXT + 1]), Err(Error::TooLarge));
    assert!(Envelope::seal(&k, "host", "h", 1, "t", &vec![0u8; MAX_PLAINTEXT]).is_ok());
}

#[test]
fn envelope_nonces_are_unique() {
    let k = Key::generate();
    let a = Envelope::seal(&k, "host", "h", 1, "t", b"x").unwrap();
    let b = Envelope::seal(&k, "host", "h", 1, "t", b"x").unwrap();
    assert_ne!(a.n, b.n);
}

// ---------- claves ----------
#[test]
fn secret_key_format_and_checksum() {
    let s = SecretKey::generate();
    let text = s.to_display();
    assert!(text.starts_with("NXT1-"));
    assert_eq!(SecretKey::parse(&text).unwrap().0, s.0);
    // tolerante a minúsculas, espacios y guiones
    let sloppy = text.to_lowercase().replace('-', " ");
    assert_eq!(SecretKey::parse(&sloppy).unwrap().0, s.0);
    // una errata se detecta por la suma antes de derivar nada
    let mut chars: Vec<char> = text.chars().collect();
    let i = chars.len() - 3;
    chars[i] = if chars[i] == 'A' { 'B' } else { 'A' };
    let bad: String = chars.into_iter().collect();
    assert!(matches!(SecretKey::parse(&bad), Err(Error::BadChecksum) | Err(Error::BadFormat)));
    assert!(SecretKey::parse("NXR1-AAAAA").is_err());
}

#[test]
fn recovery_key_format_and_checksum() {
    let r = RecoveryKey::generate();
    let text = r.to_display();
    assert!(text.starts_with("NXR1-"));
    assert_eq!(RecoveryKey::parse(&text).unwrap().0, r.0);
    assert!(SecretKey::parse(&text).is_err()); // prefijo distinto
    let mut bad = text.clone();
    bad.pop();
    bad.push(if text.ends_with('A') { 'B' } else { 'A' });
    assert!(RecoveryKey::parse(&bad).is_err());
}

#[test]
fn derivation_is_deterministic_and_keys_are_independent() {
    let s = SecretKey([7u8; 16]);
    let kdf = cheap();
    let a = Auk::derive("pw", &s, &kdf).unwrap();
    let b = Auk::derive("pw", &s, &kdf).unwrap();
    assert_eq!(a.auth_key().unwrap(), b.auth_key().unwrap());
    assert_eq!(a.wrap_key().unwrap(), b.wrap_key().unwrap());
    assert_ne!(a.auth_key().unwrap(), a.wrap_key().unwrap());
    assert_ne!(Auk::derive("other", &s, &kdf).unwrap().wrap_key().unwrap(), a.wrap_key().unwrap());
    assert_ne!(Auk::derive("pw", &SecretKey([8u8; 16]), &kdf).unwrap().wrap_key().unwrap(), a.wrap_key().unwrap());
}

#[test]
fn derivation_matches_fixed_vector() {
    // Vector fijo (valores fijados de esta implementación, no de una fuente externa): detecta cambios accidentales en la derivación (compatibilidad entre versiones).
    let kdf = KdfParams { alg: "argon2id".into(), m: 8, t: 1, p: 1, salt: vec![1u8; 16] };
    let auk = Auk::derive("correct horse", &SecretKey([2u8; 16]), &kdf).unwrap();
    let hex = |k: nexus_sync_proto::Key| k.0.iter().map(|b| format!("{b:02x}")).collect::<String>();
    let auth = hex(auk.auth_key().unwrap());
    let wrap = hex(auk.wrap_key().unwrap());
    assert_eq!(auth.len(), 64);
    assert_eq!(auth, VECTOR_AUTH, "auth key changed");
    assert_eq!(wrap, VECTOR_WRAP, "wrap key changed");
}
const VECTOR_AUTH: &str = "ae1342e757890db95a3b1a0dea7b93778efd9dd5eefe43e0040f0cff6195201e";
const VECTOR_WRAP: &str = "91e7c01448074cd123745da803f67985086b06c31f3947d354b45f46d99294a1";

#[test]
fn unsupported_kdf_algorithm_is_rejected() {
    let mut kdf = cheap();
    kdf.alg = "scrypt".into();
    assert!(matches!(Auk::derive("pw", &SecretKey([0; 16]), &kdf), Err(Error::Unsupported)));
}

// ---------- paquete ----------
#[test]
fn bundle_unwraps_on_another_device() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let b = KeyBundle::create(&vk, "pw", &s, cheap()).unwrap();
    let json = serde_json::to_string(&b).unwrap();
    let b2: KeyBundle = serde_json::from_str(&json).unwrap();
    assert_eq!(b2.unwrap_with_password("pw", &s).unwrap(), vk);
    // ambos secretos son necesarios
    assert!(b2.unwrap_with_password("wrong", &s).is_err());
    assert!(b2.unwrap_with_password("pw", &SecretKey::generate()).is_err());
}

#[test]
fn bundle_open_envelopes_from_first_device() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let e = Envelope::seal(&vk, "host", "h1", 1, "t", b"data").unwrap();
    let b = KeyBundle::create(&vk, "pw", &s, cheap()).unwrap();
    let recovered = b.unwrap_with_password("pw", &s).unwrap();
    assert_eq!(e.open(&recovered).unwrap(), b"data");
}

#[test]
fn password_change_only_rewraps() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let e = Envelope::seal(&vk, "host", "h1", 1, "t", b"data").unwrap();
    let mut b = KeyBundle::create(&vk, "old", &s, cheap()).unwrap();
    let old_salt = b.kdf.salt.clone();
    b.change_password(&vk, "new", &s).unwrap();
    assert_ne!(b.kdf.salt, old_salt);
    assert!(b.unwrap_with_password("old", &s).is_err());
    let k = b.unwrap_with_password("new", &s).unwrap();
    assert_eq!(e.open(&k).unwrap(), b"data"); // sin recifrar registros
}

#[test]
fn recovery_after_losing_the_password() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let r = RecoveryKey::generate();
    let e = Envelope::seal(&vk, "host", "h1", 1, "t", b"data").unwrap();
    let mut b = KeyBundle::create(&vk, "forgotten", &s, cheap()).unwrap();
    b.set_recovery(&vk, &r).unwrap();
    assert!(b.has_recovery());
    let key = b.recover_and_set_password(&r, "brand-new", &s).unwrap();
    assert_eq!(e.open(&key).unwrap(), b"data");
    assert!(b.unwrap_with_password("forgotten", &s).is_err());
    assert_eq!(b.unwrap_with_password("brand-new", &s).unwrap(), vk);
    assert!(b.has_recovery()); // la envoltura de recuperación sigue válida
    assert_eq!(b.unwrap_with_recovery(&r).unwrap(), vk);
}

#[test]
fn recovery_key_is_independent_and_revocable() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let r = RecoveryKey::generate();
    let mut b = KeyBundle::create(&vk, "pw", &s, cheap()).unwrap();
    assert!(matches!(b.unwrap_with_recovery(&r), Err(Error::MissingWrapping)));
    b.set_recovery(&vk, &r).unwrap();
    // una clave de recuperación distinta no abre nada
    assert!(b.unwrap_with_recovery(&RecoveryKey::generate()).is_err());
    // rotar invalida la anterior
    let r2 = RecoveryKey::generate();
    b.set_recovery(&vk, &r2).unwrap();
    assert!(b.unwrap_with_recovery(&r).is_err());
    assert_eq!(b.unwrap_with_recovery(&r2).unwrap(), vk);
    assert_eq!(b.wrappings.len(), 2);
    // revocar
    b.revoke_recovery();
    assert!(!b.has_recovery());
    assert!(matches!(b.unwrap_with_recovery(&r2), Err(Error::MissingWrapping)));
    // la contraseña no abre la envoltura de recuperación ni al revés: ids distintos en el AAD
    assert_eq!(b.unwrap_with_password("pw", &s).unwrap(), vk);
}

#[test]
fn bundle_wrappings_are_bound_to_their_id() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let r = RecoveryKey::generate();
    let mut b = KeyBundle::create(&vk, "pw", &s, cheap()).unwrap();
    b.set_recovery(&vk, &r).unwrap();
    // intercambiar los blobs entre envolturas debe fallar
    let pwd = b.wrappings[0].ct.clone();
    b.wrappings[1].ct = pwd;
    assert!(b.unwrap_with_recovery(&r).is_err());
}

#[test]
fn bundle_rejects_unknown_version() {
    let vk = Key::generate();
    let s = SecretKey::generate();
    let mut b = KeyBundle::create(&vk, "pw", &s, cheap()).unwrap();
    b.v = 9;
    assert!(matches!(b.unwrap_with_password("pw", &s), Err(Error::Unsupported)));
}

// ---------- kit ----------
#[test]
fn kit_contains_secret_and_optional_recovery_but_no_password() {
    let s = SecretKey::generate();
    let r = RecoveryKey::generate();
    for lang in [Lang::Es, Lang::En] {
        let with = emergency_kit("https://sync.example.org", "ana", &s, Some(&r), lang);
        assert!(with.contains("https://sync.example.org") && with.contains("ana"));
        assert!(with.contains(&s.to_display()) && with.contains(&r.to_display()));
        let without = emergency_kit("https://sync.example.org", "ana", &s, None, lang);
        assert!(without.contains(&s.to_display()));
        assert!(!without.contains("NXR1-"));
        assert!(!without.to_lowercase().contains("contraseña: ") && !without.to_lowercase().contains("password: "));
    }
}
