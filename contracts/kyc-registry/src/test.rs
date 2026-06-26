#![cfg(test)]

use crate::{KycRegistry, KycRegistryClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
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
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);

    client.add_verifier(&verifier);
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
#[should_panic(expected = "not an authorized verifier")]
fn test_unauthorized_verifier_cannot_approve() {
    let (env, client, _admin) = setup();
    let rogue = Address::generate(&env);
    let subject = Address::generate(&env);
    // rogue was never added as a verifier
    client.approve(&rogue, &subject, &0, &0, &String::from_str(&env, "US"));
}

#[test]
fn test_expiry_makes_approval_inactive() {
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

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
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);
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
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

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
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

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
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    client.add_verifier(&verifier);
    client.remove_verifier(&verifier);

    let subject = Address::generate(&env);
    let res = client.try_approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    assert!(res.is_err());
}

// ── update_tier tests ────────────────────────────────────────────────────────

#[test]
fn test_update_tier_changes_only_tier() {
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

    // Approve at tier 0 with a jurisdiction
    client.approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    assert_eq!(client.get_tier(&subject), 0);

    // Upgrade to tier 2
    client.update_tier(&verifier, &subject, &2);

    let record = client.get_record(&subject);
    assert_eq!(record.tier, 2);
    // Status and jurisdiction must remain unchanged
    assert!(matches!(record.status, crate::KycStatus::Approved));
    assert_eq!(record.jurisdiction, String::from_str(&env, "US"));
}

#[test]
#[should_panic(expected = "subject is not currently approved")]
fn test_update_tier_panics_when_not_approved() {
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

    // Subject has been rejected — not Approved
    client.reject(&verifier, &subject);
    client.update_tier(&verifier, &subject, &1);
}

#[test]
#[should_panic(expected = "not an authorized verifier")]
fn test_update_tier_panics_for_unauthorized_verifier() {
    let (env, client, _admin) = setup();
    let verifier = Address::generate(&env);
    let rogue = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_verifier(&verifier);

    client.approve(&verifier, &subject, &0, &0, &String::from_str(&env, "US"));
    // rogue was never added as a verifier
    client.update_tier(&rogue, &subject, &1);
}

#[test]
fn test_verifier_count_starts_at_zero() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.verifier_count(), 0);
}

#[test]
fn test_verifier_count_increments_on_add() {
    let (env, client, _admin) = setup();
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let v3 = Address::generate(&env);

    assert_eq!(client.verifier_count(), 0);
    client.add_verifier(&v1);
    assert_eq!(client.verifier_count(), 1);
    client.add_verifier(&v2);
    assert_eq!(client.verifier_count(), 2);
    client.add_verifier(&v3);
    assert_eq!(client.verifier_count(), 3);
}

#[test]
fn test_verifier_count_decrements_on_remove() {
    let (env, client, _admin) = setup();
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);

    client.add_verifier(&v1);
    client.add_verifier(&v2);
    assert_eq!(client.verifier_count(), 2);

    client.remove_verifier(&v1);
    assert_eq!(client.verifier_count(), 1);

    client.remove_verifier(&v2);
    assert_eq!(client.verifier_count(), 0);
}

#[test]
fn test_verifier_count_does_not_double_count_duplicate_add() {
    let (env, client, _admin) = setup();
    let v1 = Address::generate(&env);

    client.add_verifier(&v1);
    assert_eq!(client.verifier_count(), 1);

    // Adding the same verifier again must not bump the count.
    client.add_verifier(&v1);
    assert_eq!(client.verifier_count(), 1);
}

#[test]
fn test_verifier_count_does_not_underflow_on_remove_nonexistent() {
    let (env, client, _admin) = setup();
    let v1 = Address::generate(&env);

    // Removing an address that was never added must not panic or underflow.
    client.remove_verifier(&v1);
    assert_eq!(client.verifier_count(), 0);
}

