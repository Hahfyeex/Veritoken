#![cfg(test)]

use crate::{KycError, KycRegistry, KycRegistryClient};
use soroban_sdk::{
    testutils::{storage::Instance, Address as _, Ledger},
    Address, Env, Error, String,
};


fn setup() -> (Env, KycRegistryClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(KycRegistry, ());
    let client = KycRegistryClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_add_verifier_and_approve() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);

    client.add_verifier(&admin, &verifier);
    assert!(!client.is_approved(&subject));

    client.approve(&verifier, &subject, &1, &0, &String::from_str(&env, "US"));
    assert!(client.is_approved(&subject));
    assert_eq!(client.get_tier(&subject), 1);

}

#[test]
fn test_double_initialize_panics() {
    let (_env, client, admin) = setup();
    let res = client.try_initialize(&admin);
    assert!(res.is_err());
}

#[test]
fn test_unauthorized_verifier_cannot_approve() {
    let (env, client, _admin) = setup();
    let rogue = Address::generate(&env);
    let subject = Address::generate(&env);
    // rogue was never added as a verifier — must return an error
    let res = client.try_approve(&rogue, &subject, &0, &0, &String::from_str(&env, "US"));
    assert!(res.is_err());
}

#[test]
fn test_expiry_makes_approval_inactive() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);

    env.ledger().set_timestamp(1_000);
    client.approve(
        &verifier,
        &subject,
        &0,
        &2_000, // expires at ts 2000
        &String::from_str(&env, "US"),
    );
    assert!(client.is_approved(&subject));

    // Advance past expiry
    env.ledger().set_timestamp(3_000);
    assert!(!client.is_approved(&subject));
}

#[test]
fn test_revoke_and_reject() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    client.approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    assert!(client.is_approved(&subject));

    client.revoke(&verifier, &subject);
    assert!(!client.is_approved(&subject));

    // Re-approve then reject
    client.approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    assert!(client.is_approved(&subject));
    client.reject(&verifier, &subject);
    assert!(!client.is_approved(&subject));

    let record = client.get_record(&subject);
    assert!(matches!(record.status, crate::KycStatus::Rejected));
    assert_eq!(record.verifier, verifier);
    assert_eq!(record.tier, 0);
    assert_eq!(record.expiry, 0);
    assert_eq!(record.jurisdiction, String::from_str(&env, "US"));
}

#[test]
fn test_reject_without_existing_record_creates_terminal_record() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);

    client.reject(&verifier, &subject);

    assert!(!client.is_approved(&subject));
    let record = client.get_record(&subject);
    assert!(matches!(record.status, crate::KycStatus::Rejected));
    assert_eq!(record.verifier, verifier);
    assert_eq!(record.tier, 0);
    assert_eq!(record.expiry, 0);
    assert_eq!(record.jurisdiction, String::from_str(&env, ""));
}

#[test]
fn test_revoke_without_existing_record_creates_terminal_record() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);

    client.revoke(&verifier, &subject);

    assert!(!client.is_approved(&subject));
    let record = client.get_record(&subject);
    assert!(matches!(record.status, crate::KycStatus::Revoked));
    assert_eq!(record.verifier, verifier);
    assert_eq!(record.tier, 0);
    assert_eq!(record.expiry, 0);
    assert_eq!(record.jurisdiction, String::from_str(&env, ""));
}

#[test]
fn test_remove_verifier() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    client.remove_verifier(&admin, &verifier);

    let subject = Address::generate(&env);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    assert!(res.is_err());
}

