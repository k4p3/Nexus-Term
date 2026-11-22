//! Texto del kit de emergencia. El tipo de entrada no admite la contraseña ni la clave de la bóveda.
use crate::keys::{RecoveryKey, SecretKey};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    Es,
    En,
}

pub fn emergency_kit(
    server_url: &str,
    account: &str,
    secret: &SecretKey,
    recovery: Option<&RecoveryKey>,
    lang: Lang,
) -> String {
    let secret = secret.to_display();
    let rec = recovery.map(|r| r.to_display());
    match lang {
        Lang::En => {
            let mut s = format!(
                "NEXUSTERM EMERGENCY KIT\n=======================\n\nServer:     {server_url}\nAccount:    {account}\nSecret Key: {secret}\n"
            );
            if let Some(r) = &rec {
                s.push_str(&format!("Recovery Key: {r}\n"));
            }
            s.push_str("\nKEEP THIS SAFE\n- Print it or store it offline, NOT on the computer that uses the vault.\n- You need the Secret Key plus your master password to add a new device.\n- This kit does NOT contain your master password. Nobody, including the server admin, can recover it.\n");
            if rec.is_some() {
                s.push_str("- The Recovery Key lets you set a new master password if you lose it. Whoever has it can unlock your data: guard it like a master key.\n");
            } else {
                s.push_str("- No Recovery Key was generated: if you lose both the password and the Secret Key your data cannot be recovered.\n");
            }
            s
        }
        Lang::Es => {
            let mut s = format!(
                "KIT DE EMERGENCIA DE NEXUSTERM\n==============================\n\nServidor:       {server_url}\nCuenta:         {account}\nSecret Key:     {secret}\n"
            );
            if let Some(r) = &rec {
                s.push_str(&format!("Clave de recuperación: {r}\n"));
            }
            s.push_str("\nGUÁRDALO EN LUGAR SEGURO\n- Imprímelo o guárdalo sin conexión, NO en el equipo que usa la bóveda.\n- Necesitas la Secret Key y tu contraseña maestra para añadir un equipo nuevo.\n- Este kit NO contiene tu contraseña maestra. Nadie, tampoco el administrador del servidor, puede recuperarla.\n");
            if rec.is_some() {
                s.push_str("- La clave de recuperación te permite fijar una contraseña nueva si pierdes la actual. Quien la tenga puede abrir tus datos: custódiala como una llave maestra.\n");
            } else {
                s.push_str("- No se generó clave de recuperación: si pierdes la contraseña y la Secret Key, tus datos no se podrán recuperar.\n");
            }
            s
        }
    }
}