#[test]
fn test_verifier_count_stays_accurate_after_mixed_operations() {
    let (env, client, _admin) = setup();
    let v0 = Address::generate(&env);
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let v3 = Address::generate(&env);
    let v4 = Address::generate(&env);

    client.add_verifier(&v0);
    client.add_verifier(&v1);
    client.add_verifier(&v2);
    client.add_verifier(&v3);
    client.add_verifier(&v4);
    assert_eq!(client.verifier_count(), 5);

    client.remove_verifier(&v1);
    client.remove_verifier(&v3);
    assert_eq!(client.verifier_count(), 3);

    client.add_verifier(&v1);
    assert_eq!(client.verifier_count(), 4);
}

// ── get_verifiers pagination tests ──────────────────────────────────────────

#[test]
fn test_get_verifiers_empty_list() {
    let (_env, client, _admin) = setup();
    let page = client.get_verifiers(&0, &10);
    assert_eq!(page.len(), 0);
}

#[test]
fn test_get_verifiers_first_page() {
    let (env, client, _admin) = setup();
    let v0 = Address::generate(&env);
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let v3 = Address::generate(&env);
    let v4 = Address::generate(&env);

    client.add_verifier(&v0);
    client.add_verifier(&v1);
    client.add_verifier(&v2);
    client.add_verifier(&v3);
    client.add_verifier(&v4);

    let page = client.get_verifiers(&0, &3);
    assert_eq!(page.len(), 3);
    assert_eq!(page.get(0), Some(v0.clone()));
    assert_eq!(page.get(1), Some(v1.clone()));
    assert_eq!(page.get(2), Some(v2.clone()));
}

#[test]
fn test_get_verifiers_second_page() {
    let (env, client, _admin) = setup();
    let v0 = Address::generate(&env);
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let v3 = Address::generate(&env);
    let v4 = Address::generate(&env);

    client.add_verifier(&v0);
    client.add_verifier(&v1);
    client.add_verifier(&v2);
    client.add_verifier(&v3);
    client.add_verifier(&v4);

    let page = client.get_verifiers(&3, &3);
    assert_eq!(page.len(), 2); // only 2 items remain after offset 3
    assert_eq!(page.get(0), Some(v3.clone()));
    assert_eq!(page.get(1), Some(v4.clone()));
}

#[test]
fn test_get_verifiers_start_beyond_end_returns_empty() {
    let (env, client, _admin) = setup();
    let v = Address::generate(&env);
    client.add_verifier(&v);

    let page = client.get_verifiers(&10, &5);
    assert_eq!(page.len(), 0);
}

#[test]
fn test_get_verifiers_limit_capped_at_20() {
    let (env, client, _admin) = setup();
    // Add 25 verifiers.
    for _ in 0..25 {
        let v = Address::generate(&env);
        client.add_verifier(&v);
    }

    // Even with limit=100, we should receive at most 20 entries.
    let page = client.get_verifiers(&0, &100);
    assert_eq!(page.len(), 20);
}

#[test]
fn test_get_verifiers_exact_limit_20() {
    let (env, client, _admin) = setup();
    for _ in 0..20 {
        let v = Address::generate(&env);
        client.add_verifier(&v);
    }

    let page = client.get_verifiers(&0, &20);
    assert_eq!(page.len(), 20);
}

#[test]
fn test_get_verifiers_pagination_covers_full_list() {
    let (env, client, _admin) = setup();
    for _ in 0..7 {
        let v = Address::generate(&env);
        client.add_verifier(&v);
    }

    // Page 0: items 0-2
    let page0 = client.get_verifiers(&0, &3);
    // Page 1: items 3-5
    let page1 = client.get_verifiers(&3, &3);
    // Page 2: item 6 (partial)
    let page2 = client.get_verifiers(&6, &3);

    assert_eq!(page0.len() + page1.len() + page2.len(), 7);
}