#[test]
fn test_instance_ttl_bump() {
    let (env, client, admin) = setup();
    let contract_id = client.address.clone();

    // const DAY_IN_LEDGERS: u32 = 17280; const BUMP: u32 = 30 * DAY_IN_LEDGERS;
    let bump = 30 * 17280;

    let verifier = Address::generate(&env);
    client.add_verifier(&admin, &verifier);

    let initial_ttl = env.as_contract(&contract_id, || {
        env.storage().instance().get_ttl()
    });
    assert_eq!(initial_ttl, bump);

    env.ledger().with_mut(|l| {
        l.sequence_number += 30_000;
    });

    let reduced_ttl = env.as_contract(&contract_id, || {
        env.storage().instance().get_ttl()
    });
    assert_eq!(reduced_ttl, initial_ttl - 30_000);

    let subject = Address::generate(&env);
    client.is_approved(&subject);

    let bumped_ttl = env.as_contract(&contract_id, || {
        env.storage().instance().get_ttl()
    });
    assert_eq!(bumped_ttl, bump);
}

#[test]
fn test_two_step_admin_transfer() {
    let (env, client, admin) = setup();
    let new_admin = Address::generate(&env);

    client.propose_admin(&admin, &new_admin);
    client.accept_admin();

    // new_admin is now in the AdminList — add_verifier should succeed
    let verifier = Address::generate(&env);
    client.add_verifier(&new_admin, &verifier);
}

#[test]
fn test_accept_admin_fails_when_no_pending() {
    let (_env, client, _admin) = setup();
    let res = client.try_accept_admin();
    assert!(res.is_err());
}

#[test]
fn test_add_and_remove_admin() {
    let (env, client, admin) = setup();
    let second_admin = Address::generate(&env);

    client.add_admin(&admin, &second_admin);
    let admins = client.get_admins();
    assert_eq!(admins.len(), 2);

    // second_admin can now add a verifier
    let verifier = Address::generate(&env);
    client.add_verifier(&second_admin, &verifier);

    // remove second_admin
    client.remove_admin(&admin, &second_admin);
    let admins = client.get_admins();
    assert_eq!(admins.len(), 1);

    // second_admin can no longer add verifiers
    let verifier2 = Address::generate(&env);
    let res = client.try_add_verifier(&second_admin, &verifier2);
    assert_eq!(res, Err(Ok(Error::from(KycError::NotAdmin))));
}

#[test]
fn test_remove_last_admin_panics() {
    let (env, client, admin) = setup();
    let second = Address::generate(&env);
    client.add_admin(&admin, &second);

    // Remove admin, leaving second
    client.remove_admin(&admin, &admin);

    // Removing second (the last one) must fail
    let res = client.try_remove_admin(&second, &second);
    assert_eq!(res, Err(Ok(Error::from(KycError::EmptyAdminList))));
}

#[test]
fn test_non_admin_cannot_add_verifier() {
    let (env, client, _admin) = setup();
    let rogue = Address::generate(&env);
    let verifier = Address::generate(&env);
    let res = client.try_add_verifier(&rogue, &verifier);
    assert_eq!(res, Err(Ok(Error::from(KycError::NotAdmin))));
}

#[test]
fn test_approve_rejects_jurisdiction_too_long() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, "USA"));
    assert_eq!(res, Err(Ok(Error::from(KycError::InvalidJurisdiction))));
}

#[test]
fn test_approve_rejects_jurisdiction_lowercase() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, "us"));
    assert_eq!(res, Err(Ok(Error::from(KycError::InvalidJurisdiction))));
}

#[test]
fn test_approve_rejects_jurisdiction_with_digit() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, "U1"));
    assert_eq!(res, Err(Ok(Error::from(KycError::InvalidJurisdiction))));
}

#[test]
fn test_approve_rejects_empty_jurisdiction() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, ""));
    assert_eq!(res, Err(Ok(Error::from(KycError::InvalidJurisdiction))));
}

#[test]
fn test_approve_accepts_valid_iso_code() {
    let (env, client, admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&admin, &verifier);
    client.approve(&verifier, &subject, &1, &0, &String::from_str(&env, "DE"));
    assert!(client.is_approved(&subject));
}

#[test]
fn test_version_returns_nonempty() {
    let (_, client, _) = setup();
    let v = client.version();
    assert!(v.len() > 0);
}
